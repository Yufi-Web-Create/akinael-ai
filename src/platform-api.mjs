import { createPlatformStore, PlatformStoreError } from './platform-store.mjs';
import { createProductionRouter } from './production-router.mjs';
import { createSupabaseAdmin, createSupabaseAuth, SupabaseAuthError } from './supabase-admin.mjs';
import { createSquareBilling } from './square-billing.mjs';

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

const readRawBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      reject(new PlatformStoreError('request body is too large', { status: 413, code: 'request_too_large' }));
      request.destroy();
    }
  });
  request.on('end', () => resolve(body));
  request.on('error', reject);
});

const readJsonBody = async (request) => {
  const body = await readRawBody(request);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new PlatformStoreError('request body must be valid JSON', { status: 400, code: 'invalid_json' });
  }
};

const htmlEscape = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

export const extractAccessToken = (request) => {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
};

// Registration/login are the only v2 endpoints an external static site (the
// akinael-ai-web marketing site, a different origin) needs to call directly
// from the browser. No cookies/credentials are used, so an open origin is
// safe here; the rest of /api/v2/* stays same-origin only.
const CORS_ENABLED_PATHS = new Set(['/api/v2/auth/register', '/api/v2/auth/login']);
const corsHeadersFor = (pathname) => (CORS_ENABLED_PATHS.has(pathname) ? { 'access-control-allow-origin': '*' } : {});

export const createPlatformApi = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const store = createPlatformStore({ env, fetchImpl });
  const productionRouter = createProductionRouter({ env, fetchImpl });
  const auth = createSupabaseAuth({ env, fetchImpl });
  const admin = createSupabaseAdmin({ env, fetchImpl });
  const squareBilling = createSquareBilling({ env, fetchImpl });

  const handle = async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/preview/')) {
      const previewParts = url.pathname.split('/').filter(Boolean);
      if (request.method !== 'GET' || previewParts.length !== 3) return writeJson(response, 404, { error: { code: 'not_found', message: 'not found' } }), true;
      const [projectId, artifactId] = previewParts.slice(1);
      const rows = await admin.request('/rest/v1/artifacts', { query: `id=eq.${encodeURIComponent(artifactId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,title,kind,content_text,metadata&limit=1` });
      const artifact = Array.isArray(rows) ? rows[0] : null;
      if (!artifact) return writeJson(response, 404, { error: { code: 'preview_not_found', message: 'preview not found' } }), true;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' });
      response.end(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(artifact.title || 'Akinael AI Preview')}</title><style>body{margin:0;background:#f7f3ea;color:#17302e;font-family:system-ui,-apple-system,sans-serif}main{max-width:960px;margin:0 auto;padding:40px 22px}header{background:#164e4a;color:#fff;border-radius:20px;padding:28px;margin-bottom:24px}pre{white-space:pre-wrap;background:#fff;border:1px solid #d9ded8;border-radius:16px;padding:24px;line-height:1.7;overflow:auto}small{opacity:.8}</style></head><body><main><header><small>AKINAEL AI / E2E PREVIEW</small><h1>${htmlEscape(artifact.title || '制作物プレビュー')}</h1><p>Workflowで生成された実プレビューです。</p></header><pre>${htmlEscape(artifact.content_text || 'Preview content is not available.')}</pre></main></body></html>`);
      return true;
    }
    if (!url.pathname.startsWith('/api/v2/')) return false;

    const method = request.method || 'GET';
    const token = extractAccessToken(request);
    const parts = url.pathname.split('/').filter(Boolean);
    const cors = corsHeadersFor(url.pathname);

    if (method === 'OPTIONS' && CORS_ENABLED_PATHS.has(url.pathname)) {
      response.writeHead(204, {
        ...cors,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600'
      });
      response.end();
      return true;
    }

    try {
      if (method === 'POST' && url.pathname === '/api/v2/billing/webhook') {
        const rawBody = await readRawBody(request);
        const signature = request.headers['x-square-hmacsha256-signature'];
        return writeJson(response, 200, await squareBilling.handleWebhook({ rawBody, signature })), true;
      }

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
          return writeJson(response, 202, { confirmationRequired: true }, cors), true;
        }
        await store.provisionCustomer(accessToken, { displayName: email.split('@')[0] });
        return writeJson(response, 201, { token: accessToken }, cors), true;
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
        return writeJson(response, 200, { token: accessToken }, cors), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/auth/password-recovery') {
        const body = await readJsonBody(request);
        const email = String(body.email || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          throw new PlatformStoreError('valid email is required', { status: 400, code: 'validation_error' });
        }
        const publicUrl = String(env.PUBLIC_URL || 'https://akinael-ai.com').replace(/\/+$/, '');
        await auth.requestPasswordRecovery(email, `${publicUrl}/mypage`);
        return writeJson(response, 202, { recoveryRequested: true }), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/auth/password') {
        const body = await readJsonBody(request);
        const password = String(body.password || '');
        if (!token) {
          throw new SupabaseAuthError('authentication required', { status: 401, code: 'authentication_required' });
        }
        if (password.length < 12) {
          throw new PlatformStoreError('password must be at least 12 characters', { status: 400, code: 'validation_error' });
        }
        await auth.updatePassword(token, password);
        return writeJson(response, 200, { passwordUpdated: true }), true;
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

      if (method === 'GET' && url.pathname === '/api/v2/pricing') {
        return writeJson(response, 200, store.getPricingCatalog()), true;
      }

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'consultation') {
        return writeJson(response, 200, await store.listConsultation(token, parts[3])), true;
      }

      if (method === 'POST' && parts.length === 6 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'consultation' && parts[5] === 'messages') {
        const body = await readJsonBody(request);
        return writeJson(response, 201, await store.sendConsultationMessage(token, parts[3], body)), true;
      }

      if (method === 'POST' && parts.length === 6 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'projects' && parts[4] === 'consultation' && parts[5] === 'finalize') {
        const body = await readJsonBody(request);
        const projectId = parts[3];
        const finalized = await store.finalizeConsultationRequest(token, projectId, body);
        await store.markConsultationFinalized(token, projectId, { threadId: finalized.threadId, requestId: finalized.request.id });
        return writeJson(response, 201, { ...finalized, routing: { status: 'awaiting_admin_approval' } }), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/billing/summary') {
        return writeJson(response, 200, await squareBilling.getBillingSummary(token)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/billing/checkout-session') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await squareBilling.createCheckoutSession(token, body.planId)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/billing/change-plan') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await squareBilling.changePlan(token, body.planId)), true;
      }

      if (method === 'POST' && url.pathname === '/api/v2/billing/cancel') {
        return writeJson(response, 200, await squareBilling.cancelSubscription(token)), true;
      }

      if (method === 'PATCH' && url.pathname === '/api/v2/account') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await store.updateAccount(token, body)), true;
      }

      if (method === 'GET' && url.pathname === '/api/v2/admin/customers') {
        return writeJson(response, 200, await store.listAdminCustomers(token)), true;
      }

      if (method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'customers') {
        return writeJson(response, 200, await store.getAdminCustomer(token, parts[4])), true;
      }

      if (method === 'PATCH' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'customers') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await store.updateAdminCustomer(token, parts[4], body)), true;
      }

      if (method === 'GET' && parts.length === 6 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'projects' && parts[5] === 'chat') {
        return writeJson(response, 200, await store.listAdminChat(token, parts[4])), true;
      }

      if (method === 'POST' && parts.length === 7 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'projects' && parts[5] === 'chat' && parts[6] === 'messages') {
        const body = await readJsonBody(request);
        return writeJson(response, 201, await store.sendAdminChat(token, parts[4], body)), true;
      }

      if (method === 'POST' && parts.length === 6 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'projects' && parts[5] === 'acknowledge') {
        const body = await readJsonBody(request);
        const projectId = parts[4];
        const approval = await store.acknowledgeAdminProject(token, projectId, body);
        const detail = await store.getAdminProject(token, projectId);
        const latestRequest = detail.requests[0];
        if (!latestRequest) {
          throw new PlatformStoreError('production request is not ready', { status: 409, code: 'request_not_ready' });
        }
        const existingWorkflow = detail.workflows.find((workflow) => workflow.request_id === latestRequest.id);
        if (existingWorkflow) {
          return writeJson(response, 200, { ...approval, routing: { status: 'already_routed', workflow: existingWorkflow } }), true;
        }
        try {
          const routing = await productionRouter.route(latestRequest);
          return writeJson(response, 200, { ...approval, routing: { status: 'routed', ...routing } }), true;
        } catch {
          return writeJson(response, 200, { ...approval, routing: { status: 'pending_retry' } }), true;
        }
      }

      if (method === 'POST' && parts.length === 6 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'admin' && parts[3] === 'projects' && parts[5] === 'notify-customer') {
        const body = await readJsonBody(request);
        return writeJson(response, 200, await store.notifyCustomerAboutProject(token, parts[4], body)), true;
      }

      return writeJson(response, 404, { error: { code: 'not_found', message: 'not found' } }), true;
    } catch (caught) {
      if (caught instanceof SupabaseAuthError) {
        return writeJson(response, caught.status, { error: { code: caught.code, message: caught.message } }, cors), true;
      }
      if (caught instanceof PlatformStoreError) {
        return writeJson(response, caught.status, { error: { code: caught.code, message: caught.message } }, cors), true;
      }
      return writeJson(response, 500, { error: { code: 'internal_error', message: 'internal server error' } }, cors), true;
    }
  };

  return { handle, store, productionRouter, squareBilling };
};
