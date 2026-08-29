import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStore } from '../src/platform-store.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AKINAEL_TENANT_NAME: 'akinael'
};

const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'content-type': 'application/json' }
});

test('production status is scoped to the visible project and omits internal execution fields', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.endsWith('/auth/v1/user')) return jsonResponse({ id: 'user-1', email: 'owner@example.com' });
    if (value.includes('/rest/v1/user_profiles?')) return jsonResponse([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }]);
    if (value.includes('/rest/v1/customer_members?')) return jsonResponse([{ customer_id: 'customer-1' }]);
    if (value.includes('/rest/v1/projects?')) return jsonResponse([{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: '店舗サイト' }]);
    if (value.includes('/rest/v1/workflow_runs?')) return jsonResponse([{ id: 'run-1', project_id: 'project-1', status: 'running' }]);
    if (value.includes('/rest/v1/tasks?')) return jsonResponse([{ id: 'task-1', project_id: 'project-1', status: 'running' }]);
    if (value.includes('/rest/v1/artifacts?')) return jsonResponse([{ id: 'artifact-1', project_id: 'project-1', title: '試作' }]);
    if (value.includes('/rest/v1/quality_checks?')) return jsonResponse([{ id: 'check-1', project_id: 'project-1', status: 'pass' }]);
    throw new Error(`unexpected request: ${value}`);
  };

  const result = await createPlatformStore({ env, fetchImpl }).getProductionStatus('access-token', 'project-1');
  assert.equal(result.project.id, 'project-1');
  assert.equal(result.workflows[0].id, 'run-1');
  assert.equal(result.tasks[0].id, 'task-1');
  assert.equal(result.artifacts[0].id, 'artifact-1');
  assert.equal(result.qualityChecks[0].id, 'check-1');

  const productionCalls = calls.filter((url) => /workflow_runs|tasks|artifacts|quality_checks/.test(url));
  assert.equal(productionCalls.length, 4);
  for (const url of productionCalls) {
    assert.match(url, /tenant_id=eq\.tenant-1/);
    assert.match(url, /project_id=eq\.project-1/);
  }
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/workflow_runs?')), /last_error|model/);
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/tasks?')), /result|last_error|metadata/);
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/artifacts?')), /storage_key|content_text/);
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/quality_checks?')), /evidence/);
});
