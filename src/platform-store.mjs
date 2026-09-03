import { createSupabaseAdmin, verifySupabaseAccessToken } from './supabase-admin.mjs';

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
const requestTypes = new Set(['general', 'web_new', 'web_change', 'copy', 'social', 'image', 'research', 'automation', 'seo', 'other']);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);

export const createPlatformStore = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });
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
    const [customers, requests, messages, workflows, tasks, artifacts, qualityChecks, approvals, payments, repositories, deployments, auditLogs] = await Promise.all([
      tenantRows(identity, 'customers', 'id,name,created_at,updated_at', `&id=eq.${encodeURIComponent(project.customer_id)}&limit=1`),
      tenantRows(identity, 'requests', requestSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'messages', messageSelect, `${scope}&order=created_at.asc`),
      tenantRows(identity, 'workflow_runs', customerWorkflowSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'tasks', customerTaskSelect, `${scope}&order=sequence.asc`),
      tenantRows(identity, 'artifacts', adminArtifactSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'quality_checks', adminQualityCheckSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'approvals', customerApprovalSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'payments', adminPaymentSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'repositories', adminRepositorySelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'deployments', adminDeploymentSelect, `${scope}&order=created_at.desc`),
      tenantRows(identity, 'audit_logs', adminAuditSelect, `&metadata->>project_id=eq.${encodeURIComponent(project.id)}&order=created_at.desc&limit=100`)
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
      auditLogs
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
    if (identity.role !== 'customer') {
      throw new PlatformStoreError('customers only', { status: 403, code: 'customers_only' });
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
    const rows = await admin.request('/rest/v1/approvals', {
      method: 'POST', query: `select=${customerApprovalSelect}`,
      headers: { Prefer: 'return=representation' },
      body: { tenant_id: identity.tenantId, project_id: project.id, request_id: requestId, type: 'delivery', status: 'approved', requested_by: identity.id, decided_by: identity.id, payload: { note, source: 'customer_portal_e2e' }, decided_at: new Date().toISOString() }
    });
    const approval = first(rows);
    if (!approval) throw new PlatformStoreError('approval could not be recorded', { status: 502, code: 'approval_create_failed' });
    return approval;
  };

  const getProductionStatus = async (accessToken, projectId) => {
    const identity = await identityFor(accessToken);
    const project = await getProjectForIdentity(identity, projectId);
    const scope = `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&project_id=eq.${encodeURIComponent(project.id)}`;

    const [workflows, tasks, artifacts, qualityChecks] = await Promise.all([
      admin.request('/rest/v1/workflow_runs', {
        query: `${scope}&select=${customerWorkflowSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/tasks', {
        query: `${scope}&select=${customerTaskSelect}&order=sequence.asc`
      }),
      admin.request('/rest/v1/artifacts', {
        query: `${scope}&select=${customerArtifactSelect}&order=created_at.desc`
      }),
      admin.request('/rest/v1/quality_checks', {
        query: `${scope}&select=${customerQualityCheckSelect}&order=created_at.desc`
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
      qualityChecks: Array.isArray(qualityChecks) ? qualityChecks : []
    };
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
    getAdminProject
  };
};
