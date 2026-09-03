import http from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { businessConfig } from './business-config.mjs';
import { createProviders, providerStatus } from './providers.mjs';

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 1024 * 1024;
const sessions = new Map();
const users = new Map();
const projects = new Map();
const approvals = new Map();
const tasks = new Map();
const artifacts = new Map();
const qualityChecks = new Map();
const workflowRuns = new Map();
const notifications = new Map();
const files = new Map();
const payments = new Map();
const deployments = new Map();
const operationalSettings = new Map();
const auditLogs = [];
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const PUBLIC_ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const TEAM_STRUCTURE_DOCUMENT = fileURLToPath(new URL('../docs/akinael-ai-team-structure.md', import.meta.url));
const DATA_FILE = process.env.DATA_FILE || '';
const STORAGE_DIR = process.env.STORAGE_DIR || (DATA_FILE ? `${dirname(DATA_FILE)}/uploads` : '');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const providers = createProviders();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const serveStatic = async (response, pathname) => {
  const pages = { '/': 'index.html', '/portal': 'portal/index.html', '/portal/': 'portal/index.html', '/mypage': 'mypage.html', '/admin/': 'admin/index.html', '/legal': 'legal.html', '/payment/success': 'payment-success.html', '/payment/cancel': 'payment-cancel.html', '/robots.txt': 'robots.txt', '/sitemap.xml': 'sitemap.xml' };
  const relativePath = pages[pathname] || (pathname.startsWith('/portal/') ? `portal/${pathname.slice('/portal/'.length)}` : (pathname.startsWith('/admin/') ? `admin/${pathname.slice('/admin/'.length)}` : (pathname.startsWith('/assets/') ? pathname.slice(1) : null)));
  if (!relativePath || relativePath.includes('..')) return false;
  try {
    const filePath = join(PUBLIC_ROOT, relativePath);
    const publicRelativePath = relative(PUBLIC_ROOT, filePath);
    if (publicRelativePath.startsWith(`..${sep}`) || publicRelativePath === '..') return false;
    const body = await readFile(filePath);
    const headers = {
      'content-type': MIME_TYPES[extname(relativePath)] || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'content-security-policy': "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'"
    };
    if (pathname === '/mypage' || pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/payment/')) {
      headers['x-robots-tag'] = 'noindex, nofollow';
      headers['cache-control'] = 'no-store';
    } else if (pathname.startsWith('/assets/')) {
      headers['cache-control'] = 'public, max-age=86400';
    }
    response.writeHead(200, headers);
    response.end(body);
    return true;
  } catch (caught) {
    if (caught?.code === 'ENOENT') return false;
    throw caught;
  }
};

const json = (response, status, payload, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(payload));
};
const error = (response, status, message) => json(response, status, { error: { message } });
const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  hash: scryptSync(password, salt, 64).toString('hex')
});
const verifyPassword = (password, record) => {
  const actual = scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const recordAudit = (actor, action, resourceType, resourceId, metadata = {}) => {
  auditLogs.push({ id: randomUUID(), actorId: actor.id, actorRole: actor.role, action, resourceType, resourceId, metadata, createdAt: new Date().toISOString() });
};
const rateLimited = (request) => {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
};
const readBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('request body is too large'));
  });
  request.on('end', () => resolve(body ? JSON.parse(body) : {}));
  request.on('error', reject);
});
const cookieValue = (request, name) => request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const authenticate = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || cookieValue(request, 'akinael_session');
  const userId = token && sessions.get(token);
  return userId ? users.get(userId) : null;
};
const requireRole = (request, response, role) => {
  const user = authenticate(request);
  if (!user) { error(response, 401, 'authentication required'); return null; }
  if (user.role !== role) { error(response, 403, 'insufficient permissions'); return null; }
  return user;
};
const projectFor = (user, projectId) => {
  const project = projects.get(projectId);
  return user && project && (user.role === 'admin' || project.ownerId === user.id) ? project : null;
};
const publicUser = ({ id, email, role }) => ({ id, email, role });
const siteSlug = (project) => `project-${project.id.slice(0, 8)}`;
const validDomain = (value) => typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.trim());
const notify = (userId, projectId, type, message) => {
  const notification = { id: randomUUID(), userId, projectId, type, message, readAt: null, createdAt: new Date().toISOString() };
  notifications.set(notification.id, notification);
  return notification;
};
const notifyAdminByEmail = async (admin, subject, message) => {
  if (!admin?.email) return;
  try {
    await providers.notification.send({ recipient: admin.email, subject, message });
  } catch (caught) {
    return false;
  }
  return true;
};

const CHAT_GUARDRAILS = '料金・順位・成果を保証する表現は使わないでください。契約条件や個別見積り、公開・課金・返金・データ削除など不可逆な操作の最終判断は必ず人間の担当者が行う旨を伝え、断定できない事項は「担当者に確認します」と答えてください。簡潔な日本語で答えてください。';
const PRODUCTION_TEAM = [
  { role: 'customer_intake', label: '顧客ヒアリングAI', focus: '顧客の相談内容、店舗情報、目的、制約を整理する', deliverable: 'ヒアリング整理票', dependencies: [] },
  { role: 'project_director', label: '制作ディレクターAI', focus: '案件の方針、優先順位、受け入れ条件を定義する', deliverable: '制作方針・受け入れ条件', dependencies: ['customer_intake'] },
  { role: 'research_strategist', label: '調査・戦略AI', focus: '顧客、競合、地域性、検索意図を調査し改善戦略を組み立てる', deliverable: '改善戦略・調査メモ', dependencies: ['project_director'] },
  { role: 'ux_architect', label: '情報設計・UX AI', focus: 'ページ構成、導線、ユーザー体験、問い合わせ導線を設計する', deliverable: 'サイトマップ・画面設計', dependencies: ['research_strategist'] },
  { role: 'content_editor', label: 'コンテンツ編集AI', focus: '紹介文、見出し、FAQ、行動喚起を作成し事実性と読みやすさを確認する', deliverable: '掲載原稿・FAQ', dependencies: ['ux_architect'] },
  { role: 'visual_designer', label: 'ビジュアルデザインAI', focus: 'ブランド、レイアウト、配色、画像方針を設計する', deliverable: 'デザイン仕様・ビジュアル案', dependencies: ['ux_architect'] },
  { role: 'frontend_engineer', label: '実装AI', focus: '承認された設計と原稿をアクセシブルで保守しやすいWebページへ実装する', deliverable: '実装済みHTML・アセット', dependencies: ['content_editor', 'visual_designer'] },
  { role: 'seo_accessibility', label: 'SEO・アクセシビリティAI', focus: '構造化、検索導線、表示品質、アクセシビリティを検証して改善案を出す', deliverable: 'SEO・アクセシビリティ点検表', dependencies: ['frontend_engineer'] },
  { role: 'quality_assurance', label: '品質保証AI', focus: '要件、文章、デザイン、機能、表示、法務上の注意点を横断確認する', deliverable: '品質検査レポート', dependencies: ['frontend_engineer', 'seo_accessibility'] }
];
const productionTeamByRole = Object.fromEntries(PRODUCTION_TEAM.map((agent) => [agent.role, agent]));
const pricingContext = () => {
  const { trial, mini, operations, advanced, instagramAds, websiteProduction, decisionCategories, approvalRequiredFor, explicitApprovalExamples, ambiguousApprovalExamples } = businessConfig.pricing;
  return `正式料金ルール（最優先）: お試しは${trial.amount}円、${mini.name}は月額${mini.monthlyAmount}円、${operations.name}は月額${operations.monthlyAmount}円、${advanced.name}は月額${advanced.monthlyAmount}円。${instagramAds.name}は発展運用契約者のみ利用でき、広告費の${instagramAds.feeRate * 100}%（最低月額${instagramAds.minimumMonthlyFee}円）、広告費は顧客負担。Webサイト正式制作・公開は${websiteProduction.startingAmount}円〜。相談内容は「${decisionCategories.join('」「')}」のいずれかに分類する。顧客にはAPIトークン、モデル使用量、AC等の内部指標を表示しない。相談だけでは契約・申込み・承認とみなさず、追加料金が必要な場合は内容、料金、作業範囲を先に説明する。明確な承認例: ${explicitApprovalExamples.join('、')}。曖昧な表現は承認ではない: ${ambiguousApprovalExamples.join('、')}。承認前は${approvalRequiredFor.join('、')}を実行しない。${businessConfig.pricingDecisionRule} ${businessConfig.humanApprovalRule}`;
};
const publicPricing = {
  currency: businessConfig.currency,
  taxIncluded: businessConfig.taxIncluded,
  pricingPolicyVersion: businessConfig.pricingPolicyVersion,
  pricing: {
    trial: businessConfig.pricing.trial,
    mini: businessConfig.pricing.mini,
    operations: businessConfig.pricing.operations,
    advanced: businessConfig.pricing.advanced,
    instagramAds: businessConfig.pricing.instagramAds,
    websiteProduction: businessConfig.pricing.websiteProduction,
    options: { examples: businessConfig.pricing.options.examples }
  },
  refundPolicy: businessConfig.refundPolicy,
  termsNotice: businessConfig.termsNotice
};
const buildPublicChatSystemPrompt = () => `あなたは小規模店舗向けWeb改善サービス「アキナエルAI」の窓口AIです。あなたはまだ会員登録前の訪問者と会話しています。\n${pricingContext()}\n${businessConfig.termsNotice}\n個別の申し込みや詳しい相談は、マイページでの会員登録後に案内してください。\n${CHAT_GUARDRAILS}`;
const buildCustomerChatSystemPrompt = (project) => `あなたは小規模店舗向けWeb改善サービス「アキナエルAI」の担当AIです。ログイン済みの顧客の案件「${project.name}」（現在のステータス: ${project.status}）についてチャットで相談を受けています。\n${pricingContext()}\n${CHAT_GUARDRAILS}`;
const readTeamStructureDocument = () => {
  try {
    return readFileSync(TEAM_STRUCTURE_DOCUMENT, 'utf8');
  } catch {
    return null;
  }
};
const buildCommanderSystemPrompt = (project, teamStructure) => `あなたは小規模店舗向けWeb改善サービス「アキナエルAI」の管理者向け司令塔AIです。管理者から案件「${project.name}」（現在のステータス: ${project.status}）について運用上の指示や相談を受けています。\n以下のチーム構成書を、この指示を振り分ける際の最優先の業務資料として確認してください。資料にない役割を勝手に追加せず、担当ロール、成果物、依存関係、料金・承認ルールに従って指示を整理してください。\n--- チーム構成書ここから ---\n${teamStructure}\n--- チーム構成書ここまで ---\n${pricingContext()}\nあなたに公開・課金・返金・データ削除などの不可逆操作を直接実行する権限はなく、それらは既存の承認フローでのみ実行される旨を伝えてください。\n${CHAT_GUARDRAILS}`;
const buildProductionTaskSystemPrompt = (project, agent) => `あなたは案件「${project.name}」の${agent.label}です。制作チーム内で担当する専門領域は「${agent.focus}」です。前工程の成果物を尊重し、担当範囲を越える断定や変更はせず、次の担当者が使えるように「${agent.deliverable}」として具体的に整理してください。未確認の事実は推測せず、確認事項として明示してください。${CHAT_GUARDRAILS}`;

const persistStore = () => {
  if (!DATA_FILE) return;
  const snapshot = { users: [...users.values()], projects: [...projects.values()], approvals: [...approvals.values()], tasks: [...tasks.values()], artifacts: [...artifacts.values()], qualityChecks: [...qualityChecks.values()], workflowRuns: [...workflowRuns.values()], notifications: [...notifications.values()], files: [...files.values()], payments: [...payments.values()], deployments: [...deployments.values()], operationalSettings: [...operationalSettings.entries()], auditLogs };
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(snapshot), { mode: 0o600 });
};

const loadStore = () => {
  if (!DATA_FILE || process.env.NODE_ENV === 'test') return;
  try {
    const snapshot = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    for (const item of snapshot.users || []) users.set(item.id, item);
    for (const item of snapshot.projects || []) projects.set(item.id, item);
    for (const item of snapshot.approvals || []) approvals.set(item.id, item);
    for (const item of snapshot.tasks || []) tasks.set(item.id, item);
    for (const item of snapshot.artifacts || []) artifacts.set(item.id, item);
    for (const item of snapshot.qualityChecks || []) qualityChecks.set(item.id, item);
    for (const item of snapshot.workflowRuns || []) workflowRuns.set(item.id, item);
    for (const item of snapshot.notifications || []) notifications.set(item.id, item);
    for (const item of snapshot.files || []) files.set(item.id, item);
    for (const item of snapshot.payments || []) payments.set(item.id, item);
    for (const item of snapshot.deployments || []) deployments.set(item.id, item);
    for (const [key, value] of snapshot.operationalSettings || []) operationalSettings.set(key, value);
    auditLogs.push(...(snapshot.auditLogs || []));
  } catch (caught) {
    if (caught.code !== 'ENOENT') throw caught;
  }
};

export const seedAdmin = (email, password) => {
  if (!email || !password || password.length < 12) throw new Error('admin email and password of at least 12 characters are required');
  const normalizedEmail = email.trim().toLowerCase();
  const existing = [...users.values()].find((user) => user.email === normalizedEmail && user.role === 'admin');
  if (existing) return existing.id;
  const id = randomUUID();
  users.set(id, { id, email: normalizedEmail, role: 'admin', ...hashPassword(password) });
  persistStore();
  return id;
};

export const resetStore = () => {
  sessions.clear(); users.clear(); projects.clear(); approvals.clear(); tasks.clear(); artifacts.clear(); qualityChecks.clear(); workflowRuns.clear(); notifications.clear(); files.clear(); payments.clear(); deployments.clear(); operationalSettings.clear(); rateLimits.clear(); auditLogs.length = 0;
};

export const createApp = () => http.createServer(async (request, response) => {
  try {
    if (rateLimited(request)) return error(response, 429, 'too many requests');
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    if (method === 'GET' && url.pathname === '/health') return json(response, 200, { status: 'ok' });
    if (method === 'GET' && url.pathname === '/api/public/pricing') return json(response, 200, publicPricing);
    if (method === 'POST' && url.pathname === '/api/public/chat') {
      const body = await readBody(request);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) return error(response, 400, 'message must be a non-empty string of at most 2000 characters');
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      if (!history.every((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.length <= 2000)) return error(response, 400, 'history must contain valid role and content entries');
      try {
        const result = await providers.llm.generate({ role: 'public_concierge', system: buildPublicChatSystemPrompt(), messages: [...history.map(({ role, content }) => ({ role, content })), { role: 'user', content: body.message.trim() }] });
        return json(response, 200, { reply: result.output });
      } catch (caught) {
        return error(response, 502, 'AI provider request failed');
      }
    }
    if (method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/assets/')) {
      const host = (request.headers.host || '').split(':')[0].toLowerCase();
      const deployment = [...deployments.values()].find((item) => item.customDomain === host && item.status === 'published');
      if (deployment) {
        const artifact = artifacts.get(deployment.artifactId);
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https:; script-src 'none'" });
        return response.end(artifact.content);
      }
    }
    if (method === 'GET' && parts[0] === 'sites' && parts[1]) {
      const deployment = [...deployments.values()].find((item) => item.slug === parts[1] && item.status === 'published');
      if (!deployment) return error(response, 404, 'site not found');
      const artifact = artifacts.get(deployment.artifactId);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https:; script-src 'none'" });
      return response.end(artifact.content);
    }
    if (method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readBody(request);
      if (typeof body.email !== 'string' || !body.email.includes('@') || typeof body.password !== 'string' || body.password.length < 12) return error(response, 400, 'valid email and password of at least 12 characters are required');
      const email = body.email.trim().toLowerCase();
      if ([...users.values()].some((user) => user.email === email)) return error(response, 409, 'email is already registered');
      const id = randomUUID();
      users.set(id, { id, email, role: 'customer', ...hashPassword(body.password) });
      const token = randomBytes(32).toString('hex'); sessions.set(token, id);
      recordAudit(users.get(id), 'user.registered', 'user', id);
      persistStore();
      return json(response, 201, { token, user: publicUser(users.get(id)) }, { 'set-cookie': `akinael_session=${token}; HttpOnly; SameSite=Lax; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
    }
    if (method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      const username = String(body.username || '').trim().toLowerCase();
      const user = email
        ? [...users.values()].find((candidate) => candidate.email === email)
        : username === 'admin' ? [...users.values()].find((candidate) => candidate.role === 'admin') : null;
      if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user)) return error(response, 401, 'invalid credentials');
      const token = randomBytes(32).toString('hex'); sessions.set(token, user.id);
      recordAudit(user, 'user.logged_in', 'user', user.id);
      return json(response, 200, { token, user: publicUser(user) }, { 'set-cookie': `akinael_session=${token}; HttpOnly; SameSite=Lax; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
    }

    const user = authenticate(request);
    if (method === 'GET' && url.pathname === '/api/auth/me') {
      if (!user) return error(response, 401, 'authentication required');
      return json(response, 200, { user: publicUser(user) });
    }
    if (method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || cookieValue(request, 'akinael_session');
      if (!user || !token) return error(response, 401, 'authentication required');
      sessions.delete(token); recordAudit(user, 'user.logged_out', 'user', user.id); persistStore();
      return json(response, 200, { status: 'ok' }, { 'set-cookie': 'akinael_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/' });
    }
    if (method === 'POST' && url.pathname === '/api/projects') {
      if (!user) return error(response, 401, 'authentication required');
      if (user.role !== 'customer') return error(response, 403, 'customers only');
      const body = await readBody(request);
      if (typeof body.name !== 'string' || !body.name.trim()) return error(response, 400, 'project name is required');
      const project = { id: randomUUID(), ownerId: user.id, name: body.name.trim(), status: 'intake', needsAttention: false, attentionReasons: [], messages: [], workspace: { id: randomUUID(), name: `${body.name.trim()} 制作ワークスペース`, team: PRODUCTION_TEAM.map(({ role, label, focus, deliverable, dependencies }) => ({ role, label, focus, deliverable, dependencies })) }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      projects.set(project.id, project); recordAudit(user, 'project.created', 'project', project.id);
      persistStore();
      return json(response, 201, project);
    }
    if (method === 'GET' && url.pathname === '/api/projects') {
      if (!user) return error(response, 401, 'authentication required');
      return json(response, 200, [...projects.values()].filter((project) => user.role === 'admin' || project.ownerId === user.id));
    }
    if (parts[0] === 'api' && parts[1] === 'projects' && parts[2]) {
      const project = projectFor(user, parts[2]);
      if (!user || !project) return error(response, 404, 'project not found');
      if (method === 'GET' && parts.length === 3) return json(response, 200, project);
      if (method === 'POST' && parts[3] === 'messages') {
        const body = await readBody(request);
        if (typeof body.content !== 'string' || !body.content.trim()) return error(response, 400, 'message content is required');
        const message = { id: randomUUID(), authorId: user.id, authorRole: user.role, content: body.content.trim(), createdAt: new Date().toISOString() };
        project.messages.push(message); project.needsAttention = false; project.attentionReasons = [];
        recordAudit(user, 'message.created', 'project', project.id, { messageId: message.id });
        let reply = null;
        if (user.role === 'customer') {
          try {
            const recent = project.messages.slice(-12).map((item) => ({ role: item.authorRole === 'customer' ? 'user' : 'assistant', content: item.content }));
            const result = await providers.llm.generate({ role: 'customer_concierge', system: buildCustomerChatSystemPrompt(project), messages: recent });
            reply = { id: randomUUID(), authorId: 'ai-assistant', authorRole: 'assistant', content: result.output, createdAt: new Date().toISOString() };
            project.messages.push(reply);
            recordAudit({ id: 'ai-assistant', role: 'assistant' }, 'message.ai_replied', 'project', project.id, { messageId: reply.id, model: result.model });
          } catch (caught) {
            project.needsAttention = true; project.attentionReasons = ['customer_message_unanswered'];
            const admin = [...users.values()].find((candidate) => candidate.role === 'admin');
            if (admin) {
              const message = `案件「${project.name}」に顧客メッセージがあります（AI応答失敗）`;
              notify(admin.id, project.id, 'customer_message', message);
              await notifyAdminByEmail(admin, 'AI応答に失敗しました', message);
            }
          }
        }
        project.updatedAt = new Date().toISOString();
        persistStore();
        return json(response, 201, { message, reply });
      }
      if (method === 'GET' && parts[3] === 'tasks') return json(response, 200, [...tasks.values()].filter((task) => task.projectId === project.id));
      if (method === 'GET' && parts[3] === 'artifacts') return json(response, 200, [...artifacts.values()].filter((artifact) => artifact.projectId === project.id));
      if (method === 'GET' && parts[3] === 'notifications') return json(response, 200, [...notifications.values()].filter((notification) => notification.userId === user.id && notification.projectId === project.id));
      if (method === 'GET' && parts[3] === 'payments') return json(response, 200, [...payments.values()].filter((payment) => payment.projectId === project.id));
      if (method === 'POST' && parts[3] === 'files') {
        const body = await readBody(request);
        if (typeof body.name !== 'string' || typeof body.content !== 'string' || Buffer.byteLength(body.content, 'base64') > MAX_BODY_BYTES) return error(response, 400, 'file name and base64 content are required');
        const fileId = randomUUID();
        const storageKey = `${project.id}/${fileId}.bin`;
        const file = { id: fileId, projectId: project.id, ownerId: user.id, name: body.name.trim(), contentType: body.contentType || 'application/octet-stream', storageKey, storageProvider: providers.storage.name, content: STORAGE_DIR && providers.storage.name === 'local' ? undefined : body.content, createdAt: new Date().toISOString() };
        if (providers.storage.mode === 'connected') {
          await providers.storage.putObject({ key: storageKey, body: Buffer.from(body.content, 'base64'), contentType: file.contentType });
          file.content = undefined;
        } else if (STORAGE_DIR) {
          mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
          file.storageKey = `${fileId}.bin`;
          await writeFile(`${STORAGE_DIR}/${file.storageKey}`, Buffer.from(body.content, 'base64'), { mode: 0o600 });
        }
        files.set(file.id, file); recordAudit(user, 'file.uploaded', 'file', file.id, { projectId: project.id });
        persistStore();
        const { content, ...metadata } = file;
        return json(response, 201, metadata);
      }
    }
    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      return json(response, 200, [...projects.values()].map(({ ownerId, ...project }) => ({ ...project, ownerId })));
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'approvals') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const body = await readBody(request);
      const allowed = ['price_confirmation', 'scope_change', 'charge', 'refund', 'publish', 'delivery', 'delete_data'];
      if (!allowed.includes(body.type)) return error(response, 400, 'unsupported approval type');
      const approval = { id: randomUUID(), projectId: project.id, type: body.type, status: 'pending', requestedBy: admin.id, createdAt: new Date().toISOString() };
      approvals.set(approval.id, approval); project.needsAttention = true; project.attentionReasons = [`approval_required:${body.type}`];
      recordAudit(admin, 'approval.requested', 'approval', approval.id, { projectId: project.id, type: body.type });
      persistStore();
      return json(response, 201, approval);
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'approvals') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      if (!projects.has(parts[3])) return error(response, 404, 'project not found');
      return json(response, 200, [...approvals.values()].filter((approval) => approval.projectId === parts[3]));
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'approvals' && parts[4] === 'decision') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const approval = approvals.get(parts[3]); if (!approval) return error(response, 404, 'approval not found');
      if (approval.status !== 'pending') return error(response, 409, 'approval is already decided');
      const body = await readBody(request);
      if (!['approved', 'rejected'].includes(body.status)) return error(response, 400, 'status must be approved or rejected');
      approval.status = body.status; approval.decidedBy = admin.id; approval.decidedAt = new Date().toISOString();
      const project = projects.get(approval.projectId); project.needsAttention = false; project.attentionReasons = [];
      recordAudit(admin, `approval.${body.status}`, 'approval', approval.id, { projectId: project.id });
      persistStore();
      return json(response, 200, approval);
    }
    if (method === 'GET' && url.pathname === '/api/admin/audit-logs') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      return json(response, 200, auditLogs);
    }
    if (method === 'GET' && url.pathname === '/api/admin/notifications') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      return json(response, 200, [...notifications.values()].filter((notification) => notification.userId === admin.id));
    }
    if (method === 'GET' && url.pathname === '/api/admin/settings') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      return json(response, 200, Object.fromEntries(operationalSettings));
    }
    if (method === 'GET' && url.pathname === '/api/admin/system-status') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      return json(response, 200, { providers: providerStatus(providers), storageDirectoryConfigured: Boolean(STORAGE_DIR), dataFileConfigured: Boolean(DATA_FILE), checkedAt: new Date().toISOString() });
    }
    if (method === 'PUT' && url.pathname === '/api/admin/settings') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const body = await readBody(request);
      const allowed = ['llmProvider', 'paymentProvider', 'storageProvider', 'notificationProvider', 'trialAmount', 'miniAmount', 'operationsAmount', 'advancedAmount', 'instagramAdsMinimumFee', 'websiteStartingAmount', 'cancellationTerm', 'refundTerms', 'termsReviewed', 'privacyReviewed', 'commerceReviewed', 'refundReviewed'];
      for (const key of allowed) if (Object.hasOwn(body, key)) {
        const value = body[key];
        if (typeof value === 'string') operationalSettings.set(key, value.slice(0, 2000));
        else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000000) operationalSettings.set(key, Math.trunc(value));
        else if (typeof value === 'boolean') operationalSettings.set(key, value);
      }
      recordAudit(admin, 'settings.updated', 'operational_settings', 'global', { keys: Object.keys(body).filter((key) => allowed.includes(key)) });
      persistStore();
      return json(response, 200, Object.fromEntries(operationalSettings));
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'workflow') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      if (!['intake', 'requirements', 'production', 'quality_check', 'revision', 'ready_for_review'].includes(project.status)) return error(response, 409, 'project cannot start workflow from its current status');
      const body = await readBody(request);
      const run = { id: randomUUID(), projectId: project.id, workspaceId: project.workspace.id, status: 'running', steps: PRODUCTION_TEAM.map((agent) => agent.role), currentStep: PRODUCTION_TEAM[0].role, model: body.model || 'adapter/mock', startedAt: new Date().toISOString() };
      workflowRuns.set(run.id, run);
      const createdTasks = PRODUCTION_TEAM.map((agent, index) => { const taskId = randomUUID(); const task = { id: taskId, projectId: project.id, workspaceId: project.workspace.id, workflowRunId: run.id, agentRole: agent.role, agentLabel: agent.label, focus: agent.focus, deliverable: agent.deliverable, dependsOn: agent.dependencies, status: index === 0 ? 'completed' : 'queued', createdAt: new Date().toISOString() }; tasks.set(taskId, task); return task; });
      project.status = 'requirements'; project.updatedAt = new Date().toISOString();
      recordAudit(admin, 'workflow.started', 'workflow_run', run.id, { projectId: project.id, model: run.model });
      persistStore();
      return json(response, 202, { ...run, tasks: createdTasks });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'commander') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const body = await readBody(request);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) return error(response, 400, 'message must be a non-empty string of at most 2000 characters');
      const teamStructure = readTeamStructureDocument();
      if (!teamStructure) return error(response, 503, 'team structure document is unavailable');
      try {
        const result = await providers.llm.generate({ role: 'admin_commander', system: buildCommanderSystemPrompt(project, teamStructure), messages: [{ role: 'user', content: body.message.trim() }] });
        recordAudit(admin, 'commander.instructed', 'project', project.id, { model: result.model });
        return json(response, 200, { reply: result.output });
      } catch (caught) {
        return error(response, 502, 'AI provider request failed');
      }
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'quality-checks') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const body = await readBody(request);
      if (!['passed', 'failed'].includes(body.result) || typeof body.evidence !== 'string' || !body.evidence.trim()) return error(response, 400, 'result and evidence are required');
      const check = { id: randomUUID(), projectId: project.id, result: body.result, evidence: body.evidence.trim(), category: body.category || 'technical', checkedBy: admin.id, createdAt: new Date().toISOString() };
      qualityChecks.set(check.id, check); project.status = body.result === 'passed' ? 'ready_for_review' : 'revision'; project.needsAttention = body.result === 'failed'; project.attentionReasons = body.result === 'failed' ? ['quality_check_failed'] : [];
      if (body.result === 'failed') {
        const message = `案件「${project.name}」の品質検査が不合格です`;
        notify(admin.id, project.id, 'quality_check_failed', message);
        await notifyAdminByEmail(admin, '品質検査が不合格です', message);
      }
      recordAudit(admin, `quality_check.${body.result}`, 'quality_check', check.id, { projectId: project.id });
      persistStore();
      return json(response, 201, check);
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'tasks' && parts[4] === 'execute') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const task = tasks.get(parts[3]); if (!task) return error(response, 404, 'task not found');
      if (task.status === 'completed') return error(response, 409, 'task is already completed');
      const body = await readBody(request);
      if (typeof body.input !== 'string' || !body.input.trim()) return error(response, 400, 'task input is required');
      const agent = productionTeamByRole[task.agentRole];
      const taskProject = projects.get(task.projectId);
      if (agent) {
        const dependencyTasks = [...tasks.values()].filter((candidate) => candidate.workflowRunId === task.workflowRunId && agent.dependencies.includes(candidate.agentRole));
        if (dependencyTasks.some((dependency) => dependency.status !== 'completed')) return error(response, 409, 'all preceding production tasks must be completed first');
      }
      task.status = 'running'; task.startedAt = new Date().toISOString();
      try {
        const result = await providers.llm.generate({ role: task.agentRole, system: agent ? buildProductionTaskSystemPrompt(taskProject, agent) : undefined, input: body.input.trim() });
        task.status = 'completed'; task.output = result.output; task.model = result.model; task.usage = result.usage; task.completedAt = new Date().toISOString();
        recordAudit(admin, 'task.completed', 'task', task.id, { projectId: task.projectId, agentRole: task.agentRole, model: result.model });
        persistStore();
        return json(response, 200, task);
      } catch (caught) {
        task.status = 'failed'; task.error = 'provider request failed';
        recordAudit(admin, 'task.failed', 'task', task.id, { projectId: task.projectId, agentRole: task.agentRole, message: caught.message });
        persistStore();
        return error(response, 502, 'AI provider request failed');
      }
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'quality-checks') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      if (!projects.has(parts[3])) return error(response, 404, 'project not found');
      return json(response, 200, [...qualityChecks.values()].filter((check) => check.projectId === parts[3]));
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'artifacts') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const body = await readBody(request);
      if (typeof body.name !== 'string' || typeof body.content !== 'string') return error(response, 400, 'artifact name and content are required');
      const artifact = { id: randomUUID(), projectId: project.id, name: body.name.trim(), version: Number(body.version || 1), content: body.content, status: 'draft', createdBy: admin.id, createdAt: new Date().toISOString() };
      artifacts.set(artifact.id, artifact); recordAudit(admin, 'artifact.created', 'artifact', artifact.id, { projectId: project.id, version: artifact.version });
      persistStore();
      return json(response, 201, artifact);
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'deploy') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const authorization = [...approvals.values()].find((item) => item.projectId === project.id && item.type === 'publish' && item.status === 'approved');
      if (!authorization) return error(response, 409, 'approved publish authorization is required');
      const latest = [...artifacts.values()].filter((artifact) => artifact.projectId === project.id).sort((left, right) => right.version - left.version)[0];
      if (!latest || typeof latest.content !== 'string') return error(response, 409, 'an HTML artifact is required');
      const body = await readBody(request);
      const requestedDomain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
      if (requestedDomain && !validDomain(requestedDomain)) return error(response, 400, 'a valid custom domain is required');
      if (requestedDomain && [...deployments.values()].some((item) => item.customDomain === requestedDomain && item.projectId !== project.id && item.status === 'published')) return error(response, 409, 'custom domain is already assigned');
      const deployment = { id: randomUUID(), projectId: project.id, artifactId: latest.id, slug: siteSlug(project), customDomain: requestedDomain || null, status: 'published', publishedBy: admin.id, publishedAt: new Date().toISOString() };
      for (const current of deployments.values()) if (current.projectId === project.id) current.status = 'superseded';
      deployments.set(deployment.id, deployment); project.status = 'published'; project.needsAttention = false; project.attentionReasons = []; project.updatedAt = deployment.publishedAt;
      recordAudit(admin, 'site.published', 'deployment', deployment.id, { projectId: project.id, artifactId: latest.id, slug: deployment.slug });
      persistStore();
      return json(response, 201, { ...deployment, url: `/sites/${deployment.slug}` });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'payments') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const project = projects.get(parts[3]); if (!project) return error(response, 404, 'project not found');
      const body = await readBody(request);
      if (!Number.isInteger(body.amount) || body.amount <= 0 || typeof body.currency !== 'string') return error(response, 400, 'positive integer amount and currency are required');
      const payment = { id: randomUUID(), projectId: project.id, amount: body.amount, currency: body.currency.toUpperCase(), status: businessConfig.pricing.pendingApprovalStatus, provider: body.provider || 'manual-adapter', createdAt: new Date().toISOString() };
      payments.set(payment.id, payment); recordAudit(admin, 'payment.created', 'payment', payment.id, { projectId: project.id, amount: payment.amount });
      persistStore();
      return json(response, 201, payment);
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'payments' && parts[4] === 'checkout') {
      const admin = requireRole(request, response, 'admin'); if (!admin) return;
      const payment = payments.get(parts[3]); if (!payment) return error(response, 404, 'payment not found');
      const approval = [...approvals.values()].find((item) => item.projectId === payment.projectId && item.type === 'charge' && item.status === 'approved');
      if (!approval) return error(response, 409, 'approved charge authorization is required');
      const body = await readBody(request);
      try {
        const checkout = await providers.payment.createCheckout({ amount: payment.amount, currency: payment.currency, reference: `アキナエルAI ${payment.projectId}`, successUrl: body.successUrl || `${PUBLIC_URL}/payment/success`, cancelUrl: body.cancelUrl || `${PUBLIC_URL}/payment/cancel` });
        Object.assign(payment, checkout); payment.updatedAt = new Date().toISOString();
        recordAudit(admin, 'payment.checkout_created', 'payment', payment.id, { projectId: payment.projectId, provider: providers.payment.name });
        persistStore();
        return json(response, 200, payment);
      } catch (caught) {
        recordAudit(admin, 'payment.checkout_failed', 'payment', payment.id, { projectId: payment.projectId, message: caught.message });
        return error(response, 502, 'payment provider request failed');
      }
    }
    if (method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin-login')) {
      response.writeHead(302, { location: '/admin/', 'cache-control': 'no-store' });
      return response.end();
    }
    if (method === 'GET' && await serveStatic(response, url.pathname)) return;
    return error(response, 404, 'not found');
  } catch (caught) {
    if (caught instanceof SyntaxError) return error(response, 400, 'request body must be valid JSON');
    return error(response, 500, 'internal server error');
  }
});

loadStore();

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) seedAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

if (process.argv[1] === new URL(import.meta.url).pathname) createApp().listen(PORT, () => console.log(`akinael backend listening on http://localhost:${PORT}`));
