import { createPlatformStore, PlatformStoreError } from './platform-store.mjs';
import { createProductionRouter } from './production-router.mjs';

const MAX_BODY_BYTES = 64 * 1024;

const writeJson = (response, status, payload, extraHeaders = {}) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
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

  const handle = async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/v2/')) return false;

    const method = request.method || 'GET';
    const token = extractAccessToken(request);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (method === 'GET' && url.pathname === '/api/v2/auth/me') {
        return writeJson(response, 200, await store.getMe(token)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/onboarding') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await store.provisionCustomer(token, body)), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/projects') {
        return writeJson(response, 200, await store.listProjects(token)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/projects') {
        const body = await readJsonBody(request);
        return writeJson(response, 201, await store.createProject(token, body)), true;
      }

      if (parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'requests') {
        if (method === 'GET') {
          return writeJson(response, 200, await store.listRequests(token, parts[3])), true;
        }
        if (method === 'POST') {
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
          const body = await readJsonBody(request);
          return writeJson(response, 201, await store.addMessage(token, parts[3], body)), true;
        }
      }

      if (method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects') {
        return writeJson(response, 200, await store.getProject(token, parts[3])), true;
      }

      return writeJson(response, 404, { error: { code: 'not_found', message: 'not found' } }), true;
    } catch (caught) {
      if (caught instanceof PlatformStoreError) {
        return writeJson(response, caught.status, { error: { code: caught.code, message: caught.message } }), true;
      }
      return writeJson(response, 500, { error: { code: 'internal_error', message: 'internal server error' } }), true;
    }
  };

  return { handle, store, productionRouter };
};
