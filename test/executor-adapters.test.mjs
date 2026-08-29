import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponsesExecutor, extractLooseJson } from '../src/openai-responses.mjs';
import { createGitHubRuntime } from '../src/github-runtime.mjs';

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

test('Responses executor enables web search only for research tasks and keeps citations', async () => {
  const calls = [];
  const executor = createResponsesExecutor({
    env: {
      OPENAI_API_KEY: 'test-key',
      OPENAI_RESPONSES_URL: 'https://api.example.com/v1/responses',
      RESEARCH_MODEL: 'research-model',
      GENERAL_AGENT_MODEL: 'general-model'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return jsonResponse({
        id: 'resp-1',
        model: 'research-model',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: '調査結果',
            annotations: [{ type: 'url_citation', url: 'https://example.com/source', title: 'Source', start_index: 0, end_index: 4 }]
          }]
        }]
      });
    }
  });

  const result = await executor.run({ prompt: 'research', research: true });
  assert.equal(result.output, '調査結果');
  assert.equal(result.citations[0].url, 'https://example.com/source');
  assert.equal(calls[0].body.model, 'research-model');
  assert.equal(calls[0].body.tools[0].type, 'web_search');

  await executor.run({ prompt: 'normal', research: false });
  assert.equal(calls[1].body.model, 'general-model');
  assert.equal(Object.hasOwn(calls[1].body, 'tools'), false);
});

test('extractLooseJson accepts fenced and trailing structured results', () => {
  assert.deepEqual(extractLooseJson('text\n```json\n{"status":"PASS"}\n```'), { status: 'PASS' });
  assert.deepEqual(extractLooseJson('説明\n{"route":"copy","impact":"content"}'), { route: 'copy', impact: 'content' });
});

test('GitHub runtime dispatches the standard Akinael workflow with constrained inputs', async () => {
  const calls = [];
  const runtime = createGitHubRuntime({
    env: { GITHUB_WORKER_TOKEN: 'gh-test', GITHUB_AGENT_WORKFLOW: 'akinael-agent.yml' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return new Response(null, { status: 204 });
    }
  });
  const dispatched = await runtime.dispatchAgent({
    repositoryFullName: 'owner/site',
    ref: 'main',
    taskId: 'task-1',
    workflowRunId: 'run-1',
    prompt: 'do work',
    branchName: 'akinael/run-1',
    permissionProfile: ':read-only',
    stage: 'review',
    cycle: 1
  });
  assert.equal(dispatched.runName, 'Akinael task-1 review 1');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.ref, 'main');
  assert.equal(body.inputs.permission_profile, ':read-only');
  assert.equal(body.inputs.branch_name, 'akinael/run-1');
  assert.equal(body.inputs.run_name, 'Akinael task-1 review 1');
});

test('GitHub runtime decodes result files from a task branch', async () => {
  const runtime = createGitHubRuntime({
    env: { GITHUB_WORKER_TOKEN: 'gh-test' },
    fetchImpl: async () => jsonResponse({ content: Buffer.from('{"final_message":"PASS"}').toString('base64'), encoding: 'base64' })
  });
  const text = await runtime.getFileText({ repositoryFullName: 'owner/site', path: '.akinael/results/t.json', ref: 'akinael/run-1' });
  assert.equal(JSON.parse(text).final_message, 'PASS');
});
