const normalizeUrl = (value) => String(value || '').replace(/\/+$/, '');

export const getSupabaseServerConfig = (env = process.env) => {
  const url = normalizeUrl(env.SUPABASE_URL);
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  return {
    url,
    secretKey,
    publishableKey,
    adminConfigured: Boolean(url && secretKey),
    authConfigured: Boolean(url && publishableKey)
  };
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

export class SupabaseAuthError extends Error {
  constructor(message, { status = 502, code = 'supabase_auth_error' } = {}) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
    this.code = code;
  }
}

export const createSupabaseAuth = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const config = getSupabaseServerConfig(env);

  const request = async (path, { method = 'POST', body, accessToken } = {}) => {
    if (!config.authConfigured) {
      throw new SupabaseAuthError('Supabase auth connection is not configured', { status: 503, code: 'auth_not_configured' });
    }
    const response = await fetchImpl(`${config.url}${path}`, {
      method,
      headers: {
        apikey: config.publishableKey,
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Supabase auth request failed with ${response.status}`;
      const code = payload?.code || (response.status === 400 ? 'invalid_credentials' : 'supabase_auth_error');
      throw new SupabaseAuthError(message, { status: response.status, code });
    }
    return payload;
  };

  return {
    signUp: (email, password, data = undefined) => request('/auth/v1/signup', { body: { email, password, ...(data ? { data } : {}) } }),
    signIn: (email, password) => request('/auth/v1/token?grant_type=password', { body: { email, password } }),
    updateUser: (accessToken, data) => request('/auth/v1/user', { method: 'PUT', accessToken, body: { data } }),
    signOut: (accessToken) => request('/auth/v1/logout', { accessToken })
  };
};

export const createSupabaseAdmin = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const config = getSupabaseServerConfig(env);

  const request = async (path, { method = 'GET', query = '', body, headers = {} } = {}) => {
    if (!config.adminConfigured) throw new Error('Supabase admin connection is not configured');
    const response = await fetchImpl(`${config.url}${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        apikey: config.secretKey,
        'content-type': 'application/json',
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const message = payload?.message || payload?.error_description || payload?.error || `Supabase request failed with ${response.status}`;
      throw new Error(message);
    }
    return payload;
  };

  return {
    config: { url: config.url, adminConfigured: config.adminConfigured, authConfigured: config.authConfigured },
    request,
    async healthCheck() {
      await request('/rest/v1/tenants', { query: 'select=id&limit=1' });
      return { status: 'ok' };
    }
  };
};

export const verifySupabaseAccessToken = async (accessToken, { env = process.env, fetchImpl = fetch } = {}) => {
  const config = getSupabaseServerConfig(env);
  if (!config.authConfigured) throw new Error('Supabase auth connection is not configured');
  if (!accessToken) return null;
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      authorization: `Bearer ${accessToken}`
    }
  });
  if (response.status === 401 || response.status === 403) return null;
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || `Supabase auth request failed with ${response.status}`);
  return payload;
};
