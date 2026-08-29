import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = new URL('../templates/customer-web/.github/workflows/akinael-agent.yml', import.meta.url);

test('customer web runner keeps the Codex and security contract', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /openai\/codex-action@v1/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /permission-profile:\s*\$\{\{ inputs\.permission_profile \}\}/);
  assert.match(workflow, /safety-strategy:\s*drop-sudo/);
  assert.match(workflow, /npm run qa/);
  assert.match(workflow, /Protected path changed/);
  assert.match(workflow, /\.akinael\/results/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
