import { createPlatformStore, PlatformStoreError } from './platform-store.mjs';
import { createProductionRouter } from './production-router.mjs';
import { createSupabaseAuth, SupabaseAuthError, verifySupabaseAccessToken } from './supabase-admin.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
// Do not collect account or consultation data until the legal documents and
// durable consent record specified by the release gate are in place.
const PERSONAL_DATA_COLLECTION_MESSAGE = 'new registration and consultation intake are unavailable until the terms and privacy policy are published';

const writeJson = (response, status, payload, extraHeaders = {}) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
};

// Use the TCP peer address instead of a client-controlled forwarding header.
// Deployments behind a proxy must preserve the peer address or enforce an
// equivalent limit at the trusted proxy boundary.
export const createIpRateLimiter = ({ now = () => Date.now(), windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX } = {}) => {
  const attempts = new Map();
  return (request) => {
    const key = request.socket?.remoteAddress || 'unknown';
    const currentTime = now();
    const current = attempts.get(key);
    if (!current || currentTime - current.startedAt >= windowMs) {
      attempts.set(key, { startedAt: currentTime, count: 1 });
      return null;
    }
    current.count += 1;
    if (current.count <= max) return null;
    return Math.max(1, Math.ceil((windowMs - (currentTime - current.startedAt)) / 1000));
  };
};

const readJsonBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      reject(new PlatformStoreError('request body is too large', { status: 413, code: 'request_too_large' }));
      request.destroy();
    }
  });
  request.on('end', () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch {
      reject(new PlatformStoreError('request body must be valid JSON', { status: 400, code: 'invalid_json' }));
    }
  });
  request.on('error', reject);
});

export const extractAccessToken = (request) => {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
};

export const createPlatformApi = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const store = createPlatformStore({ env, fetchImpl });
  const productionRouter = createProductionRouter({ env, fetchImpl });
  const auth = createSupabaseAuth({ env, fetchImpl });
  const rateLimited = createIpRateLimiter();

  const requireConfirmedEmail = async (accessToken) => {
    const user = await verifySupabaseAccessToken(accessToken, { env, fetchImpl });
    if (!user?.id) throw new PlatformStoreError('authentication required', { status: 401, code: 'authentication_required' });
    if (!user.email_confirmed_at) {
      throw new PlatformStoreError('email confirmation is required', { status: 403, code: 'email_confirmation_required' });
    }
    return user;
  };

  const handle = async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/v2/')) return false;

    const retryAfter = rateLimited(request);
    if (retryAfter) {
      return writeJson(response, 429, { error: { code: 'rate_limit_exceeded', message: 'too many requests' } }, { 'retry-after': String(retryAfter) }), true;
    }

    const method = request.method || 'GET';
    const token = extractAccessToken(request);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (!['/api/v2/auth/register', '/api/v2/auth/login', '/api/v2/auth/logout'].includes(url.pathname)) {
        await requireConfirmedEmail(token);
      }
      if (method === 'POST' && url.pathname === '/api/v2/auth/register') {
        throw new PlatformStoreError(PERSONAL_DATA_COLLECTION_MESSAGE, { status: 503, code: 'consultation_intake_closed' });
      }

      if (method === 'POST' && url.pathname === '/api/v2/auth/login') {
        const body = await readJsonBody(request);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) {
          throw new PlatformStoreError('email and password are required', { status: 400, code: 'validation_error' });
        }
        const result = await auth.signIn(email, password);
        const accessToken = result?.access_token || null;
        if (!accessToken) throw new SupabaseAuthError('invalid credentials', { status: 401, code: 'invalid_credentials' });
        await requireConfirmedEmail(accessToken);
        return writeJson(response, 200, { token: accessToken }), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/auth/logout') {
        if (token) await auth.signOut(token);
        return writeJson(response, 200, { ok: true }), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/auth/me') {
        return writeJson(response, 200, await store.getMe(token)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/onboarding') {
        throw new PlatformStoreError(PERSONAL_DATA_COLLECTION_MESSAGE, { status: 503, code: 'consultation_intake_closed' });
      }

      if (method === 'GET' && url.pathname === '/api/v2/projects') {
        return writeJson(response, 200, await store.listProjects(token)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/projects') {
        throw new PlatformStoreError(PERSONAL_DATA_COLLECTION_MESSAGE, { status: 503, code: 'consultation_intake_closed' });
        const body = await readJsonBody(request);
        return writeJson(response, 201, await store.createProject(token, body)), true;
      }

      if (parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'requests') {
        if (method === 'GET') {
          return writeJson(response, 200, await store.listRequests(token, parts[3])), true;
        }
        if (method === 'POST') {
          throw new PlatformStoreError(PERSONAL_DATA_COLLECTION_MESSAGE, { status: 503, code: 'consultation_intake_closed' });
          const body = await readJsonBody(request);
          const created = await store.createRequest(token, parts[3], body);
          try {
            const routing = await productionRouter.route(created.request);
            return writeJson(response, 201, { ...created, routing: { status: 'routed', ...routing } }), true;
          } catch {
            // The Request is already safely persisted. Keep it as `new` so a worker or
            // explicit retry can route it without asking the customer to submit again.
            return writeJson(response, 201, { ...created, routing: { status: 'pending_retry' } }), true;
          }
        }
      }

      if (parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'messages') {
        if (method === 'GET') {
          return writeJson(response, 200, await store.listMessages(token, parts[3], { requestId: url.searchParams.get('requestId') })), true;
        }
        if (method === 'POST') {
          throw new PlatformStoreError(PERSONAL_DATA_COLLECTION_MESSAGE, { status: 503, code: 'consultation_intake_closed' });
          const body = await readJsonBody(request);
          return writeJson(response, 201, await store.addMessage(token, parts[3], body)), true;
        }
      }

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'production') {
        return writeJson(response, 200, await store.getProductionStatus(token, parts[3])), true;
      }

      if (method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects') {
        return writeJson(response, 200, await store.getProject(token, parts[3])), true;
      }

      return writeJson(response, 404, { error: { code: 'not_found', message: 'not found' } }), true;
    } catch (caught) {
      if (caught instanceof SupabaseAuthError) {
        return writeJson(response, caught.status, { error: { code: caught.code, message: caught.message } }), true;
      }
      if (caught instanceof PlatformStoreError) {
        return writeJson(response, caught.status, { error: { code: caught.code, message: caught.message } }), true;
      }
      return writeJson(response, 500, { error: { code: 'internal_error', message: 'internal server error' } }), true;
    }
  };

  return { handle, store, productionRouter };
};
