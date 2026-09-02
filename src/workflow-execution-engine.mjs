import { createHash, randomUUID } from 'node:crypto';
import { createExecutionStore } from './execution-store.mjs';
import { createResponsesExecutor, extractLooseJson, classifyOpenAIError } from './openai-responses.mjs';
import { createGitHubRuntime } from './github-runtime.mjs';
import { buildTaskPrompt, buildCorrectionPrompt } from './execution-prompts.mjs';
import { planDynamicExpansion } from './dynamic-expansion.mjs';
import { bootstrapProjectRepository } from './repository-bootstrap.mjs';
import { createProviders } from './providers.mjs';

const REVIEW_MODES = new Set(['review', 'visual_review', 'copy_review', 'technical_review', 'release_gate']);
const EXTERNAL_MODES = new Set(['build', 'visual_review', 'technical_review']);
const MAX_REVIEW_CORRECTIONS = 2;

const nowIso = () => new Date().toISOString();
const safeError = (error) => String(error?.message || error || 'task execution failed').slice(0, 4000);
const artifactKind = (task) => `${task.phase || 'work'}_${task.mode || 'execute'}`.replace(/[^a-z0-9_-]+/gi, '_');
const branchFor = (workflowId) => `akinael/run-${String(workflowId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)}`;
const resultPathFor = (taskId, stage, cycle) => `.akinael/results/${taskId}-${stage}-${cycle}.json`;
const nextCheckAt = () => new Date(Date.now() + 5_000).toISOString();
const LIGHTWEIGHT_INTERNAL_MODES = new Set(['analyze', 'research', 'review', 'copy_review', 'release_gate', 'triage']);

const configuredModel = (value, fallback) => String(value || fallback).trim();

const externalExecutionProfile = ({ task, stage, env = {} }) => {
  const lightweightReview = stage === 'review' && task?.mode !== 'technical_review';
  return {
    model: lightweightReview
      ? configuredModel(env.REVIEW_AGENT_MODEL, 'gpt-5.6-luna')
      : configuredModel(env.GENERAL_AGENT_MODEL, 'gpt-5.6-terra'),
    effort: lightweightReview ? 'low' : 'medium'
  };
};

const isReviewRetryExhausted = ({ stage, cycle, qaFailed = false, reviewStatus = null }) => (
  (stage === 'review' && reviewStatus === 'FAIL' && cycle >= MAX_REVIEW_CORRECTIONS)
  || (stage === 'correction' && qaFailed && cycle >= MAX_REVIEW_CORRECTIONS - 1)
);

const isExternalTask = (context) => EXTERNAL_MODES.has(context.task.mode)
  || context.task.agent_role === 'frontend_engineer'
  || context.task.agent_role === 'seo_accessibility'
  || (context.task.mode === 'copy_review' && Boolean(context.repository?.repository_full_name));
const isReviewTask = (task) => REVIEW_MODES.has(task.mode);

const normalizeReview = (output) => {
  const parsed = extractLooseJson(output);
  if (!parsed || !['PASS', 'FAIL'].includes(String(parsed.status || '').toUpperCase())) return null;
  return {
    status: String(parsed.status).toUpperCase(),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    summary: parsed.summary || null
  };
};

const qaFailureReview = (summary = 'Repository QA failed') => ({
  status: 'FAIL',
  findings: [{
    severity: 'major',
    location: 'repository QA',
    problem: summary,
    expected: 'Repository quality command must pass before the task can complete.'
  }],
  summary
});

const mergeReviewFailure = (review, extra) => {
  if (!review) return extra;
  if (review.status !== 'FAIL') return extra;
  return {
    status: 'FAIL',
    findings: [...(review.findings || []), ...(extra.findings || [])],
    summary: [review.summary, extra.summary].filter(Boolean).join(' / ')
  };
};

const isExecutionEnvironmentFinding = (finding) => {
  const text = [
    finding?.problem,
    finding?.expected,
    finding?.location
  ].filter(Boolean).join(' ');
  const explicitRunnerFailure = /(could not|cannot|unable to|permission denied|eperm|enoent|failed to (create|write|run|launch|listen)|作成できず|実行できず|起動できず|書き込めず|読み取り専用|環境起因)/i.test(text);
  const blockedVerification = /(repository qa|npm run qa|next(\.js)? build|browser|playwright|\.next|runner|sandbox|workspace|ビルド|ブラウザ|テスト)/i.test(text);
  return explicitRunnerFailure && blockedVerification;
};

const reconcileReviewWithQa = (review, { qaFailed = false, taskMode = null } = {}) => {
  const environmentAwareReview = new Set(['review', 'technical_review']);
  if (!review || qaFailed || !environmentAwareReview.has(taskMode) || review.status !== 'FAIL') return review;
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const productFindings = findings.filter((finding) => !isExecutionEnvironmentFinding(finding));
  if (productFindings.length > 0 || findings.length === 0) {
    return productFindings.length === findings.length ? review : { ...review, findings: productFindings };
  }
  return {
    status: 'PASS',
    findings: [],
    summary: 'Repository QA passed; the reviewer reported only read-only runner limitations, not a product defect.'
  };
};

const RELEASE_GATE_REQUIRED = [
  'market_ux_research', 'design_reference_research', 'copy_language_research',
  'direction_synthesis', 'ux_architecture', 'copy_direction', 'design_direction',
  'build', 'seo_a11y_review', 'visual_review', 'copy_review', 'technical_review'
];
const RELEASE_GATE_REVIEW_TASKS = new Set(['seo_a11y_review', 'visual_review', 'copy_review', 'technical_review']);

const evaluateReleaseGate = (context) => {
  const tasks = new Map((context.priorTasks || []).map((task) => [task.task_key, task]));
  const missing = RELEASE_GATE_REQUIRED.filter((key) => !tasks.has(key) || tasks.get(key).status !== 'completed');
  const failedReviews = RELEASE_GATE_REQUIRED.filter((key) => {
    if (!RELEASE_GATE_REVIEW_TASKS.has(key)) return false;
    return tasks.get(key)?.result?.review?.status !== 'PASS';
  });
  const missingEvidence = RELEASE_GATE_REQUIRED.filter((key) => {
    const result = tasks.get(key)?.result || {};
    return !result.artifact_id && !result.run_id;
  });
  const findings = [
    ...missing.map((key) => ({ severity: 'major', location: key, problem: '前段タスクがcompletedではありません。', expected: '依存タスクをcompletedにすること。' })),
    ...failedReviews.map((key) => ({ severity: 'major', location: key, problem: '最新のレビュー結果がPASSではありません。', expected: '最新レビューをPASSにすること。' })),
    ...missingEvidence.map((key) => ({ severity: 'major', location: key, problem: '実行artifactまたはRun証跡がありません。', expected: 'artifact_idまたはrun_idを保存すること。' }))
  ];
  if (findings.length > 0) {
    return { status: 'FAIL', findings, summary: '前段タスクの最新status・レビュー結果・実行証跡がDEPLOY READY条件を満たしていません。' };
  }
  return {
    status: 'PASS',
    findings: [],
    summary: 'Research・Direction・Build・QA・Visual・Copy・Technicalの最新結果と実行証跡を確認し、DEPLOY READYです。'
  };
};

const parseResultFile = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { final_message: text }; }
};

export const createWorkflowExecutionEngine = ({ env = process.env, fetchImpl = fetch, workerId = null } = {}) => {
  const store = createExecutionStore({ env, fetchImpl });
  const providers = createProviders(env);
  const responses = createResponsesExecutor({ env, fetchImpl });
  const github = createGitHubRuntime({ env, fetchImpl });
  const id = workerId || env.WORKER_ID || `worker-${randomUUID()}`;

  const finishFailure = async (taskId, error, result = null) => store.finishTask({
    taskId,
    success: false,
    error: safeError(error),
    result
  });

  const finishTerminalFailure = async (task, error, result = null) => {
    await store.stopTaskRetries(task.id, task.attempts).catch(() => null);
    return finishFailure(task.id, error, result);
  };

  const markExecutorFailed = async (taskId, error, result = null) => store.patchExecutorJob(taskId, {
    status: 'failed',
    result,
    last_error: safeError(error),
    next_check_at: null,
    completed_at: nowIso(),
    updated_at: nowIso()
  });

  const markExecutorSucceeded = async (taskId, result) => store.patchExecutorJob(taskId, {
    status: 'succeeded',
    result,
    last_error: null,
    next_check_at: null,
    completed_at: nowIso(),
    updated_at: nowIso()
  });

  const saveTextArtifact = async (context, output, metadata = {}) => store.saveArtifact({
    context,
    kind: artifactKind(context.task),
    title: context.task.title,
    contentText: output,
    metadata: { task_id: context.task.id, task_key: context.task.task_key, ...metadata }
  });

  const executeImageTask = async (context) => {
    const prompt = buildTaskPrompt(context);
    const generated = await providers.images.generate({ prompt, size: env.OPENAI_IMAGE_SIZE || '1536x1024', quality: env.OPENAI_IMAGE_QUALITY || 'low' });
    if (!generated.body?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('image generation did not return a PNG');
    const width = generated.body.readUInt32BE(16);
    const height = generated.body.readUInt32BE(20);
    const sha256 = createHash('sha256').update(generated.body).digest('hex');
    const storageKey = `${context.workflow.tenant_id}/${context.workflow.project_id}/assets/${context.task.id}.png`;
    const stored = await providers.storage.putObject({ key: storageKey, body: generated.body, contentType: generated.contentType });
    const artifact = await store.saveArtifact({
      context,
      kind: 'asset_image',
      title: context.task.title,
      storageKey,
      contentText: JSON.stringify({ asset_type: 'image', format: 'png', width, height, byte_length: generated.body.length, sha256, storage_key: storageKey }),
      metadata: { task_id: context.task.id, task_key: context.task.task_key, provider: generated.model, storage_provider: stored.provider, content_type: generated.contentType, width, height, byte_length: generated.body.length, sha256, visual_evidence: 'generated_png_validated' }
    });
    return store.finishTask({ taskId: context.task.id, success: true, result: { artifact_id: artifact?.id || null, asset_type: 'image', format: 'png', width, height, byte_length: generated.body.length, sha256, storage_key: storageKey, storage_provider: stored.provider, model: generated.model } });
  };

  const dispatchExternal = async (context, { prompt, stage = 'execute', cycle = 0, reviewResult = null } = {}) => {
    if (!context.repository?.repository_full_name) throw new Error('project repository is not configured');
    if (github.mode !== 'connected') throw new Error('GitHub executor credentials are not configured');

    const repositoryFullName = context.repository.repository_full_name;
    const branchName = context.task.metadata?.external_executor?.branch || branchFor(context.workflow.id);
    const permissionProfile = stage === 'correction' || !isReviewTask(context.task) ? ':workspace' : ':read-only';
    const resultPath = resultPathFor(context.task.id, stage, cycle);
    const { model, effort } = externalExecutionProfile({ task: context.task, stage, env });
    const executorPrompt = context.task.mode === 'visual_review' && stage === 'review'
      ? `${prompt}\n\n# Attached visual evidence\nGitHub Actions captured full-page screenshots at 360px, 768px, and 1280px and attached them to this Codex run. Inspect all three images directly. Do not fail merely because the read-only reviewer cannot launch another server or browser.`
      : prompt;
    const dispatched = await github.dispatchAgent({
      repositoryFullName,
      ref: context.repository.default_branch || 'main',
      taskId: context.task.id,
      workflowRunId: context.workflow.id,
      prompt: executorPrompt,
      branchName,
      permissionProfile,
      taskMode: context.task.mode,
      stage,
      cycle,
      model,
      effort
    });

    const externalExecutor = {
      state: 'dispatched',
      repository: repositoryFullName,
      executor_repository: dispatched.executorRepository,
      executor_ref: dispatched.executorRef,
      branch: branchName,
      workflow_file: dispatched.workflowFile,
      run_name: dispatched.runName,
      run_id: null,
      stage,
      cycle,
      result_path: resultPath,
      dispatched_at: nowIso(),
      review_result: reviewResult || null,
      model,
      effort
    };
    const metadata = { ...(context.task.metadata || {}), external_executor: externalExecutor };
    await store.patchTaskMetadata(context.task.id, metadata);
    await store.upsertExecutorJob({
      taskId: context.task.id,
      status: 'dispatched',
      payload: externalExecutor,
      nextCheckAt: nextCheckAt()
    });
    return { dispatched: true, metadata };
  };

  const executeInternal = async (context) => {
    if (context.task.task_key === 'asset_create') return executeImageTask(context);
    if (context.task.mode === 'release_gate') {
      const review = evaluateReleaseGate(context);
      const output = JSON.stringify({ status: review.status, findings: review.findings, summary: review.summary });
      const artifact = await saveTextArtifact(context, output, { review, deterministic: true });
      if (review.status === 'FAIL') {
        return finishFailure(context.task.id, review.summary || 'release gate failed', { artifact_id: artifact?.id || null, review });
      }
      return store.finishTask({
        taskId: context.task.id,
        success: true,
        result: { artifact_id: artifact?.id || null, review, evidence: RELEASE_GATE_REQUIRED }
      });
    }
    const prompt = buildTaskPrompt(context);
    const research = context.task.mode === 'research';
    const lightweight = LIGHTWEIGHT_INTERNAL_MODES.has(context.task.mode);
    let response = await responses.run({ prompt, research, lightweight, reasoningEffort: research ? 'medium' : lightweight ? 'low' : 'medium' });
    let output = response.output;
    let review = isReviewTask(context.task) ? normalizeReview(output) : null;

    if (isReviewTask(context.task) && review?.status === 'FAIL' && context.task.mode !== 'release_gate') {
      for (let cycle = 0; cycle < MAX_REVIEW_CORRECTIONS && review?.status === 'FAIL'; cycle += 1) {
        const correctionPrompt = `${buildTaskPrompt(context)}\n\n# Correction pass\n独立レビューで次の問題が見つかりました。再レビューではなく、元の成果物を修正版として作り直してください。\n${JSON.stringify(review, null, 2)}`;
        const correction = await responses.run({ prompt: correctionPrompt, research: false, lightweight: false, reasoningEffort: 'medium' });
        const correctionArtifact = await saveTextArtifact(context, correction.output, { correction_cycle: cycle + 1, corrected_from: context.task.task_key, model: correction.model, usage: correction.usage });
        context.artifacts = [...(context.artifacts || []), { ...correctionArtifact, content_text: correction.output, metadata: { correction_cycle: cycle + 1 } }];
        response = await responses.run({ prompt: buildTaskPrompt(context), research: false, lightweight: true, reasoningEffort: 'low' });
        output = response.output;
        review = normalizeReview(output);
      }
    }

    const artifact = await saveTextArtifact(context, output, {
      model: response.model,
      response_id: response.responseId,
      citations: response.citations,
      sources: response.sources,
      usage: response.usage,
      review
    });

    if (context.task.mode === 'triage') {
      const triage = extractLooseJson(output) || {};
      const expansion = planDynamicExpansion({ workflow: context.workflow, task: context.task, triage });
      await store.appendWorkflowTasks({
        workflowRunId: context.workflow.id,
        tasks: expansion.tasks,
        newPhase: expansion.newPhase,
        metadata: expansion.metadata
      });
    }

    if (isReviewTask(context.task) && review?.status === 'FAIL') {
      return finishFailure(context.task.id, review.summary || 'review failed', { artifact_id: artifact?.id || null, review });
    }

    return store.finishTask({
      taskId: context.task.id,
      success: true,
      result: {
        artifact_id: artifact?.id || null,
        output_summary: String(output).slice(0, 2000),
        review,
        model: response.model,
        citations: response.citations || []
      }
    });
  };

  const executeClaimedTask = async (claim) => {
    const context = await store.getTaskContext(claim.task_id);
    try {
      if (isExternalTask(context)) {
        if (!context.repository?.repository_full_name) {
          context.repository = await bootstrapProjectRepository({ context, github, store, env });
        }
        const prompt = buildTaskPrompt(context, { external: true });
        return dispatchExternal(context, { prompt, stage: isReviewTask(context.task) ? 'review' : 'execute', cycle: 0 });
      }
      return await executeInternal(context);
    } catch (error) {
      const classified = classifyOpenAIError(error);
      if (classified.terminal) return finishTerminalFailure(context.task, classified.message, { failure_kind: classified.kind });
      return finishFailure(context.task.id, error);
    }
  };

  const failExternal = async (task, error, result = null, { terminal = false } = {}) => {
    await markExecutorFailed(task.id, error, result).catch(() => null);
    if (terminal) await store.stopTaskRetries(task.id, task.attempts).catch(() => null);
    return finishFailure(task.id, error, result);
  };

  const pollExternalTask = async (task) => {
    const external = task.metadata?.external_executor;
    if (!external?.repository || !external?.run_name) return null;
    const timeoutMs = Math.max(60_000, Number(env.TASK_TIMEOUT_MS || 45 * 60_000));
    if (task.started_at && Date.now() - Date.parse(task.started_at) > timeoutMs) {
      return failExternal(task, `External task timed out after ${timeoutMs}ms`, {
        executor: 'github_codex', failure_kind: 'timeout', started_at: task.started_at, timeout_ms: timeoutMs
      });
    }
    const executorRepository = external.executor_repository || github.executorRepository;

    let runId = external.run_id;
    if (!runId) {
      const run = await github.findDispatchedRun({
        executorRepository,
        workflowFile: external.workflow_file,
        runName: external.run_name
      });
      if (!run) return null;
      runId = run.id;
      const updatedExternal = { ...external, state: 'running', run_id: runId, run_url: run.html_url || null };
      await store.patchTaskMetadata(task.id, { ...task.metadata, external_executor: updatedExternal });
      await store.upsertExecutorJob({
        taskId: task.id,
        status: 'running',
        externalReference: String(runId),
        externalUrl: run.html_url || null,
        payload: updatedExternal,
        nextCheckAt: nextCheckAt()
      });
      if (run.status !== 'completed') return { taskId: task.id, state: run.status };
    }

    const run = await github.getRun({ repositoryFullName: executorRepository, runId });
    if (run.status !== 'completed') {
      await store.upsertExecutorJob({
        taskId: task.id,
        status: 'running',
        externalReference: String(runId),
        externalUrl: run.html_url || null,
        payload: { stage: external.stage, cycle: external.cycle },
        nextCheckAt: nextCheckAt()
      });
      return { taskId: task.id, state: run.status };
    }

    const resultText = await github.getFileText({
      repositoryFullName: external.repository,
      path: external.result_path,
      ref: external.branch
    });
    const resultFile = parseResultFile(resultText);
    if (run.conclusion !== 'success') {
      const failure = await github.getRunFailure({ repositoryFullName: executorRepository, runId: run.id }).catch(() => ({ kind: 'runtime', terminal: false }));
      const message = failure.terminal ? failure.message : `GitHub executor failed: ${run.conclusion || 'unknown'}`;
      return failExternal(task, message, {
        executor: 'github_codex', run_id: run.id, run_url: run.html_url || null, result: resultFile, failure_kind: failure.kind
      }, { terminal: Boolean(failure.terminal) });
    }
    if (!resultFile) {
      return failExternal(task, 'GitHub executor completed without a machine-readable result file', { run_id: run.id, run_url: run.html_url || null });
    }
    const finalMessage = String(resultFile.final_message || resultFile.message || '').trim();
    const qaFailed = String(resultFile.qa_conclusion || '').toLowerCase() === 'failure';

    const context = await store.getTaskContext(task.id);
    if (external.stage === 'review') {
      let review = normalizeReview(finalMessage);
      if (qaFailed) review = mergeReviewFailure(review, qaFailureReview('Repository QA failed during independent review'));
      review = reconcileReviewWithQa(review, { qaFailed, taskMode: context.task.mode });
      if (!review) {
        return failExternal(task, 'review executor returned no structured PASS/FAIL result', { run_id: run.id, result: resultFile });
      }
      if (review.status === 'FAIL') {
        const cycle = Number(external.cycle || 0);
        if (isReviewRetryExhausted({ stage: 'review', cycle, reviewStatus: review.status })) {
          await saveTextArtifact(context, finalMessage, { executor: 'github_codex', review, run_id: run.id });
          return failExternal(task, review.summary || 'review failed after correction loop', {
            review, run_id: run.id, result: resultFile, failure_kind: 'review_corrections_exhausted'
          }, { terminal: true });
        }
        const correctionPrompt = buildCorrectionPrompt(context, review);
        return dispatchExternal(context, { prompt: correctionPrompt, stage: 'correction', cycle, reviewResult: review });
      }

      const branchCommit = await github.getBranchHead({ repositoryFullName: external.repository, branchName: external.branch });
      const artifact = await saveTextArtifact(context, finalMessage, {
        executor: 'github_codex', review, run_id: run.id, branch: external.branch, commit_sha: branchCommit
      });
      const taskResult = { executor: 'github_codex', artifact_id: artifact?.id || null, review, run_id: run.id, branch: external.branch, commit_sha: branchCommit };
      await markExecutorSucceeded(task.id, { ...taskResult, qa_conclusion: resultFile.qa_conclusion || null });
      return store.finishTask({ taskId: task.id, success: true, result: taskResult });
    }

    if (external.stage === 'correction') {
      const currentCycle = Number(external.cycle || 0);
      if (qaFailed) {
        const review = mergeReviewFailure(external.review_result, qaFailureReview('Repository QA still fails after Builder correction'));
        if (isReviewRetryExhausted({ stage: 'correction', cycle: currentCycle, qaFailed })) {
          return failExternal(task, review.summary, {
            review, run_id: run.id, result: resultFile, failure_kind: 'review_corrections_exhausted'
          }, { terminal: true });
        }
        const correctionPrompt = buildCorrectionPrompt(context, review);
        return dispatchExternal(context, { prompt: correctionPrompt, stage: 'correction', cycle: currentCycle + 1, reviewResult: review });
      }
      const nextCycle = currentCycle + 1;
      const reviewPrompt = buildTaskPrompt(context, { external: true });
      return dispatchExternal(context, { prompt: reviewPrompt, stage: 'review', cycle: nextCycle });
    }

    if (qaFailed) {
      return failExternal(task, 'Repository QA failed after implementation', {
        executor: 'github_codex', run_id: run.id, run_url: run.html_url || null, result: resultFile
      });
    }

    const branchCommit = await github.getBranchHead({ repositoryFullName: external.repository, branchName: external.branch });
    const artifact = await saveTextArtifact(context, finalMessage || `GitHub executor completed ${run.id}`, {
      executor: 'github_codex', run_id: run.id, branch: external.branch, commit_sha: branchCommit
    });
    const taskResult = {
      executor: 'github_codex', artifact_id: artifact?.id || null, run_id: run.id, run_url: run.html_url || null,
      branch: external.branch, commit_sha: branchCommit, qa_conclusion: resultFile.qa_conclusion || null
    };
    await markExecutorSucceeded(task.id, taskResult);
    return store.finishTask({ taskId: task.id, success: true, result: taskResult });
  };

  const pollExternalTasks = async () => {
    if (github.mode !== 'connected') return [];
    const tasks = await store.listRunningExternalTasks();
    const results = [];
    for (const task of tasks) {
      try {
        const result = await pollExternalTask(task);
        if (result) results.push(result);
      } catch (error) {
        results.push({ taskId: task.id, error: safeError(error) });
      }
    }
    return results;
  };

  const runOnce = async () => {
    const external = await pollExternalTasks();
    const claim = await store.claimNextTask(id);
    if (!claim?.task_id) return { workerId: id, claimed: false, external };
    const result = await executeClaimedTask(claim);
    return { workerId: id, claimed: true, taskId: claim.task_id, result, external };
  };

  return {
    workerId: id,
    modes: { responses: responses.mode, github: github.mode, supabase: store.config.adminConfigured ? 'connected' : 'not_configured' },
    runOnce,
    pollExternalTasks,
    executeClaimedTask
  };
};

export { normalizeReview, isExternalTask, branchFor, resultPathFor, qaFailureReview, externalExecutionProfile, isReviewRetryExhausted, isExecutionEnvironmentFinding, reconcileReviewWithQa };
