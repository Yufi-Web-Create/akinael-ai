import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionRouter } from '../src/production-router.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
};

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

test('router creates the research-first workflow plan for a new website request', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith('/rest/v1/rpc/start_request_workflow')) {
      return jsonResponse([{ workflow_run_id: 'run-1', created: true }]);
    }
    if (value.includes('/rest/v1/workflow_runs?')) {
      return jsonResponse([{ id: 'run-1', request_id: 'request-1', pipeline: 'web_new_full', status: 'queued', current_phase: 'understand', metadata: {} }]);
    }
    if (value.includes('/rest/v1/tasks?')) {
      return jsonResponse([{ id: 'task-1', workflow_run_id: 'run-1', task_key: 'intake_spec', sequence: 1, status: 'queued' }]);
    }
    throw new Error(`unexpected request: ${value}`);
  };

  const router = createProductionRouter({ env, fetchImpl });
  const routed = await router.route({
    id: 'request-1',
    tenant_id: 'tenant-1',
    project_id: 'project-1',
    type: 'web_new'
  });

  assert.equal(routed.created, true);
  assert.equal(routed.plan.pipeline, 'web_new_full');
  assert.equal(routed.plan.dynamicExpansion, false);

  const rpc = calls.find((call) => call.url.endsWith('/rest/v1/rpc/start_request_workflow'));
  const payload = JSON.parse(rpc.options.body);
  assert.equal(payload.p_request_id, 'request-1');
  assert.equal(payload.p_pipeline, 'web_new_full');
  assert.equal(payload.p_initial_phase, 'understand');
  assert.ok(payload.p_tasks.length >= 10);
  assert.equal(payload.p_tasks[0].task_key, 'intake_spec');
  assert.equal(payload.p_tasks.at(-1).task_key, 'release_gate');
});

test('router marks adaptive web changes for dynamic expansion', async () => {
  let rpcPayload;
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith('/rest/v1/rpc/start_request_workflow')) {
      rpcPayload = JSON.parse(options.body);
      return jsonResponse([{ workflow_run_id: 'run-2', created: true }]);
    }
    if (value.includes('/rest/v1/workflow_runs?')) {
      return jsonResponse([{ id: 'run-2', request_id: 'request-2', pipeline: 'web_change_adaptive', status: 'queued', current_phase: 'understand', metadata: rpcPayload.p_metadata }]);
    }
    if (value.includes('/rest/v1/tasks?')) return jsonResponse([]);
    throw new Error(`unexpected request: ${value}`);
  };

  const router = createProductionRouter({ env, fetchImpl });
  const routed = await router.route({
    id: 'request-2', tenant_id: 'tenant-1', project_id: 'project-1', type: 'web_change'
  });

  assert.equal(routed.plan.pipeline, 'web_change_adaptive');
  assert.equal(routed.plan.dynamicExpansion, true);
  assert.equal(rpcPayload.p_metadata.expansion_rule, 'web_change_impact');
  assert.equal(rpcPayload.p_tasks.length, 2);
});

test('router is idempotent when database returns an existing workflow', async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith('/rest/v1/rpc/start_request_workflow')) return jsonResponse([{ workflow_run_id: 'run-existing', created: false }]);
    if (value.includes('/rest/v1/workflow_runs?')) return jsonResponse([{ id: 'run-existing', pipeline: 'copy_research', status: 'running' }]);
    if (value.includes('/rest/v1/tasks?')) return jsonResponse([]);
    throw new Error(`unexpected request: ${value}`);
  };

  const routed = await createProductionRouter({ env, fetchImpl }).route({
    id: 'request-3', tenant_id: 'tenant-1', project_id: 'project-1', type: 'copy'
  });
  assert.equal(routed.created, false);
  assert.equal(routed.workflow.id, 'run-existing');
});
