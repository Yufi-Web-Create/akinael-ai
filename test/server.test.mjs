import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createApp, resetStore, seedAdmin } from '../src/server.mjs';
import { businessConfig } from '../src/business-config.mjs';

let server;
const request = (path, options = {}) => new Promise((resolve, reject) => {
  const incoming = new EventEmitter();
  incoming.method = options.method || 'GET';
  incoming.url = path;
  incoming.headers = { host: 'localhost', 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.headers || {}) };
  incoming.socket = { remoteAddress: '127.0.0.1' };
  incoming.destroy = () => {};

  const response = {
    headersSent: false,
    status: 200,
    headers: {},
    chunks: [],
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; this.headersSent = true; return this; },
    end(chunk = '') {
      if (chunk) this.chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(this.chunks).toString('utf8');
      server.removeListener('error', onError);
      resolve({
        status: this.status,
        headers: new Headers(this.headers),
        json: async () => JSON.parse(body),
        text: async () => body
      });
    }
  };

  const onError = (error) => reject(error);
  server.once('error', onError);
  server.emit('request', incoming, response);
  queueMicrotask(() => {
    if (options.body) incoming.emit('data', Buffer.from(JSON.stringify(options.body)));
    incoming.emit('end');
  });
});

test.beforeEach(() => {
  resetStore();
  server = createApp();
});

test('frontend pages and project assets are served with the expected indexing boundary', async () => {
  const publicPage = await request('/');
  assert.equal(publicPage.status, 200);
  assert.match(publicPage.headers.get('content-type'), /text\/html/);
  assert.equal(publicPage.headers.get('x-frame-options'), 'DENY');
  assert.match(publicPage.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await publicPage.text(), /アキナエルAI/);

  const customerPage = await request('/mypage');
  assert.equal(customerPage.status, 200);
  assert.equal(customerPage.headers.get('x-robots-tag'), 'noindex, nofollow');

  const adminPage = await request('/admin');
  assert.equal(adminPage.status, 302);
  assert.equal(adminPage.headers.get('location'), '/admin-login');
  const adminLoginPage = await request('/admin-login');
  assert.equal(adminLoginPage.status, 200);

  const legalPage = await request('/legal');
  assert.equal(legalPage.status, 200);
  assert.match(await legalPage.text(), /運営・法務情報/);

  const logo = await request('/assets/logos/logo-horizontal.svg');
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/svg\+xml/);

  const appScript = await request('/assets/app.js');
  const appSource = await appScript.text();
  assert.match(appSource, /authFragment\.get\('access_token'\)/);
  assert.match(appSource, /\/api\/v2\/onboarding/);

  const paymentSuccess = await request('/payment/success');
  assert.equal(paymentSuccess.status, 200);
  assert.equal(paymentSuccess.headers.get('x-robots-tag'), 'noindex, nofollow');
  const paymentCancel = await request('/payment/cancel');
  assert.equal(paymentCancel.status, 200);
  assert.equal(paymentCancel.headers.get('x-robots-tag'), 'noindex, nofollow');

  const robots = await request('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \/admin/);

  const sitemap = await request('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /application\/xml/);
});

test('homepage presents formal prices and tax conditions while retaining the required trust answers', async () => {
  const response = await request('/');
  const html = await response.text();
  assert.match(html, new RegExp(businessConfig.pricing.mini.monthlyAmount.toLocaleString('ja-JP')));
  assert.match(html, new RegExp(businessConfig.pricing.operations.monthlyAmount.toLocaleString('ja-JP')));
  assert.match(html, new RegExp(businessConfig.pricing.advanced.monthlyAmount.toLocaleString('ja-JP')));
  assert.match(html, new RegExp(businessConfig.pricing.websiteProduction.startingAmount.toLocaleString('ja-JP')));
  assert.match(html, /広告費（税別）の20%に消費税を加えた額/);
  assert.match(html, /最低料金：<\/strong>月額5,500円（税込）/);
  assert.match(html, /現在、相談できますか？/);
  assert.match(html, /勝手に料金が発生しませんか/);
  assert.match(html, /データはどう扱われますか/);
});

test('homepage pricing section does not link visitors to the raw pricing API while intake is closed', async () => {
  const response = await request('/');
  const html = await response.text();
  assert.doesNotMatch(html, /href="\/api\/public\/pricing"/);
  assert.doesNotMatch(html, /data-auth-open="register"/);
  assert.match(html, /data-auth-open="login"/);
  assert.match(html, /href="\/legal#operator">新規受付は準備中/);
  const jpg = await request('/assets/photos/og-hero.jpg');
  assert.equal(jpg.status, 200);
  assert.match(jpg.headers.get('content-type'), /image\/jpeg/);
  assert.match(jpg.headers.get('cache-control'), /public/);
});

test('homepage hero image has explicit dimensions and eager high-priority loading to avoid layout shift', async () => {
  const response = await request('/');
  const html = await response.text();
  assert.match(html, /class="hero-media"[^>]*width="2400"[^>]*height="1350"/);
  assert.match(html, /class="hero-media"[^>]*fetchpriority="high"/);
  const avif = await request('/assets/v2/photos/akinael-hero-desktop-v2.avif');
  assert.equal(avif.status, 200);
  assert.match(avif.headers.get('content-type'), /image\/avif/);
});

test('registration form requires explicit consent to the terms and privacy policy', async () => {
  const response = await request('/');
  const html = await response.text();
  assert.match(html, /<input type="checkbox" name="consent"[^>]*required[^>]*data-auth-consent>/);
  assert.doesNotMatch(html, /data-auth-consent[^>]* checked/);
  assert.match(html, /href="\/legal#terms"/);
  assert.match(html, /href="\/legal#privacy"/);
});

test('login mode disables the registration-only consent requirement', async () => {
  const response = await request('/assets/app.js');
  const source = await response.text();
  assert.match(source, /authConsentInput\.disabled = mode !== 'register'/);
  assert.match(source, /authConsentInput\.required = mode === 'register'/);
});

test('frontend pages cache-bust the customer login fix', async () => {
  for (const path of ['/', '/mypage']) {
    const response = await request(path);
    const html = await response.text();
    assert.match(html, /\/assets\/app\.js\?v=20260830-login-fix/);
  }
});

test('public pricing uses the formal plan and approval policy', async () => {
  const response = await request('/api/public/pricing');
  const config = await response.json();
  assert.equal(response.status, 200);
  assert.equal(config.pricing.trial.amount, 0);
  assert.equal(config.pricing.mini.monthlyAmount, 3980);
  assert.equal(config.pricing.operations.monthlyAmount, 7980);
  assert.equal(config.pricing.advanced.monthlyAmount, 17800);
  assert.equal(config.pricing.instagramAds.minimumMonthlyFee, 5500);
  assert.equal(config.pricing.websiteProduction.startingAmount, 19800);
  assert.equal(Object.hasOwn(config.pricing, 'approvalRequiredFor'), false);
  assert.equal(Object.hasOwn(config.pricing, 'ambiguousApprovalExamples'), false);
  assert.deepEqual(config.refundPolicy, businessConfig.refundPolicy);
});

test('administrator can log in with the admin ID', async () => {
  seedAdmin('admin@example.com', 'another-secure-password');
  const response = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'another-secure-password' } });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.user.role, 'admin');
  assert.match(response.headers.get('set-cookie'), /akinael_session=/);
});

test('admin settings are protected and persisted through the settings API', async () => {
  seedAdmin('admin@example.com', 'another-secure-password');
  const unauthenticated = await request('/api/admin/settings');
  assert.equal(unauthenticated.status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } });
  const { token } = await login.json();
  const saved = await request('/api/admin/settings', { method: 'PUT', token, body: { llmProvider: 'OpenAI', storageProvider: 'r2', trialAmount: 29800, refundReviewed: true } });
  assert.equal(saved.status, 200);
  const settings = await saved.json();
  assert.equal(settings.llmProvider, 'OpenAI');
  assert.equal(settings.storageProvider, 'r2');
  assert.equal(settings.trialAmount, 29800);
  assert.equal(settings.refundReviewed, true);
  const fetched = await (await request('/api/admin/settings', { token })).json();
  assert.deepEqual(fetched, settings);
});

test('admin can inspect provider modes without exposing secrets', async () => {
  seedAdmin('admin@example.com', 'another-secure-password');
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } });
  const { token } = await login.json();
  const response = await request('/api/admin/system-status', { token });
  const status = await response.json();
  assert.equal(response.status, 200);
  assert.equal(status.providers.llm.name, 'mock');
  assert.equal(status.providers.payment.name, 'manual-adapter');
  assert.equal(status.providers.storage.name, 'local');
  assert.equal(Object.hasOwn(status.providers.llm, 'apiKey'), false);
});

test('workflow task execution uses the configured provider boundary', async () => {
  const customer = await (await request('/api/auth/register', { method: 'POST', body: { email: 'agent@example.com', password: 'a-secure-password' } })).json();
  const project = await (await request('/api/projects', { method: 'POST', token: customer.token, body: { name: 'AI接続テスト' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const admin = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  const workflow = await (await request(`/api/admin/projects/${project.id}/workflow`, { method: 'POST', token: admin.token, body: {} })).json();
  const task = workflow.tasks.find((item) => item.agentRole === 'project_director');
  const executed = await request(`/api/admin/tasks/${task.id}/execute`, { method: 'POST', token: admin.token, body: { input: '予約導線の要件を整理してください' } });
  const result = await executed.json();
  assert.equal(executed.status, 200);
  assert.equal(result.status, 'completed');
  assert.match(result.output, /Mock response/);
});

test('customer message gets an immediate AI reply and clears attention on the server', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  assert.equal(registered.status, 201);
  const { token } = await registered.json();
  const created = await request('/api/projects', { method: 'POST', token, body: { name: '美容室サイト改善' } });
  const project = await created.json();
  assert.equal(created.status, 201);
  const message = await request(`/api/projects/${project.id}/messages`, { method: 'POST', token, body: { content: '予約導線を相談したいです' } });
  assert.equal(message.status, 201);
  const posted = await message.json();
  assert.equal(posted.message.content, '予約導線を相談したいです');
  assert.match(posted.reply.content, /Mock response/);
  assert.equal(posted.reply.authorRole, 'assistant');
  const fetched = await request(`/api/projects/${project.id}`, { token });
  const current = await fetched.json();
  assert.equal(current.needsAttention, false);
  assert.deepEqual(current.attentionReasons, []);
  assert.deepEqual(current.messages.map((item) => item.authorRole), ['customer', 'assistant']);
});

test('public chat answers anonymous visitors without requiring authentication', async () => {
  const response = await request('/api/public/chat', { method: 'POST', body: { message: '料金を教えてください' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.reply, /Mock response/);
  const invalid = await request('/api/public/chat', { method: 'POST', body: { message: '' } });
  assert.equal(invalid.status, 400);
});

test('admin can view and reply to a project thread without triggering an AI reply', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const project = await (await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '管理チャットテスト' } })).json();
  await request(`/api/projects/${project.id}/messages`, { method: 'POST', token: customerToken, body: { content: '営業時間を載せたいです' } });
  seedAdmin('admin@example.com', 'another-secure-password');
  const { token: adminToken } = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  const projects = await (await request('/api/admin/projects', { token: adminToken })).json();
  assert.equal(projects.some((item) => item.id === project.id), true);
  const reply = await request(`/api/projects/${project.id}/messages`, { method: 'POST', token: adminToken, body: { content: '承知しました、追加しておきます' } });
  assert.equal(reply.status, 201);
  const replyBody = await reply.json();
  assert.equal(replyBody.reply, null);
  const current = await (await request(`/api/projects/${project.id}`, { token: adminToken })).json();
  assert.deepEqual(current.messages.map((item) => item.authorRole), ['customer', 'assistant', 'admin']);
});

test('project access without authentication returns 401 instead of exposing state', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token } = await registered.json();
  const projectResponse = await request('/api/projects', { method: 'POST', token, body: { name: '権限境界テスト' } });
  const project = await projectResponse.json();
  const response = await request(`/api/projects/${project.id}`);
  assert.equal(response.status, 404);
});

test('approval decisions require an admin token and are audited', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const projectResponse = await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '承認テスト' } });
  const project = await projectResponse.json();
  const forbidden = await request(`/api/admin/projects/${project.id}/approvals`, { method: 'POST', token: customerToken, body: { type: 'publish' } });
  assert.equal(forbidden.status, 403);
});

test('admin can approve a publish request and clear the attention state', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const projectResponse = await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '公開承認テスト' } });
  const project = await projectResponse.json();
  const adminId = seedAdmin('admin@example.com', 'another-secure-password');
  const adminLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json();
  const approvalResponse = await request(`/api/admin/projects/${project.id}/approvals`, { method: 'POST', token: adminToken, body: { type: 'publish' } });
  const approval = await approvalResponse.json();
  assert.equal(approvalResponse.status, 201);
  const decision = await request(`/api/admin/approvals/${approval.id}/decision`, { method: 'POST', token: adminToken, body: { status: 'approved' } });
  assert.equal(decision.status, 200);
  const current = await (await request(`/api/projects/${project.id}`, { token: adminToken })).json();
  assert.equal(current.needsAttention, false);
  assert.equal(adminId.length > 0, true);
  const logs = await (await request('/api/admin/audit-logs', { token: adminToken })).json();
  assert.equal(logs.some((entry) => entry.action === 'approval.approved'), true);
});

test('workflow creates separated agent tasks and quality evidence changes project state', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const project = await (await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '品質検査テスト' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const adminToken = (await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json()).token;
  const workflow = await (await request(`/api/admin/projects/${project.id}/workflow`, { method: 'POST', token: adminToken, body: { model: 'test-adapter' } })).json();
  assert.equal(workflow.status, 'running');
  const tasks = await (await request(`/api/projects/${project.id}/tasks`, { token: adminToken })).json();
  assert.deepEqual(tasks.map((task) => task.agentRole), ['customer_intake', 'project_director', 'research_strategist', 'ux_architect', 'content_editor', 'visual_designer', 'frontend_engineer', 'seo_accessibility', 'quality_assurance']);
  assert.equal(tasks.every((task) => task.workflowRunId === workflow.id), true);
  assert.equal(project.workspace.id, workflow.workspaceId);
  assert.equal(new Set(tasks.map((task) => task.workspaceId)).size, 1);
  const blocked = await request(`/api/admin/tasks/${tasks.find((task) => task.agentRole === 'frontend_engineer').id}/execute`, { method: 'POST', token: adminToken, body: { input: '実装してください' } });
  assert.equal(blocked.status, 409);
  const check = await request(`/api/admin/projects/${project.id}/quality-checks`, { method: 'POST', token: adminToken, body: { result: 'failed', evidence: '予約ボタンのリンクが未設定', category: 'functional' } });
  assert.equal(check.status, 201);
  const current = await (await request(`/api/projects/${project.id}`, { token: adminToken })).json();
  assert.equal(current.status, 'revision');
  assert.deepEqual(current.attentionReasons, ['quality_check_failed']);
  const notifications = await (await request('/api/admin/notifications', { token: adminToken })).json();
  assert.equal(notifications.some((item) => item.type === 'quality_check_failed'), true);
});

test('admin can list a project\'s approval requests and their decisions', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const project = await (await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '承認一覧テスト' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const { token: adminToken } = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  await request(`/api/admin/projects/${project.id}/approvals`, { method: 'POST', token: adminToken, body: { type: 'charge' } });
  const forbidden = await request(`/api/admin/projects/${project.id}/approvals`, { token: customerToken });
  assert.equal(forbidden.status, 403);
  const listed = await request(`/api/admin/projects/${project.id}/approvals`, { token: adminToken });
  assert.equal(listed.status, 200);
  const approvals = await listed.json();
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].type, 'charge');
  assert.equal(approvals[0].status, 'pending');
});

test('payment records are visible to the owning customer and to admins, not to other customers', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token: customerToken } = await registered.json();
  const project = await (await request('/api/projects', { method: 'POST', token: customerToken, body: { name: '決済一覧テスト' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const { token: adminToken } = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  await request(`/api/admin/projects/${project.id}/payments`, { method: 'POST', token: adminToken, body: { amount: 29800, currency: 'jpy' } });
  const ownerView = await (await request(`/api/projects/${project.id}/payments`, { token: customerToken })).json();
  assert.equal(ownerView.length, 1);
  assert.equal(ownerView[0].status, 'PENDING_APPROVAL');
  const adminView = await (await request(`/api/projects/${project.id}/payments`, { token: adminToken })).json();
  assert.equal(adminView.length, 1);
  const otherCustomer = await (await request('/api/auth/register', { method: 'POST', body: { email: 'other@example.com', password: 'a-secure-password' } })).json();
  const denied = await request(`/api/projects/${project.id}/payments`, { token: otherCustomer.token });
  assert.equal(denied.status, 404);
});

test('customer file upload stores content privately and returns metadata only', async () => {
  const registered = await request('/api/auth/register', { method: 'POST', body: { email: 'owner@example.com', password: 'a-secure-password' } });
  const { token } = await registered.json();
  const project = await (await request('/api/projects', { method: 'POST', token, body: { name: 'ファイルテスト' } })).json();
  const response = await request(`/api/projects/${project.id}/files`, { method: 'POST', token, body: { name: 'logo.txt', content: Buffer.from('private').toString('base64'), contentType: 'text/plain' } });
  const file = await response.json();
  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(file, 'content'), false);
});

test('approved HTML artifact can be published without creating another hosting service', async () => {
  const customer = await (await request('/api/auth/register', { method: 'POST', body: { email: 'site@example.com', password: 'a-secure-password' } })).json();
  const project = await (await request('/api/projects', { method: 'POST', token: customer.token, body: { name: '顧客サイト公開' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const admin = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  const artifact = await (await request(`/api/admin/projects/${project.id}/artifacts`, { method: 'POST', token: admin.token, body: { name: 'index.html', version: 1, content: '<!doctype html><title>公開テスト</title>' } })).json();
  const pending = await (await request(`/api/admin/projects/${project.id}/approvals`, { method: 'POST', token: admin.token, body: { type: 'publish' } })).json();
  await request(`/api/admin/approvals/${pending.id}/decision`, { method: 'POST', token: admin.token, body: { status: 'approved' } });
  const publishedResponse = await request(`/api/admin/projects/${project.id}/deploy`, { method: 'POST', token: admin.token, body: {} });
  const published = await publishedResponse.json();
  assert.equal(publishedResponse.status, 201);
  const response = await request(published.url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /公開テスト/);
});

test('custom domain is assigned at publish time and serves the approved artifact', async () => {
  const customer = await (await request('/api/auth/register', { method: 'POST', body: { email: 'domain@example.com', password: 'a-secure-password' } })).json();
  const project = await (await request('/api/projects', { method: 'POST', token: customer.token, body: { name: '独自ドメイン公開' } })).json();
  seedAdmin('admin@example.com', 'another-secure-password');
  const admin = await (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'another-secure-password' } })).json();
  await request(`/api/admin/projects/${project.id}/artifacts`, { method: 'POST', token: admin.token, body: { name: 'index.html', version: 1, content: '<!doctype html><title>独自ドメイン</title>' } });
  const approval = await (await request(`/api/admin/projects/${project.id}/approvals`, { method: 'POST', token: admin.token, body: { type: 'publish' } })).json();
  await request(`/api/admin/approvals/${approval.id}/decision`, { method: 'POST', token: admin.token, body: { status: 'approved' } });
  const publishedResponse = await request(`/api/admin/projects/${project.id}/deploy`, { method: 'POST', token: admin.token, body: { domain: 'shop.example.com' } });
  const published = await publishedResponse.json();
  assert.equal(publishedResponse.status, 201);
  assert.equal(published.customDomain, 'shop.example.com');
  const response = await request(published.url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /独自ドメイン/);
});
