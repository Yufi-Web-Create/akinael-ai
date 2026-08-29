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
const authFragment = new URLSearchParams(location.hash.slice(1));
const confirmedAccessToken = authFragment.get('access_token');
if (confirmedAccessToken) {
  localStorage.setItem(customerTokenKey, confirmedAccessToken);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

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
  const authConsentWrap = one('[data-auth-consent-wrap]');
  const authConsentInput = one('[data-auth-consent]');
  const authPasswordToggle = one('[data-auth-password-toggle]');
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
    if (authConsentWrap) { authConsentWrap.hidden = mode !== 'register'; if (authConsentInput) authConsentInput.checked = false; }
    if (authPasswordToggle) { authPasswordField.type = 'password'; authPasswordToggle.textContent = '表示'; authPasswordToggle.setAttribute('aria-label', 'パスワードを表示'); authPasswordToggle.setAttribute('aria-pressed', 'false'); }
    all('[data-auth-tab]').forEach((button) => button.classList.toggle('active', button.dataset.authTab === mode));
    authStatus.textContent = '';
  };
  authPasswordToggle?.addEventListener('click', () => {
    const showing = authPasswordField.type === 'text';
    authPasswordField.type = showing ? 'password' : 'text';
    authPasswordToggle.textContent = showing ? '表示' : '非表示';
    authPasswordToggle.setAttribute('aria-label', showing ? 'パスワードを表示' : 'パスワードを非表示にする');
    authPasswordToggle.setAttribute('aria-pressed', String(!showing));
  });
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
    if (authSubmit.disabled) return;
    authSubmit.disabled = true;
    authStatus.textContent = authMode === 'register' ? 'アカウントを作成しています…' : '認証しています…';
    const { consent, ...values } = Object.fromEntries(new FormData(authForm).entries());
    try {
      const response = await fetch(`/api/v2/auth/${authMode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || '処理に失敗しました');
      if (result.confirmationRequired) {
        authStatus.textContent = '確認メールを送信しました。メール内のリンクから登録を完了してください。';
        authSubmit.disabled = false;
        return;
      }
      localStorage.setItem(customerTokenKey, result.token);
      authStatus.textContent = 'ログインしました。マイページへ移動します…';
      setTimeout(() => { location.href = '/mypage'; }, 400);
    } catch (caught) {
      authStatus.textContent = authErrors[caught.message] || caught.message;
      authSubmit.disabled = false;
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
      research: { status: '調査中', next: '必要な情報を調べています' },
      direction: { status: '制作方針を整理中', next: '構成と方針を整えています' },
      production: { status: '制作中', next: '試作の作成を進めています' },
      quality_check: { status: 'AI検査中', next: '品質チェックを行っています' },
      revision: { status: '修正対応中', next: '修正内容を反映しています' },
      ready_for_review: { status: '試作を確認中', next: '試作内容をご確認ください' },
      deploy_ready: { status: '公開準備完了', next: '公開前の最終確認をお願いします' },
      published: { status: '公開済み', next: '公開後の改善もご相談いただけます' }
    };
    fetch('/api/v2/auth/me', { headers: authHeaders })
      .then((response) => { if (!response.ok) throw new Error('unauthenticated'); return response.json(); })
      .then(async (account) => {
        if (!account.onboardingRequired) return account;
        const displayName = account.user?.email?.split('@')[0] || 'お客様';
        const response = await fetch('/api/v2/onboarding', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders },
          body: JSON.stringify({ displayName })
        });
        if (!response.ok) throw new Error('onboarding failed');
        return response.json();
      })
      .then(({ user, profile }) => {
        if (profile?.role !== 'customer') throw new Error('not a customer account');
        const displayName = profile.displayName || user.email.split('@')[0];
        one('[data-user-name]').textContent = displayName;
        one('[data-user-avatar]').textContent = displayName.slice(0, 1).toUpperCase();
        one('[data-user-email]').textContent = user.email;
        return fetch('/api/v2/projects', { headers: authHeaders }).then((response) => response.json());
      })
      .then((projects) => {
        const emptyState = one('[data-empty-state]');
        const projectStrip = one('[data-project-strip]');
        const customerLayout = one('[data-customer-layout]');
        const progressPanel = one('[data-progress-panel]');
        const billingPanel = one('[data-billing-panel]');
        if (!Array.isArray(projects) || !projects.length) {
          if (emptyState) emptyState.hidden = false;
          [projectStrip, customerLayout, progressPanel, billingPanel].forEach((section) => { if (section) section.hidden = true; });
          return;
        }
        const project = [...projects].sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))[0];
        const label = statusLabels[project.status] || { status: project.status, next: 'ご相談内容を確認しています' };
        one('[data-project-title]').textContent = project.name;
        one('[data-project-status-text]').textContent = label.status;
        one('[data-project-next-text]').textContent = label.next;
        window.akinaelCurrentProjectId = project.id;
        return Promise.all([
          fetch(`/api/v2/projects/${project.id}/requests`, { headers: authHeaders }).then((response) => response.ok ? response.json() : []),
          fetch(`/api/v2/projects/${project.id}/messages`, { headers: authHeaders }).then((response) => response.ok ? response.json() : []),
          fetch(`/api/v2/projects/${project.id}/production`, { headers: authHeaders }).then((response) => response.ok ? response.json() : null)
        ]).then(([requests, messages, production]) => {
          window.akinaelCurrentRequestId = Array.isArray(requests) ? requests[0]?.id || null : null;
          window.akinaelRenderCustomerMessages?.(messages);
          const workflow = production?.workflows?.[0] || null;
          const tasks = Array.isArray(production?.tasks) ? production.tasks : [];
          const artifacts = Array.isArray(production?.artifacts) ? production.artifacts : [];
          const checks = Array.isArray(production?.qualityChecks) ? production.qualityChecks : [];
          const summary = one('[data-production-summary]');
          if (summary) summary.textContent = workflow ? `${tasks.filter((task) => task.status === 'completed').length} / ${tasks.length}工程 完了` : '相談内容を受け付けています';

          const phaseOrder = ['understand', 'direction', 'build', 'qa', 'review'];
          const currentIndex = Math.max(0, phaseOrder.indexOf(workflow?.current_phase));
          all('li', one('[data-progress-steps]')).forEach((item, index) => {
            const done = workflow?.status === 'completed' || workflow?.status === 'deploy_ready' || index < currentIndex;
            const current = !done && index === currentIndex;
            item.classList.toggle('done', done);
            item.classList.toggle('current', current);
            const marker = one('i', item);
            const state = one('span', item);
            if (marker) marker.textContent = done ? '✓' : String(index + 1);
            if (state) state.textContent = done ? '完了' : current ? '進行中' : '待機中';
          });
          const progressNote = one('[data-progress-note]');
          if (progressNote) progressNote.textContent = workflow ? '各工程の実行状況を表示しています' : 'ご相談後に制作工程が始まります';

          const deliverables = one('[data-deliverables-list]');
          const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
          if (deliverables) deliverables.innerHTML = artifacts.length
            ? artifacts.map((artifact) => `<li><i>◇</i><span><strong>${escapeHtml(artifact.title)}</strong><small>${escapeHtml(artifact.kind)} ・ ${new Date(artifact.created_at).toLocaleDateString('ja-JP')}</small></span></li>`).join('')
            : '<li><span>制作物はまだありません。</span></li>';
          const qualitySummary = one('[data-quality-summary]');
          if (qualitySummary) {
            const failed = checks.filter((check) => check.status === 'fail').length;
            qualitySummary.textContent = checks.length ? `品質検査 ${checks.length}件・要修正 ${failed}件` : '品質検査前です';
          }
        });
      })
      .catch(goToLogin);
  }
}

one('[data-logout]')?.addEventListener('click', async () => {
  const token = localStorage.getItem(customerTokenKey);
  if (token) {
    try { await fetch('/api/v2/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }); } catch { /* proceed to local logout regardless */ }
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
    const response = await fetch('/api/v2/projects', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name }) });
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
  const customerMessageMarkup = (item) => (item.author_type || item.authorRole) === 'customer'
    ? `<article class="message customer"><div><p>${chatEscape(item.content)}</p></div></article>`
    : `<article class="message assistant"><img src="${chatAvatar}" alt="アキナエルAI"><div><p>${chatEscape(item.content)}</p></div></article>`;
  window.akinaelRenderCustomerMessages = (list) => {
    const container = one('[data-messages]');
    if (!container) return;
    container.innerHTML = (list || []).map(customerMessageMarkup).join('');
    container.scrollTop = container.scrollHeight;
  };
  window.akinaelAppendCustomerMessage = (item) => {
    const container = one('[data-messages]');
    if (!container || !item) return;
    container.insertAdjacentHTML('beforeend', customerMessageMarkup(item));
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
        const requestId = window.akinaelCurrentRequestId;
        const response = requestId
          ? await fetch(`/api/v2/projects/${projectId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ content, requestId }) })
          : await fetch(`/api/v2/projects/${projectId}/requests`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ title: content.slice(0, 80), body: content, type: 'general', priority: 'normal' }) });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (body.request?.id) window.akinaelCurrentRequestId = body.request.id;
        const replyText = 'ご相談を受け付けました。内容を整理し、進行状況はこちらでお知らせします。';
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
one('[data-approve]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const token = localStorage.getItem(customerTokenKey);
  const projectId = window.akinaelCurrentProjectId;
  if (!token || !projectId) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/v2/projects/${projectId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ content: '試作内容を確認しました。この内容で承認します。', requestId: window.akinaelCurrentRequestId || undefined }) });
    if (!response.ok) throw new Error();
    const body = await response.json();
    window.akinaelAppendCustomerMessage?.(body);
    button.textContent = '✓ 承認済み';
    one('[data-approval-message]').hidden = false;
  } catch {
    button.disabled = false;
  }
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
dashboardPanel.className = 'task-dashboard admin-section'; dashboardPanel.dataset.da