const one = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];

const header = one('[data-header]');
if (header) {
  const syncHeader = () => header.classList.toggle('scrolled', scrollY > 20);
  syncHeader();
  addEventListener('scroll', syncHeader, { passive: true });
}

const menuButton = one('[data-menu-button]');
const nav = one('[data-nav]');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  all('a', nav).forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));
}

const reveals = all('.reveal');
if (reveals.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((element) => observer.observe(element));
}

const customerTokenKey = 'customer-token';

{
  const publicChatPanel = one('[data-public-chat-panel]');
  const publicChatToggle = one('[data-public-chat-toggle]');
  if (publicChatPanel && publicChatToggle) {
    const publicChatEscape = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
    const publicChatMessages = one('[data-public-chat-messages]');
    const publicChatForm = one('[data-public-chat-form]');
    let publicChatHistory = [];
    const setPublicChatOpen = (open) => {
      publicChatPanel.hidden = !open;
      publicChatToggle.setAttribute('aria-expanded', String(open));
    };
    publicChatToggle.addEventListener('click', () => setPublicChatOpen(publicChatPanel.hidden));
    one('[data-public-chat-close]')?.addEventListener('click', () => setPublicChatOpen(false));
    publicChatForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = one('input', publicChatForm);
      const message = input.value.trim();
      if (!message) return;
      input.value = '';
      publicChatMessages.insertAdjacentHTML('beforeend', `<article class="message customer"><div><p>${publicChatEscape(message)}</p></div></article>`);
      publicChatMessages.insertAdjacentHTML('beforeend', '<article class="message assistant typing" data-public-chat-typing><img src="/assets/illustrations/ai-assistant-avatar.png" alt=""><div><i></i><i></i><i></i></div></article>');
      publicChatMessages.scrollTop = publicChatMessages.scrollHeight;
      try {
        const response = await fetch('/api/public/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, history: publicChatHistory.slice(-8) }) });
        if (!response.ok) throw new Error();
        const body = await response.json();
        publicChatHistory = [...publicChatHistory, { role: 'user', content: message }, { role: 'assistant', content: body.reply }].slice(-8);
        one('[data-public-chat-typing]')?.remove();
        publicChatMessages.insertAdjacentHTML('beforeend', `<article class="message assistant"><img src="/assets/illustrations/ai-assistant-avatar.png" alt=""><div><p>${publicChatEscape(body.reply)}</p></div></article>`);
      } catch {
        one('[data-public-chat-typing]')?.remove();
        publicChatMessages.insertAdjacentHTML('beforeend', '<article class="message assistant"><img src="/assets/illustrations/ai-assistant-avatar.png" alt=""><div><p>現在AIに接続できません。時間をおいて再度お試しいただくか、会員登録後にマイページからご相談ください。</p></div></article>');
      }
      publicChatMessages.scrollTop = publicChatMessages.scrollHeight;
    });
  }
}

const authDialog = one('[data-auth-dialog]');
if (authDialog) {
  const authForm = one('[data-auth-form]');
  const authStatus = one('[data-auth-status]');
  const authTitle = one('[data-auth-title]');
  const authSubtitle = one('[data-auth-subtitle]');
  const authSubmit = one('[data-auth-submit]');
  const authHint = one('[data-auth-hint]');
  const authSwitchLabel = one('[data-auth-switch-label]');
  const authSwitchButton = one('[data-auth-switch]');
  const authPasswordField = one('input[name="password"]', authForm);
  const authCopy = {
    register: { title: '無料相談をはじめる', subtitle: 'メールアドレスとパスワードでアカウントを作成します。', submit: 'アカウントを作成して相談をはじめる', switchLabel: 'すでにアカウントをお持ちですか？', switchAction: 'ログインはこちら', switchTo: 'login', autocomplete: 'new-password' },
    login: { title: 'マイページへログイン', subtitle: '登録済みのメールアドレスとパスワードを入力してください。', submit: 'ログインする', switchLabel: 'はじめてのご利用ですか？', switchAction: '新規登録はこちら', switchTo: 'register', autocomplete: 'current-password' }
  };
  const authErrors = {
    'valid email and password of at least 12 characters are required': 'メールアドレスと12文字以上のパスワードを入力してください。',
    'email is already registered': 'このメールアドレスは既に登録されています。ログインをお試しください。',
    'invalid credentials': 'メールアドレスまたはパスワードが正しくありません。'
  };
  let authMode = 'register';
  const applyAuthMode = (mode) => {
    authMode = mode;
    const copy = authCopy[mode];
    authTitle.textContent = copy.title;
    authSubtitle.textContent = copy.subtitle;
    authSubmit.textContent = copy.submit;
    authSwitchLabel.textContent = copy.switchLabel;
    authSwitchButton.textContent = copy.switchAction;
    authHint.hidden = mode !== 'register';
    authPasswordField.autocomplete = copy.autocomplete;
    all('[data-auth-tab]').forEach((button) => button.classList.toggle('active', button.dataset.authTab === mode));
    authStatus.textContent = '';
  };
  const openAuthDialog = (mode) => {
    if (localStorage.getItem(customerTokenKey)) { location.href = '/mypage'; return; }
    applyAuthMode(mode);
    authForm.reset();
    authDialog.showModal();
  };
  all('[data-auth-open]').forEach((trigger) => trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthDialog(trigger.dataset.authOpen || 'register');
  }));
  all('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => applyAuthMode(button.dataset.authTab)));
  authSwitchButton.addEventListener('click', () => applyAuthMode(authCopy[authMode].switchTo));
  all('[data-auth-close]').forEach((button) => button.addEventListener('click', () => authDialog.close()));
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authStatus.textContent = authMode === 'register' ? 'アカウントを作成しています…' : '認証しています…';
    const values = Object.fromEntries(new FormData(authForm).entries());
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || '処理に失敗しました');
      localStorage.setItem(customerTokenKey, result.token);
      authStatus.textContent = 'ログインしました。マイページへ移動します…';
      setTimeout(() => { location.href = '/mypage'; }, 400);
    } catch (caught) {
      authStatus.textContent = authErrors[caught.message] || caught.message;
    }
  });
  const requestedAuthMode = new URLSearchParams(location.search).get('auth');
  if (requestedAuthMode === 'login' || requestedAuthMode === 'register') openAuthDialog(requestedAuthMode);
}

const workspaceMain = one('#workspace');
if (document.body.classList.contains('customer-app') && workspaceMain) {
  const token = localStorage.getItem(customerTokenKey);
  const goToLogin = () => { localStorage.removeItem(customerTokenKey); location.href = '/?auth=login'; };
  if (!token) {
    goToLogin();
  } else {
    const todayLabel = one('[data-today]');
    if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const authHeaders = { authorization: `Bearer ${token}` };
    const statusLabels = {
      intake: { status: '相談受付中', next: 'まずは気になることを教えてください' },
      requirements: { status: '内容を整理中', next: 'AIが要件を整理しています' },
      production: { status: '制作中', next: '試作の作成を進めています' },
      quality_check: { status: 'AI検査中', next: '品質チェックを行っています' },
      revision: { status: '修正対応中', next: '修正内容を反映しています' },
      ready_for_review: { status: '試作を確認中', next: '試作内容をご確認ください' },
      published: { status: '公開済み', next: '公開後の改善もご相談いただけます' }
    };
    fetch('/api/auth/me', { headers: authHeaders })
      .then((response) => { if (!response.ok) throw new Error('unauthenticated'); return response.json(); })
      .then(({ user }) => {
        if (user.role !== 'customer') throw new Error('not a customer account');
        const displayName = user.email.split('@')[0];
        one('[data-user-name]').textContent = displayName;
        one('[data-user-avatar]').textContent = displayName.slice(0, 1).toUpperCase();
        one('[data-user-email]').textContent = user.email;
        return fetch('/api/projects', { headers: authHeaders }).then((response) => response.json());
      })
      .then((projects) => {
        const emptyState = one('[data-empty-state]');
        const projectStrip = one('[data-project-strip]');
        const customerLayout = one('[data-customer-layout]');
        const progressPanel = one('[data-progress-panel]');
        if (!Array.isArray(projects) || !projects.length) {
          if (emptyState) emptyState.hidden = false;
          [projectStrip, customerLayout, progressPanel].forEach((section) => { if (section) section.hidden = true; });
          return;
        }
        const project = [...projects].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0];
        const label = statusLabels[project.status] || { status: project.status, next: 'ご相談内容を確認しています' };
        one('[data-project-title]').textContent = project.name;
        one('[data-project-status-text]').textContent = label.status;
        one('[data-project-next-text]').textContent = label.next;
        window.akinaelCurrentProjectId = project.id;
        window.akinaelRenderCustomerMessages?.(project.messages);
      })
      .catch(goToLogin);
  }
}

one('[data-logout]')?.addEventListener('click', async () => {
  const token = localStorage.getItem(customerTokenKey);
  if (token) {
    try { await fetch('/api/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }); } catch { /* proceed to local logout regardless */ }
  }
  localStorage.removeItem(customerTokenKey);
  location.href = '/';
});

one('[data-start-project]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const status = one('[data-start-project-status]');
  const token = localStorage.getItem(customerTokenKey);
  if (!token) { location.href = '/?auth=login'; return; }
  button.disabled = true;
  status.textContent = 'ご相談を準備しています…';
  try {
    const email = one('[data-user-email]')?.textContent || '';
    const name = `${email.split('@')[0] || 'お客様'}様のご相談`;
    const response = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name }) });
    if (!response.ok) throw new Error();
    location.reload();
  } catch {
    status.textContent = '準備に失敗しました。時間をおいて再度お試しください。';
    button.disabled = false;
  }
});

const appMenu = one('[data-app-menu]');
const appSidebar = one('[data-app-sidebar]');
if (appMenu && appSidebar) appMenu.addEventListener('click', () => appSidebar.classList.toggle('open'));

{
  const chatEscape = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
  const chatAvatar = '/assets/illustrations/ai-assistant-avatar.png';
  window.akinaelRenderCustomerMessages = (list) => {
    const container = one('[data-messages]');
    if (!container) return;
    container.innerHTML = (list || []).map((item) => item.authorRole === 'customer'
      ? `<article class="message customer"><div><p>${chatEscape(item.content)}</p></div></article>`
      : `<article class="message assistant"><img src="${chatAvatar}" alt="アキナエルAI"><div><p>${chatEscape(item.content)}</p></div></article>`).join('');
    container.scrollTop = container.scrollHeight;
  };
  const chatForm = one('[data-chat-form]');
  if (chatForm) {
    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = one('input', chatForm);
      const content = input.value.trim();
      const token = localStorage.getItem(customerTokenKey);
      const projectId = window.akinaelCurrentProjectId;
      if (!content || !token || !projectId) return;
      input.value = '';
      const container = one('[data-messages]');
      container.insertAdjacentHTML('beforeend', `<article class="message customer"><div><p>${chatEscape(content)}</p></div></article>`);
      container.insertAdjacentHTML('beforeend', `<article class="message assistant typing" data-typing><img src="${chatAvatar}" alt=""><div><i></i><i></i><i></i></div></article>`);
      container.scrollTop = container.scrollHeight;
      try {
        const response = await fetch(`/api/projects/${projectId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ content }) });
        if (!response.ok) throw new Error();
        const body = await response.json();
        const replyText = body.reply ? body.reply.content : '確認しました。担当者が内容を見て、追ってご連絡します。';
        one('[data-typing]')?.remove();
        container.insertAdjacentHTML('beforeend', `<article class="message assistant"><img src="${chatAvatar}" alt="アキナエルAI"><div><p>${chatEscape(replyText)}</p></div></article>`);
      } catch {
        one('[data-typing]')?.remove();
        container.insertAdjacentHTML('beforeend', `<article class="message assistant"><img src="${chatAvatar}" alt="アキナエルAI"><div><p>現在AIに接続できません。時間をおいて再度お試しください。</p></div></article>`);
      }
      container.scrollTop = container.scrollHeight;
    });
  }
}

const previewDialog = one('[data-preview-dialog]');
one('[data-preview-open]')?.addEventListener('click', () => previewDialog?.showModal());
one('[data-preview-close]')?.addEventListener('click', () => previewDialog?.close());
previewDialog?.addEventListener('click', (event) => { if (event.target === previewDialog) previewDialog.close(); });
one('[data-approve]')?.addEventListener('click', (event) => {
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = '✓ 承認済み';
  one('[data-approval-message]').hidden = false;
});

const adminMenu = one('[data-admin-menu]');
const projectList = one('[data-project-list]');
const projectListClose = document.createElement('button');
projectListClose.type = 'button'; projectListClose.className = 'project-list-close';
projectListClose.setAttribute('aria-label', '案件メニューを閉じる'); projectListClose.textContent = '×';
projectList?.querySelector('header')?.append(projectListClose);
const projectListBackdrop = document.createElement('button');
projectListBackdrop.type = 'button'; projectListBackdrop.className = 'project-list-backdrop';
projectListBackdrop.setAttribute('aria-label', '案件メニューを閉じる'); document.body.append(projectListBackdrop);
const projectListCloseButtons = [projectListClose, projectListBackdrop];
const setProjectListOpen = (open) => {
  projectList?.classList.toggle('open', open);
  projectListCloseButtons.forEach((button) => { button.hidden = !open; });
  adminMenu?.setAttribute('aria-expanded', String(open));
};
if (adminMenu && projectList) adminMenu.addEventListener('click', () => setProjectListOpen(!projectList.classList.contains('open')));
projectListCloseButtons.forEach((button) => button.addEventListener('click', () => setProjectListOpen(false)));
setProjectListOpen(false);

const dashboardPanel = document.createElement('section');
dashboardPanel.className = 'task-dashboard admin-section'; dashboardPanel.dataset.dashboard = '';
dashboardPanel.innerHTML = '<header><div><span class="eyebrow">TODAY\'S WORK</span><h3>対応が必要なタスク</h3></div><strong>4件</strong></header><ul><li><span class="task-priority high">高</span><div><strong>トップページ デザイン案の確定</strong><small>Yamada Coffee　承認待ち</small></div><button data-review>確認する</button></li><li><span class="task-priority high">高</span><div><strong>公開前の品質チェック</strong><small>花のアトリエ Hana　期限：今日</small></div><button data-review>確認する</button></li><li><span class="task-priority medium">中</span><div><strong>商品ページの実装方針を確認</strong><small>ベーカリー ル・ソレイユ　レビュー待ち</small></div><button data-review>確認する</button></li><li><span class="task-priority medium">中</span><div><strong>顧客からの修正依頼に返信</strong><small>雑貨店 kokochi　未対応メッセージ</small></div><button data-review>確認する</button></li></ul>';
one('.admin-center')?.prepend(dashboardPanel);
const headerDashboard = document.createElement('button');
headerDashboard.type = 'button'; headerDashboard.className = 'dashboard-link'; headerDashboard.title = 'ダッシュボードへ戻る';
headerDashboard.setAttribute('aria-label', 'ダッシュボードへ戻る'); headerDashboard.textContent = '⌂';
one('.admin-header>div:last-child')?.prepend(headerDashboard);
headerDashboard.addEventListener('click', () => { setProjectListOpen(false); dashboardPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

const settingsDialog = one('[data-settings-dialog]');
const settingsForm = one('[data-settings-form]');
const settingsStatus = one('[data-settings-status]');
const settingsStorageKey = 'akinael-admin-settings';
const adminTokenKey = 'admin-token';
const loginDialog = one('[data-login-dialog]');
const loginForm = one('[data-login-form]');
const loginStatus = one('[data-login-status]');
const syncSettings = (values) => {
  const token = localStorage.getItem(adminTokenKey);
  if (!token) return Promise.reject(new Error('admin login required'));
  return fetch('/api/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(values) })
    .then((response) => { if (!response.ok) throw new Error('settings sync failed'); return response.json(); });
};
const adminEscape = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const adminStatusLabels = { intake: '相談受付中', requirements: '内容を整理中', production: '制作中', quality_check: 'AI検査中', revision: '修正対応中', ready_for_review: '試作を確認中', published: '公開済み' };
let adminProjects = [];
let adminAuditLogs = null;
let selectedAdminProjectId = null;
let adminProjectFilter = 'all';
const adminAuthHeaders = () => { const token = localStorage.getItem(adminTokenKey); return token ? { authorization: `Bearer ${token}` } : null; };

const renderAdminChat = (project) => {
  const container = one('[data-admin-chat-messages]');
  const note = one('[data-admin-chat-note]');
  if (!container) return;
  if (!project) { container.innerHTML = ''; if (note) note.textContent = '案件を選択すると、これまでのやり取りが表示されます。'; return; }
  if (note) note.textContent = '';
  container.innerHTML = (project.messages || []).length
    ? project.messages.map((item) => item.authorRole === 'customer'
      ? `<article class="message customer"><div><p>${adminEscape(item.content)}</p></div></article>`
      : `<article class="message assistant"><img src="/assets/illustrations/ai-assistant-avatar.png" alt=""><div><p>${adminEscape(item.content)}</p></div></article>`).join('')
    : '<p class="form-note">まだメッセージがありません。</p>';
  container.scrollTop = container.scrollHeight;
};

const renderAdminAudit = (project) => {
  const list = one('[data-admin-audit-list]');
  if (!list) return;
  if (!project) { list.innerHTML = '<li><span>案件を選択してください。</span></li>'; return; }
  if (!adminAuditLogs) { list.innerHTML = '<li><span>読み込み中…</span></li>'; return; }
  const entries = adminAuditLogs.filter((entry) => entry.resourceId === project.id || entry.metadata?.projectId === project.id).slice().reverse();
  list.innerHTML = entries.length
    ? entries.map((entry) => `<li><i>≡</i><span><strong>${adminEscape(entry.actorRole)}</strong>が${adminEscape(entry.action)}<small>${new Date(entry.createdAt).toLocaleString('ja-JP')}</small></span></li>`).join('')
    : '<li><span>この案件に関する操作記録はまだありません。</span></li>';
};

const loadAdminAuditLogs = async () => {
  const headers = adminAuthHeaders();
  if (!headers) return;
  try {
    const response = await fetch('/api/admin/audit-logs', { headers });
    if (!response.ok) throw new Error();
    adminAuditLogs = await response.json();
  } catch { adminAuditLogs = []; }
};

const selectAdminProject = (id) => {
  const project = adminProjects.find((item) => item.id === id);
  if (!project) return;
  selectedAdminProjectId = id;
  all('[data-project-items] [data-project-id]').forEach((row) => row.classList.toggle('active', row.dataset.projectId === id));
  const titleEl = one('[data-project-title]');
  const statusEl = one('[data-project-status]');
  if (titleEl) titleEl.textContent = project.name;
  if (statusEl) statusEl.textContent = adminStatusLabels[project.status] || project.status;
  renderAdminChat(project);
  if (adminAuditLogs) renderAdminAudit(project);
  else loadAdminAuditLogs().then(() => renderAdminAudit(adminProjects.find((item) => item.id === selectedAdminProjectId)));
  setProjectListOpen(false);
};

const renderAdminProjectList = () => {
  const container = one('[data-project-items]');
  if (!container) return;
  const visible = adminProjectFilter === 'attention' ? adminProjects.filter((item) => item.needsAttention) : adminProjects;
  one('[data-project-count-all]').textContent = String(adminProjects.length);
  one('[data-project-count-attention]').textContent = String(adminProjects.filter((item) => item.needsAttention).length);
  container.innerHTML = visible.length ? visible.map((project) => `<button class="project-row${project.id === selectedAdminProjectId ? ' active' : ''}" data-project="${adminEscape(project.name)}" data-project-id="${project.id}"><span class="shop-icon${project.needsAttention ? ' coral-bg' : ''}">店</span><span><strong>${adminEscape(project.name)}</strong><small class="${project.needsAttention ? '' : 'normal'}">${project.needsAttention ? '<i></i>対応が必要' : '○ ' + (adminStatusLabels[project.status] || project.status)}</small></span></button>`).join('')
    : '<p class="form-note">該当する案件はありません。</p>';
  all('[data-project-items] [data-project-id]').forEach((row) => row.addEventListener('click', () => selectAdminProject(row.dataset.projectId)));
};

const loadAdminProjects = async () => {
  const headers = adminAuthHeaders();
  if (!headers) return;
  try {
    const response = await fetch('/api/admin/projects', { headers });
    if (!response.ok) throw new Error();
    adminProjects = await response.json();
    renderAdminProjectList();
    const stillExists = adminProjects.some((item) => item.id === selectedAdminProjectId);
    if (!stillExists && adminProjects.length) selectAdminProject(adminProjects[0].id);
    else if (!adminProjects.length) { renderAdminChat(null); renderAdminAudit(null); }
  } catch { /* keep current view if the load fails */ }
};

all('[data-project-filter]').forEach((button) => button.addEventListener('click', () => {
  adminProjectFilter = button.dataset.projectFilter;
  all('[data-project-filter]').forEach((item) => item.classList.toggle('active', item === button));
  renderAdminProjectList();
}));

const adminChatForm = one('[data-admin-chat-form]');
if (adminChatForm) adminChatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = one('input', adminChatForm);
  const content = input.value.trim();
  const headers = adminAuthHeaders();
  if (!content || !headers || !selectedAdminProjectId) return;
  input.value = '';
  try {
    const response = await fetch(`/api/projects/${selectedAdminProjectId}/messages`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ content }) });
    if (!response.ok) throw new Error();
    const body = await response.json();
    const project = adminProjects.find((item) => item.id === selectedAdminProjectId);
    if (project) { project.messages = [...(project.messages || []), body.message]; renderAdminChat(project); }
  } catch { /* leave the input cleared; the customer message endpoint will still hold the draft server-side on retry */ }
});

if (loginDialog && loginForm) {
  const setLoginGateMode = (gate) => {
    all('[data-login-close]').forEach((button) => { button.hidden = gate; });
  };
  loginDialog.addEventListener('cancel', (event) => { if (loginDialog.dataset.gate === 'true') event.preventDefault(); });
  one('[data-admin-login-open]')?.addEventListener('click', () => { loginDialog.dataset.gate = 'false'; setLoginGateMode(false); loginDialog.showModal(); });
  all('[data-login-close]').forEach((button) => button.addEventListener('click', () => loginDialog.close()));
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = '認証しています…';
    const values = Object.fromEntries(new FormData(loginForm).entries());
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok || result.user?.role !== 'admin') throw new Error('管理者アカウントでログインしてください');
      localStorage.setItem(adminTokenKey, result.token);
      loginForm.reset(); loginStatus.textContent = 'ログインしました。';
      loginDialog.dataset.gate = 'false'; setLoginGateMode(false);
      setTimeout(() => loginDialog.close(), 500);
      loadAdminProjects();
    } catch (error) { loginStatus.textContent = error.message; }
  });
  if (document.body.classList.contains('admin-app')) {
    const existingToken = localStorage.getItem(adminTokenKey);
    if (existingToken) {
      fetch('/api/auth/me', { headers: { authorization: `Bearer ${existingToken}` } })
        .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
        .then(({ user }) => {
          if (user.role !== 'admin') throw new Error();
          loginDialog.dataset.gate = 'false'; setLoginGateMode(false);
          loadAdminProjects();
        })
        .catch(() => {
          localStorage.removeItem(adminTokenKey);
          loginDialog.dataset.gate = 'true'; setLoginGateMode(true);
          loginDialog.showModal();
        });
    } else {
      loginDialog.dataset.gate = 'true'; setLoginGateMode(true);
      loginDialog.showModal();
    }
  }
}
one('[data-admin-logout]')?.addEventListener('click', async () => {
  const headers = adminAuthHeaders();
  if (headers) { try { await fetch('/api/auth/logout', { method: 'POST', headers }); } catch { /* proceed to local logout regardless */ } }
  localStorage.removeItem(adminTokenKey);
  location.reload();
});
if (settingsDialog && settingsForm) {
  const savedSettings = JSON.parse(localStorage.getItem(settingsStorageKey) || '{}');
  Object.entries(savedSettings).forEach(([name, value]) => {
    const field = settingsForm.elements.namedItem(name);
    if (!field) return;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value;
  });
  one('[data-settings-open]')?.addEventListener('click', () => settingsDialog.showModal());
  all('[data-settings-close]').forEach((button) => button.addEventListener('click', () => settingsDialog.close()));
  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(settingsForm).entries());
    settingsForm.querySelectorAll('input[type="checkbox"]').forEach((field) => { values[field.name] = field.checked; });
    localStorage.setItem(settingsStorageKey, JSON.stringify(values));
    if (localStorage.getItem(adminTokenKey)) {
      syncSettings(values)
        .then(() => { settingsStatus.textContent = '確認内容をサーバーへ保存しました。APIキー本体は入力しないでください。'; })
        .catch(() => { settingsStatus.textContent = '端末には保存しました。管理者ログイン後にサーバーへ同期されます。'; });
    } else settingsStatus.textContent = '端末に保存しました。管理者ログイン後にサーバーへ同期されます。';
  });
}

one('[data-project-search]')?.addEventListener('input', (event) => {
  const query = event.currentTarget.value.toLowerCase();
  all('[data-project]').forEach((row) => { row.hidden = !row.dataset.project.toLowerCase().includes(query); });
});

const tabButtons = all('[data-tab]');
const tabPanels = all('[data-tab-panel]');
tabButtons.forEach((button) => button.addEventListener('click', () => {
  tabButtons.forEach((item) => item.classList.toggle('active', item === button));
  tabPanels.forEach((panel) => { panel.hidden = !panel.dataset.tabPanel.split(' ').includes(button.dataset.tab); });
}));

const adminRailButtons = all('.admin-rail nav button');
const railTabMap = ['overview', 'projects', 'chat', 'tasks', 'artifacts', 'approvals', 'audit'];
adminRailButtons.forEach((button, index) => button.addEventListener('click', () => {
  const destination = railTabMap[index];
  if (destination === 'overview') {
    tabButtons.find((tab) => tab.dataset.tab === 'overview')?.click();
    setProjectListOpen(false);
    dashboardPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (destination === 'projects') { setProjectListOpen(true); return; }
  tabButtons.find((tab) => tab.dataset.tab === destination)?.click();
  setProjectListOpen(false);
}));

const confirmDialog = one('[data-confirm-dialog]');
const confirmTitle = one('[data-confirm-title]');
const confirmCopy = one('[data-confirm-copy]');
const openConfirm = (title, copy) => {
  if (!confirmDialog) return;
  confirmTitle.textContent = title;
  confirmCopy.textContent = copy;
  confirmDialog.showModal();
};
all('[data-review]').forEach((button) => button.addEventListener('click', () => openConfirm('承認依頼を確認', '承認すると、対象の制作物が次の工程へ進みます。操作内容は監査ログへ記録されます。')));
one('[data-emergency]')?.addEventListener('click', () => openConfirm('緊急停止の確認', '実行中の自動処理を停止し、新しい処理の開始を受け付けない状態にします。'));
all('[data-confirm-close]').forEach((button) => button.addEventListener('click', () => confirmDialog?.close()));
one('[data-confirm-accept]')?.addEventListener('click', () => {
  one('[data-confirm-accept]').textContent = '作成しました';
  setTimeout(() => confirmDialog?.close(), 700);
});

const commandForm = one('[data-command-form]');
if (commandForm) commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const textarea = one('textarea', commandForm);
  const value = textarea.value.trim();
  if (!value) return;
  one('[data-commander-messages]').insertAdjacentHTML('beforeend', `<article class="admin-message human"><small>あなた　今</small><p>${value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])}</p></article><article class="admin-message ai"><small>司令塔AI　今</small><p>指示を受け付けました。影響範囲と承認の要否を整理してから実行計画を提示します。</p></article>`);
  textarea.value = '';
  one('[data-commander-messages]').scrollTop = one('[data-commander-messages]').scrollHeight;
});
