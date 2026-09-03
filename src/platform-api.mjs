import { createPlatformStore, PlatformStoreError } from './platform-store.mjs';
import { createProductionRouter } from './production-router.mjs';
import { createSupabaseAdmin, createSupabaseAuth, SupabaseAuthError } from './supabase-admin.mjs';

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

const htmlEscape = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

export const extractAccessToken = (request) => {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
};

export const createPlatformApi = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const store = createPlatformStore({ env, fetchImpl });
  const productionRouter = createProductionRouter({ env, fetchImpl });
  const auth = createSupabaseAuth({ env, fetchImpl });
  const admin = createSupabaseAdmin({ env, fetchImpl });

  const handle = async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/preview/')) {
      const previewParts = url.pathname.split('/').filter(Boolean);
      if (request.method !== 'GET' || previewParts.length !== 3) return writeJson(response, 404, { error: { code: 'not_found', message: 'not found' } }), true;
      const [projectId, artifactId] = previewParts.slice(1);
      const rows = await admin.request('/rest/v1/artifacts', { query: `id=eq.${encodeURIComponent(artifactId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,title,kind,content_text,metadata&limit=1` });
      const artifact = Array.isArray(rows) ? rows[0] : null;
      if (!artifact) return writeJson(response, 404, { error: { code: 'preview_not_found', message: 'preview not found' } }), true;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(artifact.title || 'Akinael AI Preview')}</title><style>body{margin:0;background:#f7f3ea;color:#17302e;font-family:system-ui,-apple-system,sans-serif}main{max-width:960px;margin:0 auto;padding:40px 22px}header{background:#164e4a;color:#fff;border-radius:20px;padding:28px;margin-bottom:24px}pre{white-space:pre-wrap;background:#fff;border:1px solid #d9ded8;border-radius:16px;padding:24px;line-height:1.7;overflow:auto}small{opacity:.8}</style></head><body><main><header><small>AKINAEL AI / E2E PREVIEW</small><h1>${htmlEscape(artifact.title || '制作物プレビュー')}</h1><p>Workflowで生成された実プレビューです。</p></header><pre>${htmlEscape(artifact.content_text || 'Preview content is not available.')}</pre></main></body></html>`);
      return true;
    }
    if (!url.pathname.startsWith('/api/v2/')) return false;

    const method = request.method || 'GET';
    const token = extractAccessToken(request);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (method === 'POST' && url.pathname === '/api/v2/auth/register') {
        const body = await readJsonBody(request);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
          throw new PlatformStoreError('valid email and password of at least 6 characters are required', { status: 400, code: 'validation_error' });
        }
        if (email === String(env.ADMIN_EMAIL || '').trim().toLowerCase()) {
          throw new PlatformStoreError('administrator accounts must be created by the operator', { status: 403, code: 'admin_registration_disabled' });
        }
        const result = await auth.signUp(email, password);
        const accessToken = result?.access_token || result?.session?.access_token || null;
        if (!accessToken) {
          return writeJson(response, 202, { confirmationRequired: true }), true;
        }
        await store.provisionCustomer(accessToken, { displayName: email.split('@')[0] });
        return writeJson(response, 201, { token: accessToken }), true;
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
        const me = await store.getMe(accessToken);
        if (me.onboardingRequired) {
          if (email === String(env.ADMIN_EMAIL || '').trim().toLowerCase()) {
            await store.provisionAdmin(accessToken, { displayName: '管理者' });
          } else {
            await store.provisionCustomer(accessToken, { displayName: email.split('@')[0] });
          }
        }
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
        const body = await readJsonBody(request);
        return writeJson(response, 200, await store.provisionCustomer(token, body)), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/projects') {
        return writeJson(response, 200, await store.listProjects(token)), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/admin/overview') {
        return writeJson(response, 200, await store.getAdminOverview(token)), true;
      }

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'projects') {
        return writeJson(response, 200, await store.getAdminProject(token, parts[4])), true;
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

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'production') {
        return writeJson(response, 200, await store.getProductionStatus(token, parts[3])), true;
      }

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'approvals') {
        return writeJson(response, 200, await store.listApprovals(token, parts[3])), true;
      }

      if (method === 'POST' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'approvals') {
        const body = await readJsonBody(request);
        return writeJson(response, 201, await store.createCustomerApproval(token, parts[3], body)), true;
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
