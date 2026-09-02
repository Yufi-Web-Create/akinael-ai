import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [css, script] = await Promise.all([
  readFile(new URL('../public/assets/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8')
]);

test('landing-page content is visible without JavaScript', () => {
  assert.match(css, /\.reveal\{opacity:1;transform:none\}/,
    'reveal content must be visible before progressive enhancement starts');
  assert.match(css, /\.js \.reveal\{opacity:0;transform:translateY\(30px\);transition:opacity \.75s,transform \.75s\}/,
    'the hidden state must be scoped to JavaScript enhancement');
  assert.match(script, /document\.documentElement\.classList\.add\('js'\)/,
    'the enhancement marker must be applied by the script');
});

test('landing-page reveal observer activates sections while scrolling', () => {
  assert.match(script, /entry\.target\.classList\.add\('visible'\)/);
  assert.match(script, /rootMargin: '0px 0px 15% 0px'/,
    'near-viewport sections should become visible before screenshot capture');
});
