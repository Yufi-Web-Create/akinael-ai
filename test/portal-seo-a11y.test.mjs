import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const [html, portal, styles, ogImage] = await Promise.all([
  readFile(new URL('../portal/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../portal/src/Portal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../portal/src/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../portal/public/og-image.svg', import.meta.url), 'utf8')
]);

test('customer portal provides complete noindex Open Graph metadata and a share image', async () => {
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>アキナエルAI｜お客様ポータル<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+"\/>/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive"\/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/akinael-ai\.com\/portal\/"\/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/akinael-ai\.com\/portal\/og-image\.svg"\/>/);
  assert.match(html, /<meta property="og:image:width" content="1200"\/>/);
  assert.match(html, /<meta property="og:image:height" content="630"\/>/);
  assert.match(html, /<meta property="og:image:alt" content="アキナエルAI お客様ポータル"\/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"\/>/);
  assert.match(ogImage, /<svg[^>]*width="1200"[^>]*height="630"/);
  assert.ok((await stat(new URL('../portal/public/og-image.svg', import.meta.url))).size > 0);
});

test('customer portal keeps semantic headings, associated labels, live messages, and visible focus rules', () => {
  assert.match(portal, /return <main>/);
  assert.match(portal, /<h1>/);
  assert.match(portal, /<h2>/);
  for (const id of ['email', 'password', 'display-name', 'business-name', 'project-name', 'consultation-draft']) {
    assert.match(portal, new RegExp(`<label className="fieldLabel" htmlFor="${id}">`));
    assert.match(portal, new RegExp(`id="${id}"`));
  }
  assert.match(portal, /role="alert"/);
  assert.match(portal, /role="status"/);
  assert.match(portal, /required/);
  assert.match(portal, /type="button"/);
  assert.match(portal, /rel="noreferrer"/);
  assert.match(portal, /target="_blank"/);
  assert.match(styles, /:focus-visible/);
});
