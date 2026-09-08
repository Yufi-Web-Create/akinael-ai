import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260908112917_make_idempotency_indexes_postgrest_compatible.sql', import.meta.url);

test('approval and notification idempotency keys use PostgREST-inferable unique indexes', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /create unique index approvals_idempotency_key_unique\s+on public\.approvals \(idempotency_key\)/i);
  assert.match(sql, /create unique index notifications_idempotency_key_unique\s+on public\.notifications \(idempotency_key\)/i);
  assert.match(sql, /having count\(\*\) > 1/i);
});
