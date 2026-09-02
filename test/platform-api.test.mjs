import test from 'node:test';
import assert from 'node:assert/strict';
import { createIpRateLimiter } from '../src/platform-api.mjs';

test('IP rate limiter caps all requests from one peer and reports the remaining retry interval', () => {
  let currentTime = 1_000;
  const limit = createIpRateLimiter({ now: () => currentTime, windowMs: 60_000, max: 2 });
  const request = { socket: { remoteAddress: '127.0.0.1' } };

  assert.equal(limit(request), null);
  assert.equal(limit(request), null);
  assert.equal(limit(request), 60);

  currentTime += 60_000;
  assert.equal(limit(request), null);
});
