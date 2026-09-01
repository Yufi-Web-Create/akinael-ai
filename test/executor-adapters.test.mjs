import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponsesExecutor, extractLooseJson, classifyOpenAIError } from '../src/openai-responses.mjs';
import { createGitHubRuntime, GitHubRuntimeError, classifyGitHubJobFailure } from '../src/github-runtime.mjs';

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
      GENERAL_AGENT_MODEL: 'general-model',
      LIGHTWEIGHT_AGENT_MODEL: 'light-model'
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

  await executor.run({ prompt: 'light', lightweight: true, reasoningEffort: 'low' });
  assert.equal(calls[2].body.model, 'light-model');
  assert.equal(calls[2].body.reasoning.effort, 'low');
});

test('billing and credit exhaustion are classified as terminal failures', () => {
  const apiError = Object.assign(new Error('You have no credits remaining.'), { body: { error: { code: 'insufficient_quota' } } });
  assert.deepEqual(classifyOpenAIError(apiError), {
    kind: 'billing_quota', terminal: true, message: 'OpenAI API credits or billing quota exhausted'
  });
  assert.equal(classifyOpenAIError(new Error('temporary network error')).terminal, false);
  assert.equal(classifyGitHubJobFailure('ERROR: You have no credits remaining.').terminal, true);
  assert.equal(classifyGitHubJobFailure('runner disconnected').terminal, false);
});

test('extractLooseJson accepts fenced and trailing structured results', () => {
  assert.deepEqual(extractLooseJson('text\n```json\n{"status":"PASS"}\n```'), { status: 'PASS' });
  assert.deepEqual(extractLooseJson('説明\n{"route":"copy","impact":"content"}'), { route: 'copy', impact: 'content' });
});

test('GitHub runtime dispatches customer work through the central Core workflow', async () => {
  const calls = [];
  const runtime = createGitHubRuntime({
    env: {
      GITHUB_WORKER_TOKEN: 'gh-test',
      GITHUB_EXECUTOR_REPO: 'core/akinael-ai',
      GITHUB_EXECUTOR_REF: 'runner-main',
      GITHUB_AGENT_WORKFLOW: 'akinael-agent.yml'
    },
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
    taskMode: 'visual_review',
    stage: 'review',
    cycle: 1,
    model: 'gpt-5.6-luna',
    effort: 'low'
  });
  assert.equal(dispatched.runName, 'Akinael task-1 review 1');
  assert.equal(dispatched.executorRepository, 'core/akinael-ai');
  assert.match(calls[0].url, /repos\/core\/akinael-ai\/actions\/workflows\/akinael-agent\.yml\/dispatches$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.ref, 'runner-main');
  assert.equal(body.inputs.target_repository, 'owner/site');
  assert.equal(body.inputs.target_owner, 'owner');
  assert.equal(body.inputs.target_repo, 'site');
  assert.equal(body.inputs.target_default_branch, 'main');
  assert.equal(body.inputs.permission_profile, ':read-only');
  assert.equal(body.inputs.task_mode, 'visual_review');
  assert.equal(body.inputs.model, 'gpt-5.6-luna');
  assert.equal(body.inputs.effort, 'low');
  assert.equal(body.inputs.branch_name, 'akinael/run-1');
});

test('personal-account repository bootstrap refuses to create repos without a user bootstrap token', async () => {
  const runtime = createGitHubRuntime({ env: { GITHUB_APP_ID: '1', GITHUB_APP_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: 'fake' }, fetchImpl: async () => { throw new Error('not called'); } });
  await assert.rejects(
    runtime.createPrivateRepository({ owner: 'person', ownerType: 'user', name: 'client-test' }),
    (error) => error instanceof GitHubRuntimeError && /GITHUB_BOOTSTRAP_TOKEN/.test(error.message)
  );
});

test('personal-account repository bootstrap uses the scoped bootstrap token', async () => {
  const calls = [];
  const runtime = createGitHubRuntime({
    env: { GITHUB_WORKER_TOKEN: 'worker', GITHUB_BOOTSTRAP_TOKEN: 'bootstrap' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ full_name: 'person/client-test', default_branch: 'main' }, 201);
    }
  });
  const repo = await runtime.createPrivateRepository({ owner: 'person', ownerType: 'user', name: 'client-test' });
  assert.equal(repo.full_name, 'person/client-test');
  assert.match(calls[0].url, /\/user\/repos$/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer bootstrap');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.private, true);
  assert.equal(body.auto_init, true);
});

test('organization repository bootstrap targets the organization endpoint', async () => {
  const calls = [];
  const runtime = createGitHubRuntime({
    env: { GITHUB_WORKER_TOKEN: 'installation-like-token' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ full_name: 'acme/client-test', default_branch: 'main' }, 201);
    }
  });
  await runtime.createPrivateRepository({ owner: 'acme', ownerType: 'org', name: 'client-test' });
  assert.match(calls[0].url, /\/orgs\/acme\/repos$/);
});

test('GitHub runtime decodes result files from a customer work branch', async () => {
  const runtime = createGitHubRuntime({
    env: { GITHUB_WORKER_TOKEN: 'gh-test' },
    fetchImpl: async () => jsonResponse({ content: Buffer.from('{"final_message":"PASS"}').toString('base64'), encoding: 'base64' })
  });
  const text = await runtime.getFileText({ repositoryFullName: 'owner/site', path: '.akinael/results/t.json', ref: 'akinael/run-1' });
  assert.equal(JSON.parse(text).final_message, 'PASS');
});
