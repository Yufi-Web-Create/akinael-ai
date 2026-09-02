import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, script] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8')
]);

test('public landing page exposes complete tab semantics for authentication', () => {
  assert.match(html, /id="auth-register-tab"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="auth-panel"/);
  assert.match(html, /id="auth-login-tab"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="auth-panel"/);
  assert.match(html, /id="auth-panel" role="tabpanel" aria-labelledby="auth-register-tab" tabindex="0"/);
  assert.match(script, /button\.setAttribute\('aria-selected', String\(selected\)\)/);
  assert.match(script, /authPanel\.setAttribute\('aria-labelledby', button\.id\)/);
  assert.match(script, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
});

test('public landing page retains required SEO and keyboard-accessible landmarks', () => {
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>アキナエルAI｜小さなお店のAI相談役（集客・SNS・Web）<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/akinael-ai\.com\/">/);
  assert.match(html, /<meta property="og:title" content="[^"]+">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /"@type": "Organization"/);
  assert.match(html, /<a class="skip-link" href="#main">本文へ移動<\/a>/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /<h1[ >]/);
  assert.match(html, /<nav id="global-nav"[^>]*aria-label="メインナビゲーション"/);
  assert.match(html, /<img class="hero-media"[^>]*alt="[^"]+"/);
  assert.match(html, /aria-label="パスワードを表示" aria-pressed="false"/);
  assert.match(script, /authPasswordToggle\.setAttribute\('aria-pressed', String\(!showing\)\)/);
});
