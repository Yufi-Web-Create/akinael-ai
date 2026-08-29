import { createSupabaseAdmin } from '../src/supabase-admin.mjs';
import { createResponsesExecutor } from '../src/openai-responses.mjs';
import { createGitHubRuntime } from '../src/github-runtime.mjs';

const status = [];
const add = (name, state, detail = '') => status.push({ name, state, detail });
const present = (value) => Boolean(String(value || '').trim());

const required = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_BOOTSTRAP_TOKEN: process.env.GITHUB_BOOTSTRAP_TOKEN,
};

for (const [name, value] of Object.entries(required)) {
  add(name, present(value) ? 'configured' : 'missing');
}

if (present(required.SUPABASE_URL) && present(required.SUPABASE_SECRET_KEY)) {
  try {
    const admin = createSupabaseAdmin({ env: process.env });
    const rows = await admin.request('/rest/v1/tenants', { query: 'select=id,name&limit=1' });
    add('Supabase API', 'pass', `tenant rows reachable: ${Array.isArray(rows) ? rows.length : 0}`);
  } catch (error) {
    add('Supabase API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('Supabase API', 'blocked', 'credentials missing');
}

if (present(required.OPENAI_API_KEY)) {
  try {
    const executor = createResponsesExecutor({ env: process.env });
    const result = await executor.run({
      prompt: 'Runtime connectivity smoke test. Reply with exactly: OK',
      research: false,
      reasoningEffort: 'none'
    });
    add('OpenAI Responses API', String(result.output || '').trim().includes('OK') ? 'pass' : 'fail', `model: ${result.model || 'unknown'}`);
  } catch (error) {
    add('OpenAI Responses API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('OpenAI Responses API', 'blocked', 'OPENAI_API_KEY missing');
}

const githubAppReady = present(required.GITHUB_APP_ID)
  && present(required.GITHUB_APP_INSTALLATION_ID)
  && present(required.GITHUB_APP_PRIVATE_KEY);

if (githubAppReady) {
  try {
    const runtime = createGitHubRuntime({ env: process.env });
    const repo = process.env.GITHUB_EXECUTOR_REPO || process.env.GITHUB_REPOSITORY;
    const sha = await runtime.getBranchHead({ repositoryFullName: repo, branchName: process.env.GITHUB_REF_NAME || 'feat/workflow-execution-engine' });
    add('GitHub App API', sha ? 'pass' : 'fail', sha ? `branch reachable: ${String(sha).slice(0, 8)}` : 'no branch SHA returned');
  } catch (error) {
    add('GitHub App API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('GitHub App API', 'blocked', 'GitHub App credentials incomplete');
}

const lines = [
  '# Akinael Runtime Smoke',
  '',
  '| Check | State | Detail |',
  '|---|---|---|',
  ...status.map(({ name, state, detail }) => `| ${name} | ${state} | ${String(detail).replace(/\|/g, '\\|')} |`),
  ''
];

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

const hardFailures = status.filter((item) => item.state === 'fail');
if (hardFailures.length) process.exitCode = 1;
