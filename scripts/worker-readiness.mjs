import { createSupabaseAdmin } from '../src/supabase-admin.mjs';
import { createResponsesExecutor } from '../src/openai-responses.mjs';
import { createGitHubRuntime } from '../src/github-runtime.mjs';

const present = (value) => Boolean(String(value || '').trim());
const checks = [];
const add = (name, state, detail = '') => checks.push({ name, state, detail });

const required = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
  GITHUB_EXECUTOR_REPO: process.env.GITHUB_EXECUTOR_REPO,
};

for (const [name, value] of Object.entries(required)) add(name, present(value) ? 'configured' : 'missing');

const ownerType = String(process.env.GITHUB_REPO_OWNER_TYPE || 'user').trim().toLowerCase();
const bootstrapTokenRequired = ownerType !== 'org';
const bootstrapTokenPresent = present(process.env.GITHUB_BOOTSTRAP_TOKEN);
add(
  'GITHUB_BOOTSTRAP_TOKEN',
  bootstrapTokenRequired ? (bootstrapTokenPresent ? 'configured' : 'missing') : 'not_required',
  bootstrapTokenRequired ? 'required for personal-account repository creation' : 'customer Organization uses its GitHub App installation token'
);

if (present(required.SUPABASE_URL) && present(required.SUPABASE_SECRET_KEY)) {
  try {
    const admin = createSupabaseAdmin({ env: process.env });
    const rows = await admin.request('/rest/v1/tenants', { query: 'select=id,name&name=eq.akinael&limit=1' });
    add('Supabase service access', Array.isArray(rows) && rows.length === 1 ? 'pass' : 'fail', `akinael tenant rows: ${Array.isArray(rows) ? rows.length : 0}`);
  } catch (error) {
    add('Supabase service access', 'fail', String(error?.message || error).slice(0, 300));
  }
} else add('Supabase service access', 'blocked', 'Supabase Worker credentials missing');

if (present(required.OPENAI_API_KEY)) {
  try {
    const executor = createResponsesExecutor({ env: process.env });
    const result = await executor.run({ prompt: 'Runtime connectivity smoke test. Reply exactly OK', research: false, reasoningEffort: 'none' });
    add('OpenAI Responses API', String(result.output || '').trim().includes('OK') ? 'pass' : 'fail', `model: ${result.model || 'unknown'}`);
  } catch (error) {
    add('OpenAI Responses API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else add('OpenAI Responses API', 'blocked', 'OPENAI_API_KEY missing');

const githubReady = present(required.GITHUB_APP_ID) && present(required.GITHUB_APP_INSTALLATION_ID) && present(required.GITHUB_APP_PRIVATE_KEY);
if (githubReady && present(required.GITHUB_EXECUTOR_REPO)) {
  try {
    const github = createGitHubRuntime({ env: process.env });
    const branch = process.env.GITHUB_EXECUTOR_REF || 'main';
    const sha = await github.getBranchHead({ repositoryFullName: required.GITHUB_EXECUTOR_REPO, branchName: branch });
    add('GitHub App service access', sha ? 'pass' : 'fail', sha ? `executor branch reachable: ${String(sha).slice(0, 8)}` : 'no branch SHA returned');

    if (ownerType === 'org' && present(required.GITHUB_REPO_OWNER)) {
      await github.getInstallationTokenForOwner({ owner: required.GITHUB_REPO_OWNER, ownerType: 'org' });
      add('Customer Organization App access', 'pass', `installation reachable: ${required.GITHUB_REPO_OWNER}`);
    }
  } catch (error) {
    add('GitHub App service access', 'fail', String(error?.message || error).slice(0, 300));
  }
} else add('GitHub App service access', 'blocked', 'GitHub App Worker credentials missing');

const requiredMissing = Object.entries(required).filter(([, value]) => !present(value)).map(([name]) => name);
if (bootstrapTokenRequired && !bootstrapTokenPresent) requiredMissing.push('GITHUB_BOOTSTRAP_TOKEN');
const hardFailures = checks.filter((item) => item.state === 'fail');
const requiredPassNames = ['Supabase service access', 'OpenAI Responses API', 'GitHub App service access'];
if (ownerType === 'org') requiredPassNames.push('Customer Organization App access');
const ready = requiredMissing.length === 0 && hardFailures.length === 0
  && checks.filter((item) => requiredPassNames.includes(item.name)).every((item) => item.state === 'pass')
  && requiredPassNames.every((name) => checks.some((item) => item.name === name && item.state === 'pass'));

console.log('# Akinael Render Worker Readiness\n');
console.log('| Check | State | Detail |');
console.log('|---|---|---|');
for (const item of checks) console.log(`| ${item.name} | ${item.state} | ${String(item.detail).replace(/\|/g, '\\|')} |`);
console.log(`\nRUNTIME_READY=${ready ? 'true' : 'false'}`);

if (!ready) process.exitCode = 2;
