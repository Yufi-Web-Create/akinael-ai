import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const required = ['<title>', 'name="description"', 'lang="ja"', 'id="about"', 'id="hours"', 'id="access"', 'id="contact"'];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) throw new Error(`Required markup missing: ${missing.join(', ')}`);
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const missingTargets = anchors.filter((target) => !html.includes(`id="${target}"`));
if (missingTargets.length) throw new Error(`Broken page anchors: ${missingTargets.join(', ')}`);
if (/tel:\s*(?:0|\d)/.test(html)) throw new Error('An unverified telephone number must not be published.');
if (/〒\d{3}/.test(html)) throw new Error('An unverified street address must not be published.');
console.log('HTML checks passed');
