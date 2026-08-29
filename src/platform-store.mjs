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

const first = (value) => Array.isArray(value) ? value[0] || null : value || null;
const uuidList = (values) => values.map((value) => String(value)).filter(Boolean);
const projectSelect = 'id,tenant_id,customer_id,name,status,needs_attention,attention_reasons,metadata,created_at,updated_at';

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

  return {
    config: admin.config,

    async getMe(accessToken) {
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
    },

    async provisionCustomer(accessToken, input = {}) {
      const user = await authUser(accessToken);
      const existing = await profileFor(user.id);
      if (existing) {
        if (existing.role !== 'customer') {
          throw new PlatformStoreError('account is not a customer account', { status: 409, code: 'account_role_conflict' });
        }
        return this.getMe(accessToken);
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
      return this.getMe(accessToken);
    },

    async listProjects(accessToken) {
      const identity = await identityFor(accessToken);
      const customerIds = await visibleCustomerIds(identity);
      let query = `tenant_id=eq.${encodeURIComponent(identity.tenantId)}&select=${projectSelect}&order=updated_at.desc`;
      if (customerIds !== null) {
        if (!customerIds.length) return [];
        query += `&customer_id=in.(${customerIds.map(encodeURIComponent).join(',')})`;
      }
      const rows = await admin.request('/rest/v1/projects', { query });
      return Array.isArray(rows) ? rows : [];
    },

    async getProject(accessToken, projectId) {
      const id = requiredText(projectId, 'project id', 64);
      const identity = await identityFor(accessToken);
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
    },

    async createProject(accessToken, input = {}) {
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
    }
  };
};
