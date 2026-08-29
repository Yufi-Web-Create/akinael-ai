import { createResponsesExecutor } from '../src/openai-responses.mjs';

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
    add('OpenAI Responses API', String(result.output || '').trim().includes('OK') ? 'pass' : 'fail', `model: ${result.model || 'unknown'}`);
  } catch (error) {
    add('OpenAI Responses API', 'fail', String(error?.message || error).slice(0, 300));
  }
} else {
  add('OpenAI Responses API', 'blocked', 'OPENAI_API_KEY missing');
}

const runnerReady = Object.values(required).every(present);
add('Central Codex Runner', runnerReady ? 'ready' : 'blocked', runnerReady
  ? 'required Core Actions secrets/variable are configured'
  : 'configure missing Core Actions values before dispatching customer work');

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

const hardFailures = status.filter((item) => item.state === 'fail');
if (hardFailures.length) process.exitCode = 1;
