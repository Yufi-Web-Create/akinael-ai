import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const [html, css, ogImage] = await Promise.all(['index.html', 'styles.css', 'og-image.svg'].map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
for (const value of ['ゆうやけこやけ', '11:00〜18:00', '毎週月曜日', '大分県由布市挾間町古野111-1']) assert.ok(html.includes(value), `Missing required content: ${value}`);
assert.match(html, /<html lang="ja">/); assert.match(html, /<meta name="description"/); assert.match(html, /<h1[\s>]/); assert.match(html, /<main id="main">/); assert.match(html, /<nav aria-label=/);
assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'Page must have exactly one h1');
assert.deepEqual([...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1])), [1, 2, 2, 2], 'Heading hierarchy must be h1 followed by section h2 elements');
assert.match(html, /<meta property="og:image" content="og-image\.svg"/); assert.match(html, /<meta property="og:image:alt"/); assert.match(html, /<meta name="twitter:card" content="summary_large_image"/); assert.match(ogImage, /<svg[\s>]/);
assert.ok(!/問い合わせ|予約|電話番号|https?:\/\//.test(html), 'Out-of-scope contact or external link found'); assert.match(css, /@media \(max-width: 700px\)/);
for (const id of ['top', 'about', 'dagashi', 'shop-info']) assert.match(html, new RegExp(`id="${id}"`), `Missing anchor target: ${id}`);
for (const target of ['#top', '#about', '#dagashi', '#shop-info']) assert.match(html, new RegExp(`href="${target}"`), `Missing anchor link: ${target}`);
for (const selector of ['.hero', '.hero-hours', '.info-card', '.about-content', '.dagashi-layout', '.skip-link', 'a:focus-visible', '@media (prefers-reduced-motion: reduce)']) assert.ok(css.includes(selector), `Missing required UI/a11y style: ${selector}`);
assert.match(css, /min-height: 44px/, 'Interactive links must provide a 44px touch target');
assert.match(css, /grid-template-columns: 1fr;/, 'Mobile layout must stack content');
console.log('Content and implementation checks passed.');
