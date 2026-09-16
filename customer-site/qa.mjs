import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const [html, css] = await Promise.all(['index.html', 'styles.css'].map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
for (const value of ['ゆうやけこやけ', '11:00〜18:00', '毎週月曜日', '大分県由布市挾間町古野111-1']) assert.ok(html.includes(value), `Missing required content: ${value}`);
assert.match(html, /<html lang="ja">/); assert.match(html, /<meta name="description"/); assert.match(html, /<h1[\s>]/); assert.match(html, /<main id="main">/); assert.match(html, /<nav aria-label=/);
assert.ok(!/問い合わせ|予約|電話番号|https?:\/\//.test(html), 'Out-of-scope contact or external link found'); assert.match(css, /@media \(max-width:700px\)/);
for (const id of ['top', 'about', 'dagashi', 'shop-info']) assert.match(html, new RegExp(`id="${id}"`), `Missing anchor target: ${id}`);
assert.match(css, /\.site-header nav\{display:flex;width:100%/, 'Mobile navigation must remain available');
console.log('Content and implementation checks passed.');
