import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, resetStore, seedAdmin } from '../src/server.mjs';
import { businessConfig } from '../src/business-config.mjs';

let server;
let baseUrl;
const request = (path, options = {}) => fetch(`${baseUrl}${path}`, { headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) }, ...options, body: options.body && JSON.stringify(options.body) });

test.beforeEach(async () => {
  resetStore();
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(() => server.close());

test('frontend pages and project assets are served with the expected indexing boundary', async () => {
  const publicPage = await fetch(`${baseUrl}/`);
  assert.equal(publicPage.status, 200);
  assert.match(publicPage.headers.get('content-type'), /text\/html/);
  assert.match(await publicPage.text(), /アキナエルAI/);

  const customerPage = await fetch(`${baseUrl}/mypage`);
  assert.equal(customerPage.status, 200);
  assert.equal(customerPage.headers.get('x-robots-tag'), 'noindex, nofollow');

  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  assert.equal(adminPage.headers.get('x-robots-tag'), 'noindex, nofollow');

  const logo = await fetch(`${baseUrl}/assets/logos/logo-horizontal.svg`);
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/svg\+xml/);
});

test('public pricing uses the business plan and exposes the provisional refund policy', async () => {
  const response = await fetch(`${baseUrl}/api/public/pricing`);
  const config = await response.json();
  assert.equal(response.status, 200);
  assert.equal(config.pricing.trialPack.standardAmount, 29800);
  assert.equal(config.pricing.trialPack.monitorAmount, 19800);
  assert.equal(config.pricing.improvementTeam.monthlyAmount, 19800);
  assert.deepEqual(config.refundPolicy, businessConfig.refundPolicy);
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
  const task = workflow.tasks.find((item) => item.agentRole === 'requirements');
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
  assert.deepEqual(tasks.map((task) => task.agentRole), ['customer_intake', 'requirements', 'production', 'quality_check']);
  assert.equal(tasks.every((task) => task.workflowRunId === workflow.id), true);
  const check = await request(`/api/admin/projects/${project.id}/quality-checks`, { method: 'POST', token: adminToken, body: { result: 'failed', evidence: '予約ボタンのリンクが未設定', category: 'functional' } });
  assert.equal(check.status, 201);
  const current = await (await request(`/api/projects/${project.id}`, { token: adminToken })).json();
  assert.equal(current.status, 'revision');
  assert.deepEqual(current.attentionReasons, ['quality_check_failed']);
  const notifications = await (await request('/api/admin/notifications', { token: adminToken })).json();
  assert.equal(notifications.some((item) => item.type === 'quality_check_failed'), true);
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
  const response = await fetch(`${baseUrl}${published.url}`);
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
  const response = await fetch(`${baseUrl}${published.url}`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /独自ドメイン/);
});
