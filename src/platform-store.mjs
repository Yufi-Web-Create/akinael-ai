import { createSupabaseAdmin, verifySupabaseAccessToken } from './supabase-admin.mjs';
import { createResponsesExecutor, OpenAIResponsesError } from './openai-responses.mjs';
import { buildConsultationPrompt, parseConsultationReply, buildAdminChatPrompt } from './ai-consultation.mjs';
import { businessConfig } from './business-config.mjs';

export class PlatformStoreError extends Error {
  constructor(message, { status = 500, code = 'platform_store_error' } = {}) {
    super(message);
    this.name = 'PlatformStoreError';
    this.status = status;
    this.code = code;
  }
}

const requiredText = (value, field, maxLength = 200) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PlatformStoreError(`${field} is required`, { status: 400, code: 'validation_error' });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PlatformStoreError(`${field} is too long`, { status: 400, code: 'validation_error' });
  }
  return normalized;
};

const optionalText = (value, maxLength = 200) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new PlatformStoreError('value must be a string', { status: 400, code: 'validation_error' });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PlatformStoreError('value is too long', { status: 400, code: 'validation_error' });
  }
  return normalized || null;
};

const enumValue = (value, allowed, fallback, field) => {
  const normalized = String(value || fallback).trim();
  if (!allowed.has(normalized)) {
    throw new PlatformStoreError(`unsupported ${field}`, { status: 400, code: 'validation_error' });
  }
  return normalized;
};

const first = (value) => Array.isArray(value) ? value[0] || null : value || null;
const uuidList = (values) => values.map((value) => String(value)).filter(Boolean);
const projectSelect = 'id,tenant_id,customer_id,name,status,needs_attention,attention_reasons,metadata,created_at,updated_at';
const requestSelect = 'id,tenant_id,customer_id,project_id,created_by,type,title,body,status,priority,metadata,created_at,updated_at';
const messageSelect = 'id,tenant_id,project_id,request_id,author_user_id,author_type,content,metadata,created_at';
const customerWorkflowSelect = 'id,project_id,request_id,pipeline,status,current_phase,started_at,completed_at,created_at,updated_at';
const customerTaskSelect = 'id,project_id,workflow_run_id,task_key,agent_role,title,status,phase,sequence,mode,started_at,completed_at,created_at,updated_at';
const customerArtifactSelect = 'id,project_id,workflow_run_id,kind,title,metadata,created_at';
const customerApprovalSelect = 'id,project_id,request_id,type,status,payload,created_at,decided_at';
const customerQualityCheckSelect = 'id,project_id,workflow_run_id,reviewer,status,severity,location,problem,expected,created_at';
const adminArtifactSelect = 'id,project_id,workflow_run_id,kind,title,storage_key,metadata,created_at';
const adminQualityCheckSelect = 'id,project_id,workflow_run_id,reviewer,status,severity,location,problem,expected,evidence,created_at';
const adminPaymentSelect = 'id,customer_id,project_id,approval_id,provider,provider_reference,kind,amount,currency,status,created_at,updated_at';
const adminRepositorySelect = 'id,project_id,provider,repository_full_name,default_branch,created_at,updated_at';
const adminDeploymentSelect = 'id,project_id,repository_id,environment,status,url,provider_reference,commit_sha,created_at,published_at';
const adminAuditSelect = 'id,actor_user_id,actor_type,action,resource_type,resource_id,metadata,created_at';
const adminNotificationSelect = 'id,user_id,project_id,type,message,read_at,created_at';
const gateTaskSelect = 'id,project_id,workflow_run_id,task_key,mode,status,result,sequence,created_at';
const requestTypes = new Set(['general', 'web_new', 'web_change', 'copy', 'social', 'image', 'research', 'automation', 'seo', 'other']);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);
const chatMessageSelect = 'id,project_id,channel,role,author_user_id,content,metadata,created_at';
const customerSelect = 'id,tenant_id,name,plan_id,stripe_customer_id,notify_by_email,created_at,updated_at';
const planCatalogKeys = new Set(['trial', 'mini', 'operations', 'advanced']);

const deploymentGateFor = ({ workflows = [], gateTasks = [], approvals = [], deployments = [] }) => {
  const workflowOrder = new Map(workflows.map((workflow, index) => [workflow.id, index]));
  const relevantWorkflowId = workflows.find((workflow) =>
    gateTasks.some((task) => task.workflow_run_id === workflow.id)
  )?.id;
  const candidates = relevantWorkflowId
    ? gateTasks.filter((task) => task.workflow_run_id === relevantWorkflowId)
    : [...gateTasks].sort((left, right) => {
        const workflowDelta = (workflowOrder.get(left.workflow_run_id) ?? Number.MAX_SAFE_INTEGER)
          - (workflowOrder.get(right.workflow_run_id) ?? Number.MAX_SAFE_INTEGER);
        if (workflowDelta) return workflowDelta;
        return String(right.created_at || '').localeCompare(String(left.created_at || ''));
      });
  const releaseGate = [...candidates].sort((left, right) => {
    const priority = (task) => task.task_key === 'expanded_release_gate' ? 0 : task.task_key === 'release_gate' ? 1 : 2;
    return priority(left) - priority(right)
      || Number(right.sequence || 0) - Number(left.sequence || 0)
      || String(right.created_at || '').localeCompare(String(left.created_at || ''))
      || String(left.id || '').localeCompare(String(right.id || ''));
  })[0];
  const releasePassed = releaseGate?.status === 'completed' && releaseGate?.result?.review?.status === 'PASS';
  const deliveryApproval = approvals.find((approval) => approval.type === 'delivery' && approval.status === 'approved');
  const productionPublished = deployments.some((deployment) => deployment.environment === 'production' && deployment.status === 'published');
  return {
    releasePassed,
    customerApproved: Boolean(deliveryApproval),
    deployReady: Boolean(releasePassed && deliveryApproval),
    humanGateRequired: true,
    productionPublished
  };
};

export const createPlatformStore = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });
  const responses = createResponsesExecutor({ env, fetchImpl });
  const tenantName = String(env.AKINAEL_TENANT_NAME || 'akinael').trim();
  let cachedTenant = null;

  const resolveTenant = async () => {
    if (cachedTenant) return cachedTenant;
    const rows = await admin.request('/rest/v1/tenants', {
      query: `name=eq.${encodeURIComponent(tenantName)}&select=id,name&limit=1`
    });
    cachedTenant = first(rows);
    if (!cachedTenant) {
      throw new PlatformStoreError('Akinael tenant is not configured', { status: 503, code: 'tenant_not_configured' });
    }
    return cachedTenant;
  };

  const authUser = async (accessToken) => {
    if (!accessToken) {
      throw new PlatformStoreError('authentication required', { status: 401, code: 'authentication_required' });
    }
    const user = await verifySupabaseAccessToken(accessToken, { env, fetchImpl });
    if (!user?.id) {
      throw new PlatformStoreError('authentication required', { status: 401, code: 'authentication_required' });
    }
    return user;
  };

  const profileFor = async (userId) => {
    const rows = await admin.request('/rest/v1/user_profiles', {
      query: `id=eq.${encodeURIComponent(userId)}&select=id,tenant_id,role,display_name&limit=1`
    });
    return first(rows);
  };

  const membershipsFor = async (identity) => {
    const rows = await admin.request('/rest/v1/customer_members', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&user_id=eq.${encodeURIComponent(identity.id)}&select=customer_id,created_at&order=created_at.asc`
    });
    return Array.isArray(rows) ? rows : [];
  };

  const customersByIds = async (tenantId, customerIds) => {
    const ids = uuidList(customerIds);
    if (!ids.length) return [];
    return admin.request('/rest/v1/customers', {
      query: `tenant_id=eq.${encodeURIComponent(tenantId)}&id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,tenant_id,name,created_at,updated_at&order=created_at.asc`
    });
  };

  const identityFor = async (accessToken, { profileRequired = true } = {}) => {
    const user = await authUser(accessToken);
    const profile = await profileFor(user.id);
    if (!profile) {
      if (profileRequired) {
        throw new PlatformStoreError('onboarding required', { status: 409, code: 'onboarding_required' });
      }
      return {
        id: user.id,
        email: user.email || null,
        profile: null,
        role: null,
        tenantId: null,
        displayName: null,
        onboardingRequired: true
      };
    }
    return {
      id: user.id,
      email: user.email || null,
      profile,
      role: profile.role,
      tenantId: profile.tenant_id,
      displayName: profile.display_name,
      onboardingRequired: false
    };
  };

  const visibleCustomerIds = async (identity) => {
    if (identity.role === 'admin') return null;
    if (identity.role !== 'customer') {
      throw new PlatformStoreError('insufficient permissions', { status: 403, code: 'insufficient_permissions' });
    }
    return uuidList((await membershipsFor(identity)).map((item) => item.customer_id));
  };

  const getProjectForIdentity = async (identity, projectId) => {
    const id = requiredText(projectId, 'project id', 64);
    const customerIds = await visibleCustomerIds(identity);
    let query = `id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${projectSelect}&limit=1`;
    if (customerIds !== null) {
      if (!customerIds.length) {
        throw new PlatformStoreError('project not found', { status: 404, code: 'project_not_found' });
      }
      query += `&customer_id=in.(${customerIds.map(encodeURIComponent).join(',')})`;
    }
    const project = first(await admin.request('/rest/v1/projects', { query }));
    if (!project) {
      throw new PlatformStoreError('project not found', { status: 404, code: 'project_not_found' });
    }
    return project;
  };

  const getMe = async (accessToken) => {
    const identity = await identityFor(accessToken, { profileRequired: false });
    if (identity.onboardingRequired) {
      const tenant = await resolveTenant();
      return {
        user: { id: identity.id, email: identity.email },
        profile: null,
        customer: null,
        tenant: { id: tenant.id, name: tenant.name },
        onboardingRequired: true
      };
    }

    let customer = null;
    if (identity.role === 'customer') {
      const memberships = await membershipsFor(identity);
      customer = first(await customersByIds(identity.tenantId, memberships.map((item) => item.customer_id)));
    }
    return {
      user: { id: identity.id, email: identity.email },
      profile: {
        role: identity.role,
        displayName: identity.displayName,
        tenantId: identity.tenantId
      },
      customer,
      onboardingRequired: false
    };
  };

  const provisionCustomer = async (accessToken, input = {}) => {
    const user = await authUser(accessToken);
    const existing = await profileFor(user.id);
    if (existing) {
      if (existing.role !== 'customer') {
        throw new PlatformStoreError('account is not a customer account', { status: 409, code: 'account_role_conflict' });
      }
      return getMe(accessToken);
    }

    const tenant = await resolveTenant();
    const displayName = optionalText(input.displayName);
    const businessName = optionalText(input.businessName);
    await admin.request('/rest/v1/rpc/provision_customer_account', {
      method: 'POST',
      body: {
        p_tenant_id: tenant.id,
        p_user_id: user.id,
        p_email: user.email || '',
        p_display_name: displayName,
        p_business_name: businessName
      }
    });
    return getMe(accessToken);
  };

  const provisionAdmin = async (accessToken, input = {}) => {
    const user = await authUser(accessToken);
    const configuredEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!configuredEmail || String(user.email || '').trim().toLowerCase() !== configuredEmail) {
      throw new PlatformStoreError('admin account is not authorized', { status: 403, code: 'admin_not_authorized' });
    }
    const existing = await profileFor(user.id);
    if (existing) {
      if (existing.role !== 'admin') throw new PlatformStoreError('account role conflict', { status: 409, code: 'account_role_conflict' });
      return getMe(accessToken);
    }
    const tenant = await resolveTenant();
    const rows = await admin.request('/rest/v1/user_profiles', {
      method: 'POST',
      query: 'select=id,tenant_id,role,display_name',
      headers: { Prefer: 'return=representation' },
      body: {
        id: user.id,
        tenant_id: tenant.id,
        role: 'admin',
        display_name: optionalText(input.displayName) || '管理者'
      }
    });
    if (!first(rows)) throw new PlatformStoreError('admin account could not be provisioned', { status: 502, code: 'admin_provision_failed' });
    return getMe(accessToken);
  };

  const adminIdentity = async (accessToken) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'admin') throw new PlatformStoreError('administrators only', { status: 403, code: 'administrators_only' });
    return identity;
  };

  const tenantRows = async (identity, table, select, extra = '') => {
    const rows = await admin.request(`/rest/v1/${table}`, {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${select}${extra}`
    });
    return Array.isArray(rows) ? rows : [];
  };

  const getAdminOverview = async (accessToken) => {
    const identity = await adminIdentity(accessToken);
    const [customers, projects, workflows, tasks, approvals, notifications] = await Promise.all([
      tenantRows(identity, 'customers', 'id,name,created_at,updated_at', '&order=updated_at.desc'),
      tenantRows(identity, 'projects', projectSelect, '&order=updated_at.desc'),
      tenantRows(identity, 'workflow_runs', customerWorkflowSelect, '&order=created_at.desc'),
      tenantRows(identity, 'tasks', customerTaskSelect, '&order=updated_at.desc'),
      tenantRows(identity, 'approvals', customerApprovalSelect, '&order=created_at.desc'),
      tenantRows(identity, 'notifications', adminNotificationSelect, '&order=created_at.desc&limit=50')
    ]);
    const customerNames = new Map(customers.map((item) => [item.id, item.name]));
    return {
      summary: {
        customers: customers.length,
        projects: projects.length,
        needsAttention: projects.filter((item) => item.needs_attention).length,
        runningWorkflows: workflows.filter((item) => item.status === 'running').length,
        failedTasks: tasks.filter((item) => item.status === 'failed').length,
        pendingApprovals: approvals.filter((item) => item.status === 'pending').length
      },
      projects: projects.map((project) => ({ ...project, customer_name: customerNames.get(project.customer_id) || null })),
      recentWorkflows: workflows.slice(0, 20),
      recentNotifications: notifications
    };
  };

  const getAdminProject = async (accessToken, projectId) => {
    const identity = await adminIdentity(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const scope = `&project_id=eq.${encodeURIComponent(project.id)}`;
    const [customers, requests, messages, workflows, tasks, gateTasks, artifacts, qualityChecks, approvals, payments, repositories, deployments, notifications, auditLogs, consultationMessages] = await Promise.all([
      tenantRows(identity, 'customers', customerSelect, `&id=eq.${encodeURIComponent(project.customer_id)}&limit=1`),
      tenantRows(identity, 'requests', requestSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'messages', messageSelect, `${scope}&order=created_at.asc`),
      tenantRows(identity, 'workflow_runs', customerWorkflowSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'tasks', customerTaskSelect, `${scope}&order=sequence.asc`),
      tenantRows(identity, 'tasks', gateTaskSelect, `${scope}&mode=eq.release_gate&order=created_at.desc,sequence.desc`),
      tenantRows(identity, 'artifacts', adminArtifactSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'quality_checks', adminQualityCheckSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'approvals', customerApprovalSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'payments', adminPaymentSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'repositories', adminRepositorySelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'deployments', adminDeploymentSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'notifications', adminNotificationSelect, `${scope}&order=created_at.desc&limit=100`),
      tenantRows(identity, 'audit_logs', adminAuditSelect, `&metadata->>project_id=eq.${encodeURIComponent(project.id)}&order=created_at.desc&limit=100`),
      tenantRows(identity, 'ai_chat_messages', chatMessageSelect, `${scope}&channel=eq.customer_consultation&order=created_at.asc&limit=300`)
    ]);
    const previewBase = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    return {
      project,
      customer: first(customers),
      requests,
      messages,
      workflows,
      tasks,
      artifacts: artifacts.map((artifact) => ({ ...artifact, preview_url: artifact.kind === 'build_build' ? `${previewBase}/preview/${project.id}/${artifact.id}` : null })),
      qualityChecks,
      approvals,
      payments,
      repositories,
      deployments,
      notifications,
      deploymentGate: deploymentGateFor({ workflows, gateTasks, approvals, deployments }),
      auditLogs,
      consultationLog: consultationMessages.map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.created_at }))
    };
  };

  const listProjects = async (accessToken) => {
    const identity = await identityFor(accessToken);
    const customerIds = await visibleCustomerIds(identity);
    let query = `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${projectSelect}&order=updated_at.desc`;
    if (customerIds !== null) {
      if (!customerIds.length) return [];
      query += `&customer_id=in.(${customerIds.map(encodeURIComponent).join(',')})`;
    }
    const rows = await admin.request('/rest/v1/projects', { query });
    return Array.isArray(rows) ? rows : [];
  };

  const getProject = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    return getProjectForIdentity(identity, projectId);
  };

  const createProject = async (accessToken, input = {}) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') {
      throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    }
    const name = requiredText(input.name, 'project name');
    const memberships = await membershipsFor(identity);
    const customerId = first(memberships)?.customer_id;
    if (!customerId) {
      throw new PlatformStoreError('onboarding required', { status: 409, code: 'onboarding_required' });
    }
    const rows = await admin.request('/rest/v1/projects', {
      method: 'POST',
      query: `select=${projectSelect}`,
      headers: { Prefer: 'return=representation' },
      body: {
        tenant_id: identity.tenantId,
        customer_id: customerId,
        name,
        status: 'intake',
        needs_attention: false,
        attention_reasons: [],
        metadata: {}
      }
    });
    const project = first(rows);
    if (!project) {
      throw new PlatformStoreError('project could not be created', { status: 502, code: 'project_create_failed' });
    }
    return project;
  };

  const listRequests = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const rows = await admin.request('/rest/v1/requests', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&select=${requestSelect}&order=created_at.desc`
    });
    return Array.isArray(rows) ? rows : [];
  };

  const createRequest = async (accessToken, projectId, input = {}) => {
    const identity = await identityFor(accessToken);
    // Admins may also create a request on a customer's behalf — e.g. the Admin console's
    // 司令塔AIチャット "修正を指示" action reuses this exact path (see sendAdminChat below)
    // rather than inventing a parallel workflow-resume mechanism.
    if (!['customer', 'admin'].includes(identity.role)) {
      throw new PlatformStoreError('insufficient permissions', { status: 403, code: 'insufficient_permissions' });
    }
    const project = await getProjectForIdentity(identity, projectId);
    const title = requiredText(input.title, 'request title', 200);
    const body = requiredText(input.body, 'request body', 10000);
    const type = enumValue(input.type, requestTypes, 'general', 'request type');
    const priority = enumValue(input.priority, priorities, 'normal', 'priority');

    const created = first(await admin.request('/rest/v1/rpc/create_customer_request', {
      method: 'POST',
      body: {
        p_tenant_id: identity.tenantId,
        p_customer_id: project.customer_id,
        p_project_id: project.id,
        p_user_id: identity.id,
        p_type: type,
        p_title: title,
        p_body: body,
        p_priority: priority
      }
    }));
    if (!created?.request_id || !created?.message_id) {
      throw new PlatformStoreError('request could not be created', { status: 502, code: 'request_create_failed' });
    }

    const requestItem = first(await admin.request('/rest/v1/requests', {
      query: `id=eq.${encodeURIComponent(created.request_id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${requestSelect}&limit=1`
    }));
    const initialMessage = first(await admin.request('/rest/v1/messages', {
      query: `id=eq.${encodeURIComponent(created.message_id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${messageSelect}&limit=1`
    }));
    return { request: requestItem, initialMessage };
  };

  const listMessages = async (accessToken, projectId, { requestId = null } = {}) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    let query = `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&select=${messageSelect}&order=created_at.asc`;
    if (requestId) query += `&request_id=eq.${encodeURIComponent(requiredText(requestId, 'request id', 64))}`;
    const rows = await admin.request('/rest/v1/messages', { query });
    return Array.isArray(rows) ? rows : [];
  };

  const addMessage = async (accessToken, projectId, input = {}) => {
    const identity = await identityFor(accessToken);
    if (!['customer', 'admin'].includes(identity.role)) {
      throw new PlatformStoreError('insufficient permissions', { status: 403, code: 'insufficient_permissions' });
    }
    const project = await getProjectForIdentity(identity, projectId);
    const content = requiredText(input.content, 'message content', 10000);
    const requestId = optionalText(input.requestId, 64);

    if (requestId) {
      const requestItem = first(await admin.request('/rest/v1/requests', {
        query: `id=eq.${encodeURIComponent(requestId)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&select=id&limit=1`
      }));
      if (!requestItem) {
        throw new PlatformStoreError('request not found', { status: 404, code: 'request_not_found' });
      }
    }

    const rows = await admin.request('/rest/v1/messages', {
      method: 'POST',
      query: `select=${messageSelect}`,
      headers: { Prefer: 'return=representation' },
      body: {
        tenant_id: identity.tenantId,
        project_id: project.id,
        request_id: requestId,
        author_user_id: identity.id,
        author_type: identity.role === 'admin' ? 'admin' : 'customer',
        content,
        metadata: {}
      }
    });
    const message = first(rows);
    if (!message) {
      throw new PlatformStoreError('message could not be created', { status: 502, code: 'message_create_failed' });
    }
    return message;
  };

  const listApprovals = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const rows = await admin.request('/rest/v1/approvals', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&select=${customerApprovalSelect}&order=created_at.desc`
    });
    return Array.isArray(rows) ? rows : [];
  };

  const createCustomerApproval = async (accessToken, projectId, input = {}) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    const project = await getProjectForIdentity(identity, projectId);
    const requestId = optionalText(input.requestId, 64);
    if (requestId) {
      const requestItem = first(await admin.request('/rest/v1/requests', {
        query: `id=eq.${encodeURIComponent(requestId)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&select=id&limit=1`
      }));
      if (!requestItem) throw new PlatformStoreError('request not found', { status: 404, code: 'request_not_found' });
    }
    const note = requiredText(input.note, 'approval note', 10000);
    const requestFilter = requestId ? `request_id=eq.${encodeURIComponent(requestId)}` : 'request_id=is.null';
    const idempotencyKey = `delivery_approved:${project.id}:${requestId || 'project'}`;
    const recordNotification = async () => {
      try {
        await admin.request('/rest/v1/notifications', {
          method: 'POST', query: 'on_conflict=idempotency_key&select=id',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: { tenant_id: identity.tenantId, user_id: identity.id, project_id: project.id, type: 'delivery_approved', message: '成果物の承認を記録しました。本番公開はオーナー承認待ちです。', idempotency_key: idempotencyKey, delivery_status: 'in_app', delivery_attempts: 0 }
        });
        return { status: 'recorded' };
      } catch {
        return { status: 'pending_retry' };
      }
    };
    const recordAudit = async (approval, notification) => {
      try {
        // audit_logs has no idempotency_key/unique constraint (the notification/approval
        // idempotency migration only touched approvals/notifications), so "don't duplicate
        // recorded evidence" is enforced at the application level: once a
        // delivery_approval_recorded entry exists for this approval, later resends must not
        // keep appending more of them. A pending_retry entry is allowed to recur across
        // genuinely separate failed attempts — it documents real retry history, not a
        // settled outcome, so it isn't deduped the same way.
        // This existence check has a narrow, accepted race: two truly concurrent resends of
        // the same already-approved request could both pass it before either INSERT lands,
        // producing two delivery_approval_recorded rows. audit_logs is best-effort (errors
        // here are already swallowed below) and this endpoint isn't a hot path, so that's
        // treated as acceptable residual risk rather than something worth a code-level lock.
        if (notification.status === 'recorded') {
          const alreadyRecorded = first(await admin.request('/rest/v1/audit_logs', {
            query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&resource_type=eq.approval&resource_id=eq.${encodeURIComponent(approval.id)}&action=eq.delivery_approval_recorded&select=id&limit=1`
          }));
          if (alreadyRecorded) return;
        }
        await admin.request('/rest/v1/audit_logs', {
          method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
          body: { tenant_id: identity.tenantId, actor_user_id: identity.id, actor_type: 'customer', action: notification.status === 'recorded' ? 'delivery_approval_recorded' : 'delivery_approval_notification_pending_retry', resource_type: 'approval', resource_id: approval.id, metadata: { project_id: project.id, request_id: requestId, idempotency_key: idempotencyKey } }
        });
      } catch {
        // Approval is durable; a best-effort audit failure must not convert it into a failed approval.
      }
    };
    const existing = first(await admin.request('/rest/v1/approvals', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&${requestFilter}&type=eq.delivery&status=eq.approved&select=${customerApprovalSelect}&limit=1`
    }));
    if (existing) {
      const notification = await recordNotification();
      // Unconditional (not gated on notification.status === 'pending_retry'): an approval
      // that already exists but is still missing its notification/audit evidence — e.g.
      // because service_role lacked INSERT on those tables when it was first created — must
      // recover that evidence on retry, not just replay a cached "duplicate" response.
      // recordAudit's own internal check keeps this a no-op once evidence already exists.
      await recordAudit(existing, notification);
      return { ...existing, duplicate: true, notification };
    }
    const rows = await admin.request('/rest/v1/approvals', {
      method: 'POST', query: `on_conflict=idempotency_key&select=${customerApprovalSelect}`,
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: { tenant_id: identity.tenantId, project_id: project.id, request_id: requestId, type: 'delivery', status: 'approved', requested_by: identity.id, decided_by: identity.id, idempotency_key: idempotencyKey, payload: { note, source: 'customer_portal' }, decided_at: new Date().toISOString() }
    });
    const approval = first(rows) || first(await admin.request('/rest/v1/approvals', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=${customerApprovalSelect}&limit=1`
    }));
    if (!approval) throw new PlatformStoreError('approval could not be recorded', { status: 502, code: 'approval_create_failed' });
    const inserted = Boolean(first(rows));
    const notification = await recordNotification();
    // Unconditional for the same reason as the `existing` branch above: recordAudit's own
    // dedup check makes it safe to call every time, including the `!inserted` case (a
    // concurrent insert won this row's on_conflict, so this call never actually created it).
    await recordAudit(approval, notification);
    if (!inserted) return { ...approval, duplicate: true, notification };
    return { ...approval, notification };
  };

  const getProductionStatus = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const scope = `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}`;

    const [workflows, tasks, gateTasks, artifacts, qualityChecks, approvals, deployments, notifications] = await Promise.all([
      admin.request('/rest/v1/workflow_runs', {
        query: `${scope}&select=${customerWorkflowSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/tasks', {
        query: `${scope}&select=${customerTaskSelect}&order=sequence.asc`
      }),
      admin.request('/rest/v1/tasks', {
        query: `${scope}&mode=eq.release_gate&select=${gateTaskSelect}&order=created_at.desc,sequence.desc`
      }),
      admin.request('/rest/v1/artifacts', {
        query: `${scope}&select=${customerArtifactSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/quality_checks', {
        query: `${scope}&select=${customerQualityCheckSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/approvals', {
        query: `${scope}&select=${customerApprovalSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/deployments', {
        query: `${scope}&select=${adminDeploymentSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/notifications', {
        query: `${scope}&user_id=eq.${encodeURIComponent(identity.id)}&select=${adminNotificationSelect}&order=created_at.desc&limit=50`
      })
    ]);

    const previewBase = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    const customerArtifacts = (Array.isArray(artifacts) ? artifacts : []).map((artifact) => ({
      ...artifact,
      preview_url: artifact.kind === 'build_build' ? `${previewBase}/preview/${project.id}/${artifact.id}` : null
    }));

    return {
      project,
      workflows: Array.isArray(workflows) ? workflows : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      artifacts: customerArtifacts,
      qualityChecks: Array.isArray(qualityChecks) ? qualityChecks : [],
      approvals: Array.isArray(approvals) ? approvals : [],
      notifications: Array.isArray(notifications) ? notifications : [],
      deploymentGate: deploymentGateFor({ workflows, gateTasks, approvals, deployments })
    };
  };

  // -- AI consultation chat (Customer Portal「AIに相談」) --------------------------------
  // Pre-request chat turns live in ai_chat_messages (channel=customer_consultation), kept
  // separate from the formal `messages` table (see the 20260916000000 migration for why).
  // Nothing here is created until the customer explicitly approves the structured summary
  // (finalizeConsultationRequest below reuses createRequest/productionRouter exactly like a
  // normal request) — the chat itself never creates a request/workflow on its own.
  const runAiOrThrow = async (prompt) => {
    try {
      return await responses.run({ prompt, lightweight: true, reasoningEffort: 'low' });
    } catch (caught) {
      if (caught instanceof OpenAIResponsesError && caught.status === 503) {
        throw new PlatformStoreError('AI相談は現在ご利用いただけません。', { status: 503, code: 'ai_not_configured' });
      }
      throw new PlatformStoreError('AIからの応答を取得できませんでした。', { status: 502, code: 'ai_consultation_failed' });
    }
  };

  const insertChatMessage = async (row) => {
    const inserted = first(await admin.request('/rest/v1/ai_chat_messages', {
      method: 'POST',
      query: `select=${chatMessageSelect}`,
      headers: { Prefer: 'return=representation' },
      body: row
    }));
    if (!inserted) throw new PlatformStoreError('チャットメッセージを保存できませんでした。', { status: 502, code: 'chat_message_create_failed' });
    return inserted;
  };

  const listConsultation = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const rows = await admin.request('/rest/v1/ai_chat_messages', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&channel=eq.customer_consultation&select=${chatMessageSelect}&order=created_at.asc&limit=200`
    });
    const all = Array.isArray(rows) ? rows : [];
    const latestThreadId = all.length ? all[all.length - 1].metadata?.threadId || null : null;
    const active = latestThreadId ? all.filter((row) => row.metadata?.threadId === latestThreadId) : [];
    const lastAssistant = [...active].reverse().find((row) => row.role === 'assistant' && row.metadata?.summary);
    const finalizedRow = [...active].reverse().find((row) => row.metadata?.finalized);
    return {
      threadId: latestThreadId,
      finalized: Boolean(finalizedRow),
      finalizedRequestId: finalizedRow?.metadata?.requestId || null,
      ready: Boolean(lastAssistant?.metadata?.ready),
      summary: lastAssistant?.metadata?.summary || null,
      messages: active.map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.created_at }))
    };
  };

  const sendConsultationMessage = async (accessToken, projectId, input = {}) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    const project = await getProjectForIdentity(identity, projectId);
    const content = requiredText(input.content, 'message', 4000);
    const chatContext = optionalText(input.chatContext, 200);
    let threadId = optionalText(input.threadId, 64);

    const current = await listConsultation(accessToken, projectId);
    if (threadId && threadId === current.threadId && current.finalized) {
      throw new PlatformStoreError('この相談はすでに依頼として送信済みです。新しい相談を始めてください。', { status: 409, code: 'consultation_already_finalized' });
    }
    if (!threadId || (current.finalized && threadId === current.threadId)) {
      threadId = `thr_${project.id.slice(0, 8)}_${Date.now().toString(36)}`;
    }

    const userMetadata = { threadId, ...(chatContext ? { chatContext } : {}) };
    await insertChatMessage({
      tenant_id: identity.tenantId, project_id: project.id, channel: 'customer_consultation',
      role: 'user', author_user_id: identity.id, content, metadata: userMetadata
    });

    const threadRows = await admin.request('/rest/v1/ai_chat_messages', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&channel=eq.customer_consultation&select=${chatMessageSelect}&order=created_at.asc&limit=200`
    });
    const thread = (Array.isArray(threadRows) ? threadRows : []).filter((row) => row.metadata?.threadId === threadId);
    const effectiveChatContext = chatContext || thread.find((row) => row.metadata?.chatContext)?.metadata?.chatContext || null;
    const history = thread.map((row) => ({ role: row.role, content: row.content }));

    const prompt = buildConsultationPrompt({ history, chatContext: effectiveChatContext, businessConfig });
    const run = await runAiOrThrow(prompt);
    const parsed = parseConsultationReply(run.output);

    const assistantRow = await insertChatMessage({
      tenant_id: identity.tenantId, project_id: project.id, channel: 'customer_consultation',
      role: 'assistant', author_user_id: null, content: parsed.message,
      metadata: { threadId, ready: parsed.ready, summary: parsed.summary, model: run.model }
    });

    return { threadId, ready: parsed.ready, summary: parsed.summary, reply: { id: assistantRow.id, role: 'assistant', content: parsed.message, createdAt: assistantRow.created_at } };
  };

  const finalizeConsultationRequest = async (accessToken, projectId, input = {}) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    const project = await getProjectForIdentity(identity, projectId);
    const threadId = requiredText(input.threadId, 'thread id', 64);
    const summary = input.summary && typeof input.summary === 'object' ? input.summary : null;
    if (!summary || !summary.title || !summary.overview) {
      throw new PlatformStoreError('相談内容がまだ整っていません。', { status: 400, code: 'consultation_summary_missing' });
    }
    const current = await listConsultation(accessToken, projectId);
    if (current.threadId !== threadId) {
      throw new PlatformStoreError('この相談は最新の内容ではありません。', { status: 409, code: 'consultation_stale' });
    }
    if (current.finalized) {
      throw new PlatformStoreError('この相談はすでに依頼として送信済みです。', { status: 409, code: 'consultation_already_finalized' });
    }
    const type = requestTypes.has(summary.category) ? summary.category : 'general';
    const bodyLines = [summary.overview];
    if (summary.scopeItems?.length) bodyLines.push('', '含まれる作業:', ...summary.scopeItems.map((item) => `- ${item}`));
    if (summary.deliverables?.length) bodyLines.push('', '納品物:', ...summary.deliverables.map((item) => `- ${item}`));
    if (summary.priceBand) bodyLines.push('', `予定金額の目安: ${summary.priceBand}`);
    if (summary.notes) bodyLines.push('', `補足: ${summary.notes}`);

    void project;
    const created = await createRequest(accessToken, projectId, {
      type, title: summary.title.slice(0, 200) || '新しいご相談', body: bodyLines.join('\n'), priority: 'normal'
    });
    return { ...created, threadId };
  };

  const markConsultationFinalized = async (accessToken, projectId, { threadId, requestId }) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    await insertChatMessage({
      tenant_id: identity.tenantId, project_id: project.id, channel: 'customer_consultation',
      role: 'assistant', author_user_id: null, content: 'ご依頼として送信しました。担当チームが確認します。',
      metadata: { threadId, finalized: true, requestId }
    });
    return { ok: true };
  };

  // -- Admin project-scoped AI chat（司令塔AIチャット） -----------------------------------
  const listAdminChat = async (accessToken, projectId) => {
    const identity = await adminIdentity(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const rows = await admin.request('/rest/v1/ai_chat_messages', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&channel=eq.admin_command&select=${chatMessageSelect}&order=created_at.asc&limit=200`
    });
    return (Array.isArray(rows) ? rows : []).map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.created_at }));
  };

  const sendAdminChat = async (accessToken, projectId, input = {}) => {
    const identity = await adminIdentity(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const content = requiredText(input.content, 'message', 4000);
    const asInstruction = Boolean(input.createRequest);

    await insertChatMessage({
      tenant_id: identity.tenantId, project_id: project.id, channel: 'admin_command',
      role: 'user', author_user_id: identity.id, content, metadata: {}
    });
    const recentRows = await admin.request('/rest/v1/ai_chat_messages', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}&channel=eq.admin_command&select=${chatMessageSelect}&order=created_at.desc&limit=16`
    });
    const history = (Array.isArray(recentRows) ? recentRows : []).reverse().map((row) => ({ role: row.role, content: row.content }));

    const prompt = buildAdminChatPrompt({ history, project, instruction: asInstruction });
    const run = await runAiOrThrow(prompt);
    const assistantRow = await insertChatMessage({
      tenant_id: identity.tenantId, project_id: project.id, channel: 'admin_command',
      role: 'assistant', author_user_id: null, content: run.output.trim(), metadata: {}
    });

    let createdRequest = null;
    if (asInstruction) {
      const created = await createRequest(accessToken, projectId, {
        type: 'web_change', title: content.slice(0, 80), body: content, priority: 'normal'
      });
      createdRequest = created.request;
    }
    return { reply: { id: assistantRow.id, role: 'assistant', content: assistantRow.content, createdAt: assistantRow.created_at }, createdRequest };
  };

  // -- Admin customers --------------------------------------------------------------------
  const listAdminCustomers = async (accessToken) => {
    const identity = await adminIdentity(accessToken);
    const [customers, projects] = await Promise.all([
      tenantRows(identity, 'customers', customerSelect, '&order=updated_at.desc'),
      tenantRows(identity, 'projects', projectSelect, '')
    ]);
    return customers.map((customer) => {
      const owned = projects.filter((project) => project.customer_id === customer.id);
      const lastActivity = owned.reduce((latest, project) => (project.updated_at > latest ? project.updated_at : latest), customer.updated_at || '');
      return { ...customer, projectCount: owned.length, needsAttention: owned.some((project) => project.needs_attention), lastActivity };
    });
  };

  const getAdminCustomer = async (accessToken, customerId) => {
    const identity = await adminIdentity(accessToken);
    const id = requiredText(customerId, 'customer id', 64);
    const customer = first(await admin.request('/rest/v1/customers', {
      query: `id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${customerSelect}&limit=1`
    }));
    if (!customer) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    const projects = await tenantRows(identity, 'projects', projectSelect, `&customer_id=eq.${encodeURIComponent(id)}&order=updated_at.desc`);
    return { customer, projects };
  };

  const updateAdminCustomer = async (accessToken, customerId, input = {}) => {
    const identity = await adminIdentity(accessToken);
    const id = requiredText(customerId, 'customer id', 64);
    const planId = optionalText(input.planId, 40);
    if (planId && !planCatalogKeys.has(planId)) {
      throw new PlatformStoreError('unsupported plan id', { status: 400, code: 'validation_error' });
    }
    const rows = await admin.request('/rest/v1/customers', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${customerSelect}`,
      headers: { Prefer: 'return=representation' },
      body: { plan_id: planId }
    });
    const updated = first(rows);
    if (!updated) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    return updated;
  };

  // -- Admin project actions ---------------------------------------------------------------
  const acknowledgeAdminProject = async (accessToken, projectId, input = {}) => {
    const identity = await adminIdentity(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const note = optionalText(input.note, 2000);
    await admin.request('/rest/v1/approvals', {
      method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
      body: { tenant_id: identity.tenantId, project_id: project.id, type: 'admin_proceed', status: 'approved', requested_by: identity.id, decided_by: identity.id, payload: { note, source: 'admin_console' }, decided_at: new Date().toISOString() }
    });
    await admin.request('/rest/v1/projects', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(project.id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}`,
      body: { needs_attention: false, attention_reasons: [] }
    });
    await admin.request('/rest/v1/audit_logs', {
      method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
      body: { tenant_id: identity.tenantId, actor_user_id: identity.id, actor_type: 'admin', action: 'admin_project_acknowledged', resource_type: 'project', resource_id: project.id, metadata: { note } }
    }).catch(() => {});
    return { ok: true };
  };

  const notifyCustomerAboutProject = async (accessToken, projectId, input = {}) => {
    const identity = await adminIdentity(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const message = requiredText(input.message, 'message', 2000);
    const members = await admin.request('/rest/v1/customer_members', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&customer_id=eq.${encodeURIComponent(project.customer_id)}&select=user_id`
    });
    const userIds = uuidList((Array.isArray(members) ? members : []).map((item) => item.user_id));
    await Promise.all(userIds.map((userId) => admin.request('/rest/v1/notifications', {
      method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
      body: { tenant_id: identity.tenantId, user_id: userId, project_id: project.id, type: 'artifact_ready', message, delivery_status: 'in_app', delivery_attempts: 0 }
    })));
    await admin.request('/rest/v1/audit_logs', {
      method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
      body: { tenant_id: identity.tenantId, actor_user_id: identity.id, actor_type: 'admin', action: 'admin_notified_customer', resource_type: 'project', resource_id: project.id, metadata: { recipients: userIds.length } }
    }).catch(() => {});
    return { ok: true, notified: userIds.length };
  };

  // -- Billing (Portal「プラン・お支払い」) -------------------------------------------------
  const customerRecordFor = async (identity) => {
    const memberships = await membershipsFor(identity);
    const customerId = first(memberships)?.customer_id;
    if (!customerId) throw new PlatformStoreError('onboarding required', { status: 409, code: 'onboarding_required' });
    const customer = first(await admin.request('/rest/v1/customers', {
      query: `id=eq.${encodeURIComponent(customerId)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${customerSelect}&limit=1`
    }));
    if (!customer) throw new PlatformStoreError('customer not found', { status: 404, code: 'customer_not_found' });
    return customer;
  };

  const getPricingCatalog = () => ({
    currency: businessConfig.currency,
    taxIncluded: businessConfig.taxIncluded,
    plans: {
      trial: businessConfig.pricing.trial,
      mini: businessConfig.pricing.mini,
      operations: businessConfig.pricing.operations,
      advanced: businessConfig.pricing.advanced
    },
    websiteProduction: businessConfig.pricing.websiteProduction,
    instagramAds: businessConfig.pricing.instagramAds
  });

  const getBillingSummary = async (accessToken) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    const customer = await customerRecordFor(identity);
    const payments = await admin.request('/rest/v1/payments', {
      query: `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&customer_id=eq.${encodeURIComponent(customer.id)}&select=id,kind,amount,currency,status,created_at&order=created_at.desc&limit=50`
    });
    const planKey = planCatalogKeys.has(customer.plan_id) ? customer.plan_id : null;
    return {
      currentPlan: planKey ? { id: planKey, ...businessConfig.pricing[planKey] } : null,
      billingPortalAvailable: Boolean(env.STRIPE_SECRET_KEY && customer.stripe_customer_id),
      notifyByEmail: customer.notify_by_email !== false,
      history: Array.isArray(payments) ? payments : []
    };
  };

  const createBillingPortalSession = async (accessToken) => {
    const identity = await identityFor(accessToken);
    if (identity.role !== 'customer') throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
    const customer = await customerRecordFor(identity);
    const secretKey = String(env.STRIPE_SECRET_KEY || '').trim();
    if (!secretKey || !customer.stripe_customer_id) {
      throw new PlatformStoreError('お支払い管理は現在準備中です。', { status: 409, code: 'billing_portal_not_configured' });
    }
    const publicUrl = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
    const response = await fetchImpl('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: customer.stripe_customer_id, return_url: `${publicUrl}/portal/?screen=plan` })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.url) {
      throw new PlatformStoreError('お支払い管理画面を開けませんでした。', { status: 502, code: 'billing_portal_failed' });
    }
    return { url: payload.url };
  };

  // -- Account settings ---------------------------------------------------------------------
  const updateAccount = async (accessToken, input = {}) => {
    const identity = await identityFor(accessToken);
    const displayName = optionalText(input.displayName, 120);
    if (displayName) {
      await admin.request('/rest/v1/user_profiles', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(identity.id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}`,
        body: { display_name: displayName }
      });
    }
    if (identity.role === 'customer') {
      const businessName = optionalText(input.businessName, 120);
      const notifyByEmail = typeof input.notifyByEmail === 'boolean' ? input.notifyByEmail : undefined;
      if (businessName || notifyByEmail !== undefined) {
        const customer = await customerRecordFor(identity);
        const patch = {};
        if (businessName) patch.name = businessName;
        if (notifyByEmail !== undefined) patch.notify_by_email = notifyByEmail;
        await admin.request('/rest/v1/customers', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(customer.id)}&tenant_id=eq.${encodeURIComponent(identity.tenantId)}`,
          body: patch
        });
      }
    }
    return getMe(accessToken);
  };

  return {
    config: admin.config,
    getMe,
    provisionCustomer,
    provisionAdmin,
    listProjects,
    getProject,
    createProject,
    listRequests,
    createRequest,
    listMessages,
    addMessage,
    getProductionStatus,
    listApprovals,
    createCustomerApproval,
    getAdminOverview,
    getAdminProject,
    listConsultation,
    sendConsultationMessage,
    finalizeConsultationRequest,
    markConsultationFinalized,
    listAdminChat,
    sendAdminChat,
    listAdminCustomers,
    getAdminCustomer,
    updateAdminCustomer,
    acknowledgeAdminProject,
    notifyCustomerAboutProject,
    getPricingCatalog,
    getBillingSummary,
    createBillingPortalSession,
    updateAccount
  };
};
