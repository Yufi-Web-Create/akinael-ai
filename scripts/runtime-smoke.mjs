import { createResponsesExecutor } from '../src/openai-responses.mjs';
import { createGitHubRuntime } from '../src/github-runtime.mjs';

const status = [];
const add = (name, state, detail = '') => status.push({ name, state, detail });
const present = (value) => Boolean(String(value || '').trim());

const required = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AKINAEL_GITHUB_APP_ID: process.env.AKINAEL_GITHUB_APP_ID,
  AKINAEL_GITHUB_APP_PRIVATE_KEY: process.env.AKINAEL_GITHUB_APP_PRIVATE_KEY,
  AKINAEL_BOT_USER: process.env.AKINAEL_BOT_USER,
};

for (const [name, value] of Object.entries(required)) {
  add(name, present(value) ? 'configured' : 'missing');
}

let openaiPass = false;
if (present(required.OPENAI_API_KEY)) {
  try {
    const executor = createResponsesExecutor({
      env: {
        ...process.env,
        OPENAI_API_KEY: required.OPENAI_API_KEY,
        GENERAL_AGENT_MODEL: process.env.GENERAL_AGENT_MODEL || 'gpt-5.6-terra'
      }
    });
    const result = await executor.run({
      prompt: 'Runtime connectivity smoke test. Reply with exactly: OK',
      research: false,
      reasoningEffort: 'none'
    });
    openaiPass = String(result.output || '').trim().includes('OK');
    add('OpenAI Responses API', openaiPass ? 'pass' : 'fail', `model: ${result.model || 'unknown'}`);
  } catch (error) {
    add('OpenAI Responses API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('OpenAI Responses API', 'blocked', 'OPENAI_API_KEY missing');
}

let executorGitHubPass = false;
let customerOrgPass = false;
if (present(required.AKINAEL_GITHUB_APP_ID) && present(required.AKINAEL_GITHUB_APP_PRIVATE_KEY)) {
  const executorRepository = process.env.GITHUB_EXECUTOR_REPO || 'Yufi-Web-Create/akinael-ai';
  const customerOwner = process.env.GITHUB_REPO_OWNER || 'akinael-ai-clients';
  try {
    const github = createGitHubRuntime({
      env: {
        ...process.env,
        GITHUB_APP_ID: required.AKINAEL_GITHUB_APP_ID,
        GITHUB_APP_PRIVATE_KEY: required.AKINAEL_GITHUB_APP_PRIVATE_KEY,
        GITHUB_EXECUTOR_REPO: executorRepository,
        GITHUB_REPO_OWNER: customerOwner,
        GITHUB_REPO_OWNER_TYPE: 'org'
      }
    });
    const sha = await github.getBranchHead({ repositoryFullName: executorRepository, branchName: 'main' });
    executorGitHubPass = Boolean(sha);
    add('Core GitHub App access', executorGitHubPass ? 'pass' : 'fail', executorGitHubPass ? `executor main reachable: ${String(sha).slice(0, 8)}` : 'executor branch SHA missing');
  } catch (error) {
    add('Core GitHub App access', 'fail', String(error?.message || error).slice(0, 300));
  }

  try {
    const github = createGitHubRuntime({
      env: {
        ...process.env,
        GITHUB_APP_ID: required.AKINAEL_GITHUB_APP_ID,
        GITHUB_APP_PRIVATE_KEY: required.AKINAEL_GITHUB_APP_PRIVATE_KEY,
        GITHUB_EXECUTOR_REPO: executorRepository,
        GITHUB_REPO_OWNER: customerOwner,
        GITHUB_REPO_OWNER_TYPE: 'org'
      }
    });
    const token = await github.getInstallationTokenForOwner({ owner: customerOwner, ownerType: 'org' });
    customerOrgPass = Boolean(token);
    add('Customer Organization App access', customerOrgPass ? 'pass' : 'fail', customerOrgPass ? `installation reachable: ${customerOwner}` : 'installation token missing');
  } catch (error) {
    add('Customer Organization App access', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('Core GitHub App access', 'blocked', 'GitHub App private key missing');
  add('Customer Organization App access', 'blocked', 'GitHub App private key missing');
}

const configured = Object.values(required).every(present);
const runnerReady = configured && openaiPass && executorGitHubPass && customerOrgPass;
add('Central Codex Runner', runnerReady ? 'ready' : 'blocked', runnerReady
  ? 'OpenAI and both GitHub App installations are reachable'
  : 'runtime dependency check has not fully passed');

const lines = [
  '# Akinael Central Runner Smoke',
  '',
  '> This check covers the central GitHub/Codex runner only. Supabase and Worker credentials belong to Render.',
  '',
  '| Check | State | Detail |',
  '|---|---|---|',
  ...status.map(({ name, state, detail }) => `| ${name} | ${state} | ${String(detail).replace(/\|/g, '\\|')} |`),
  '',
  `**RUNTIME_READY=${runnerReady ? 'true' : 'false'}**`,
  ''
];

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

if (!runnerReady) process.exitCode = 1;
