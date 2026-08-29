import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = new URL('../.github/workflows/akinael-agent.yml', import.meta.url);

test('central Akinael runner keeps the customer-repository security contract', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /target_repository:/);
  assert.match(workflow, /actions\/create-github-app-token@v2/);
  assert.match(workflow, /repository:\s*\$\{\{ inputs\.target_repository \}\}/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /openai\/codex-action@v1/);
  assert.match(workflow, /permission-profile:\s*\$\{\{ inputs\.permission_profile \}\}/);
  assert.match(workflow, /safety-strategy:\s*drop-sudo/);
  assert.match(workflow, /allow-bot-users:\s*\$\{\{ vars\.AKINAEL_BOT_USER \}\}/);
  assert.doesNotMatch(workflow, /allow-bots:\s*true/);
  assert.match(workflow, /npm run qa/);
  assert.match(workflow, /code=1/);
  assert.match(workflow, /Protected path changed/);
  assert.match(workflow, /\.akinael\/results/);
  assert.match(workflow, /permissions:\n\s+contents:\s+read/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
