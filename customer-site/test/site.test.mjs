import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
test('confirmed business facts are accurately displayed', () => { assert.match(html, /大分県由布市/); assert.match(html, /11:00〜18:00/); assert.match(html, /毎週月曜日/); });
test('unconfirmed address and phone number are not fabricated', () => { assert.doesNotMatch(html, /tel:\s*\d/); assert.match(html, /電話番号は確認中です/); assert.match(html, /詳しい住所と地図は、確認後に掲載します/); });
test('primary sections and accessible navigation exist', () => { for (const id of ['about', 'hours', 'access', 'contact']) assert.match(html, new RegExp(`id="${id}"`)); assert.match(html, /aria-label="ページ内メニュー"/); assert.match(html, /skip-link/); });
test('all page anchors resolve to a local target', () => { for (const target of html.matchAll(/href="#([^"]+)"/g)) assert.match(html, new RegExp(`id="${target[1]}"`)); });
test('responsive implementation includes mobile navigation and fixed CTA', () => { assert.match(css, /@media \(max-width:760px\)/); assert.match(css, /\.mobile-access\{position:fixed/); assert.match(css, /overflow:hidden/); });
