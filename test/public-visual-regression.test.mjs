import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [css, script] = await Promise.all([
  readFile(new URL('../public/assets/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8')
]);

test('landing-page content is never hidden by its reveal marker', () => {
  assert.match(css, /\.reveal\{opacity:1;transform:none\}/,
    'all marked content must remain visible in every rendering mode');
  assert.doesNotMatch(css, /(?:^|})\s*(?:\.js\s+)?\.reveal(?:\.visible)?\s*\{[^}]*opacity\s*:\s*0/i,
    'a reveal selector must not make content transparent while waiting for JavaScript or scrolling');
  assert.doesNotMatch(css, /(?:^|})\s*(?:\.js\s+)?\.reveal(?:\.visible)?\s*\{[^}]*visibility\s*:\s*hidden/i,
    'a reveal selector must not hide content from the visual tree');
});

test('landing-page observer does not control whether sections are rendered', () => {
  assert.match(script, /entry\.target\.classList\.add\('visible'\)/);
  assert.doesNotMatch(script, /classList\.add\('js'\)/,
    'the script must not enable a CSS state that hides page content');
});
