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

const appMenu = one('[data-app-menu]');
const appSidebar = one('[data-app-sidebar]');
if (appMenu && appSidebar) appMenu.addEventListener('click', () => appSidebar.classList.toggle('open'));

const chatForm = one('[data-chat-form]');
if (chatForm) {
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = one('input', chatForm);
    const content = input.value.trim();
    if (!content) return;
    const typing = one('[data-typing]');
    typing?.insertAdjacentHTML('beforebegin', `<article class="message customer"><div><p>${content.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])}</p><time>今 ✓</time></div><span class="avatar-small">山</span></article>`);
    input.value = '';
    const messages = one('[data-messages]');
    messages.scrollTop = messages.scrollHeight;
    setTimeout(() => {
      typing?.insertAdjacentHTML('beforebegin', '<article class="message assistant"><img src="/assets/illustrations/ai-assistant-avatar.png" alt="ミセサポAI"><div><p>ありがとうございます。ご希望を制作内容へ整理しました。変更前後を比較できる形でご提案します。</p><time>今</time></div></article>');
      typing?.remove();
      messages.scrollTop = messages.scrollHeight;
    }, 900);
  });
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
if (adminMenu && projectList) adminMenu.addEventListener('click', () => projectList.classList.toggle('open'));

const settingsDialog = one('[data-settings-dialog]');
const settingsForm = one('[data-settings-form]');
const settingsStatus = one('[data-settings-status]');
const settingsStorageKey = 'misesapo-admin-settings';
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
if (loginDialog && loginForm) {
  one('[data-admin-login-open]')?.addEventListener('click', () => loginDialog.showModal());
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
      setTimeout(() => loginDialog.close(), 500);
    } catch (error) { loginStatus.textContent = error.message; }
  });
}
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

const projectRows = all('[data-project]');
projectRows.forEach((row) => row.addEventListener('click', () => {
  projectRows.forEach((item) => item.classList.remove('active'));
  row.classList.add('active');
  one('[data-project-title]').textContent = row.dataset.project;
  one('[data-project-status]').textContent = row.dataset.status;
  projectList?.classList.remove('open');
}));

one('[data-project-search]')?.addEventListener('input', (event) => {
  const query = event.currentTarget.value.toLowerCase();
  projectRows.forEach((row) => { row.hidden = !row.dataset.project.toLowerCase().includes(query); });
});

const tabButtons = all('[data-tab]');
const tabPanels = all('[data-tab-panel]');
tabButtons.forEach((button) => button.addEventListener('click', () => {
  tabButtons.forEach((item) => item.classList.toggle('active', item === button));
  tabPanels.forEach((panel) => { panel.hidden = !panel.dataset.tabPanel.split(' ').includes(button.dataset.tab); });
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
