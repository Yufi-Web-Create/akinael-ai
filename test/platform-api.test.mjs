import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedWindowRateLimiter, createIpRateLimiter } from '../src/platform-api.mjs';

test('IP rate limiter caps requests from one peer and resets after the window', () => {
  let currentTime = 1_000;
  const limit = createIpRateLimiter({ now: () => currentTime, windowMs: 60_000, max: 2 });
  const request = { socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(limit(request), null);
  assert.equal(limit(request), null);
  assert.equal(limit(request), 60);
  currentTime += 60_000;
  assert.equal(limit(request), null);
});

test('keyed limiter isolates login identifiers and authenticated subjects', () => {
  const limit = createFixedWindowRateLimiter({ now: () => 1_000, windowMs: 60_000, max: 1 });
  assert.equal(limit('ip:user-a:login'), null);
  assert.equal(limit('ip:user-a:login'), 60);
  assert.equal(limit('ip:user-b:login'), null);
  assert.equal(limit('subject-a:/api/v2/projects'), null);
});
