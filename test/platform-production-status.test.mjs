import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStore } from '../src/platform-store.mjs';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', AKINAEL_TENANT_NAME: 'akinael' };
const jsonResponse = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
const workflow = (id, createdAt) => ({ id, project_id: 'project-1', status: 'completed', created_at: createdAt });
const gate = (id, runId, taskKey, reviewStatus, createdAt, status = 'completed') => ({ id, project_id: 'project-1', workflow_run_id: runId, task_key: taskKey, mode: 'release_gate', sequence: 40, status, created_at: createdAt, result: reviewStatus ? { review: { status: reviewStatus } } : null });
const approved = [{ id: 'approval-1', project_id: 'project-1', type: 'delivery', status: 'approved' }];

const productionHarness = ({ workflows, gateTasks, approvals = approved, deployments = [] }) => {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.endsWith('/auth/v1/user')) return jsonResponse({ id: 'user-1', email: 'owner@example.com' });
    if (value.includes('/rest/v1/user_profiles?')) return jsonResponse([{ id: 'user-1', tenant_id: 'tenant-1', role: 'customer' }]);
    if (value.includes('/rest/v1/customer_members?')) return jsonResponse([{ customer_id: 'customer-1' }]);
    if (value.includes('/rest/v1/projects?')) return jsonResponse([{ id: 'project-1', tenant_id: 'tenant-1', customer_id: 'customer-1', name: '店舗サイト' }]);
    if (value.includes('/rest/v1/workflow_runs?')) return jsonResponse(workflows);
    if (value.includes('/rest/v1/tasks?') && value.includes('mode=eq.release_gate')) return jsonResponse(gateTasks);
    if (value.includes('/rest/v1/tasks?')) return jsonResponse([]);
    if (value.includes('/rest/v1/artifacts?')) return jsonResponse([]);
    if (value.includes('/rest/v1/quality_checks?')) return jsonResponse([]);
    if (value.includes('/rest/v1/approvals?')) return jsonResponse(approvals);
    if (value.includes('/rest/v1/deployments?')) return jsonResponse(deployments);
    if (value.includes('/rest/v1/notifications?')) return jsonResponse([]);
    throw new Error(`unexpected request: ${value}`);
  };
  return { store: createPlatformStore({ env, fetchImpl }), calls };
};

const statusFor = async (options) => productionHarness(options).store.getProductionStatus('access-token', 'project-1');

test('legacy release_gate PASS and approved delivery are deploy-ready but remain behind the Human Gate', async () => {
  const run = workflow('run-1', '2026-09-08T01:00:00Z');
  const result = await statusFor({ workflows: [run], gateTasks: [gate('gate-1', run.id, 'release_gate', 'PASS', run.created_at)] });
  assert.equal(result.deploymentGate.releasePassed, true);
  assert.equal(result.deploymentGate.customerApproved, true);
  assert.equal(result.deploymentGate.deployReady, true);
  assert.equal(result.deploymentGate.humanGateRequired, true);
  assert.equal(result.deploymentGate.productionPublished, false);
});

test('expanded_release_gate PASS is accepted for a dynamic workflow', async () => {
  const run = workflow('run-1', '2026-09-08T02:00:00Z');
  const result = await statusFor({ workflows: [run], gateTasks: [gate('gate-1', run.id, 'expanded_release_gate', 'PASS', run.created_at)] });
  assert.equal(result.deploymentGate.releasePassed, true);
  assert.equal(result.deploymentGate.deployReady, true);
});

test('expanded_release_gate FAIL prevents deploy-ready', async () => {
  const run = workflow('run-1', '2026-09-08T02:00:00Z');
  const result = await statusFor({ workflows: [run], gateTasks: [gate('gate-1', run.id, 'expanded_release_gate', 'FAIL', run.created_at)] });
  assert.equal(result.deploymentGate.releasePassed, false);
  assert.equal(result.deploymentGate.deployReady, false);
});

test('latest relevant workflow wins over an older PASS', async () => {
  const latest = workflow('run-latest', '2026-09-08T03:00:00Z');
  const old = workflow('run-old', '2026-09-08T01:00:00Z');
  const result = await statusFor({ workflows: [latest, old], gateTasks: [gate('gate-old', old.id, 'expanded_release_gate', 'PASS', old.created_at), gate('gate-latest', latest.id, 'expanded_release_gate', null, latest.created_at, 'pending')] });
  assert.equal(result.deploymentGate.releasePassed, false);
  assert.equal(result.deploymentGate.deployReady, false);
});

test('a newer workflow without a release gate does not hide the latest relevant release workflow', async () => {
  const consultation = workflow('run-consultation', '2026-09-08T04:00:00Z');
  const release = workflow('run-release', '2026-09-08T03:00:00Z');
  const result = await statusFor({ workflows: [consultation, release], gateTasks: [gate('gate-release', release.id, 'expanded_release_gate', 'PASS', release.created_at)] });
  assert.equal(result.deploymentGate.releasePassed, true);
  assert.equal(result.deploymentGate.deployReady, true);
});

test('expanded gate is selected over legacy gate within the same workflow', async () => {
  const run = workflow('run-1', '2026-09-08T03:00:00Z');
  const result = await statusFor({ workflows: [run], gateTasks: [gate('legacy', run.id, 'release_gate', 'PASS', run.created_at), gate('expanded', run.id, 'expanded_release_gate', 'FAIL', run.created_at)] });
  assert.equal(result.deploymentGate.releasePassed, false);
  assert.equal(result.deploymentGate.deployReady, false);
});

test('missing or rejected approval prevents deploy-ready despite a PASS release gate', async () => {
  const run = workflow('run-1', '2026-09-08T03:00:00Z');
  for (const approvals of [[], [{ id: 'approval-1', type: 'delivery', status: 'rejected' }]]) {
    const result = await statusFor({ workflows: [run], gateTasks: [gate('gate-1', run.id, 'expanded_release_gate', 'PASS', run.created_at)], approvals });
    assert.equal(result.deploymentGate.customerApproved, false);
    assert.equal(result.deploymentGate.deployReady, false);
  }
});

test('production status queries the scoped release-gate mode and omits internal execution fields', async () => {
  const run = workflow('run-1', '2026-09-08T01:00:00Z');
  const { store, calls } = productionHarness({ workflows: [run], gateTasks: [gate('gate-1', run.id, 'release_gate', 'PASS', run.created_at)] });
  await store.getProductionStatus('access-token', 'project-1');
  const productionCalls = calls.filter((url) => /workflow_runs|tasks|artifacts|quality_checks|approvals|deployments|notifications/.test(url));
  assert.equal(productionCalls.length, 8);
  for (const url of productionCalls) {
    assert.match(url, /tenant_id=eq\.tenant-1/);
    assert.match(url, /project_id=eq\.project-1/);
  }
  const gateCall = calls.find((url) => url.includes('/rest/v1/tasks?') && url.includes('mode=eq.release_gate'));
  assert.ok(gateCall);
  assert.doesNotMatch(gateCall, /task_key=eq\.release_gate/);
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/workflow_runs?')), /last_error|model/);
  assert.doesNotMatch(calls.find((url) => url.includes('/rest/v1/tasks?') && !url.includes('mode=eq.release_gate')), /result|last_error|metadata/);
});
