import assert from 'node:assert/strict';
import test from 'node:test';
import { hasBrowserConsoleError } from './console-errors.mjs';

test('detects Chromium ERROR:CONSOLE resource failures, including 404s', () => {
  assert.equal(hasBrowserConsoleError('[1234:1234:0902/120000.000:ERROR:CONSOLE(0)] "Failed to load resource: the server responded with a status of 404 ()"'), true);
});

test('detects alternate severe console log formatting', () => {
  assert.equal(hasBrowserConsoleError('CONSOLE SEVERE: uncaught application error'), true);
});

test('does not report normal Chromium diagnostics as console errors', () => {
  assert.equal(hasBrowserConsoleError('[1234:1234:INFO:CONSOLE(0)] "application started"'), false);
});
