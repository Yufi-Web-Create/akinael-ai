import { createWorkflowExecutionEngine } from './workflow-execution-engine.mjs';

const intervalMs = Math.max(1000, Number(process.env.WORKER_INTERVAL_MS || 5000));
const engine = createWorkflowExecutionEngine();
let stopped = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shutdown = () => { stopped = true; };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(JSON.stringify({ event: 'worker_started', workerId: engine.workerId, modes: engine.modes, intervalMs }));

while (!stopped) {
  try {
    const result = await engine.runOnce();
    if (result.claimed || result.external?.length) {
      console.log(JSON.stringify({ event: 'worker_tick', ...result }));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'worker_error', message: String(error?.message || error) }));
  }
  if (!stopped) await sleep(intervalMs);
}

console.log(JSON.stringify({ event: 'worker_stopped', workerId: engine.workerId }));
