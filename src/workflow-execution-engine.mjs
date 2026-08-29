import { randomUUID } from 'node:crypto';
import { createExecutionStore } from './execution-store.mjs';
import { createResponsesExecutor, extractLooseJson } from './openai-responses.mjs';
import { createGitHubRuntime } from './github-runtime.mjs';
import { buildTaskPrompt, buildCorrectionPrompt } from './execution-prompts.mjs';
import { planDynamicExpansion } from './dynamic-expansion.mjs';

const REVIEW_MODES = new Set(['review', 'visual_review', 'copy_review', 'technical_review', 'release_gate']);
const EXTERNAL_MODES = new Set(['build', 'visual_review', 'technical_review']);
const MAX_REVIEW_CORRECTIONS = 2;

const nowIso = () => new Date().toISOString();
const safeError = (error) => String(error?.message || error || 'task execution failed').slice(0, 4000);
const artifactKind = (task) => `${task.phase || 'work'}_${task.mode || 'execute'}`.replace(/[^a-z0-9_-]+/gi, '_');
const branchFor = (workflowId) => `akinael/run-${String(workflowId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)}`;
const resultPathFor = (taskId, stage, cycle) => `.akinael/results/${taskId}-${stage}-${cycle}.json`;

const isExternalTask = (context) => EXTERNAL_MODES.has(context.task.mode)
  || context.task.agent_role === 'frontend_engineer'
  || context.task.agent_role === 'seo_accessibility';
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

const parseResultFile = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { final_message: text }; }
};

export const createWorkflowExecutionEngine = ({ env = process.env, fetchImpl = fetch, workerId = null } = {}) => {
  const store = createExecutionStore({ env, fetchImpl });
  const responses = createResponsesExecutor({ env, fetchImpl });
  const github = createGitHubRuntime({ env, fetchImpl });
  const id = workerId || env.WORKER_ID || `worker-${randomUUID()}`;

  const finishFailure = async (taskId, error, result = null) => store.finishTask({
    taskId,
    success: false,
    error: safeError(error),
    result
  });

  const saveTextArtifact = async (context, output, metadata = {}) => store.saveArtifact({
    context,
    kind: artifactKind(context.task),
    title: context.task.title,
    contentText: output,
    metadata: { task_id: context.task.id, task_key: context.task.task_key, ...metadata }
  });

  const dispatchExternal = async (context, { prompt, stage = 'execute', cycle = 0, reviewResult = null } = {}) => {
    if (!context.repository?.repository_full_name) throw new Error('project repository is not configured');
    if (github.mode !== 'connected') throw new Error('GitHub executor credentials are not configured');

    const repositoryFullName = context.repository.repository_full_name;
    const branchName = context.task.metadata?.external_executor?.branch || branchFor(context.workflow.id);
    const permissionProfile = stage === 'correction' || !isReviewTask(context.task) ? ':workspace' : ':read-only';
    const resultPath = resultPathFor(context.task.id, stage, cycle);
    const dispatched = await github.dispatchAgent({
      repositoryFullName,
      ref: context.repository.default_branch || 'main',
      taskId: context.task.id,
      workflowRunId: context.workflow.id,
      prompt,
      branchName,
      permissionProfile,
      stage,
      cycle
    });

    const metadata = {
      ...(context.task.metadata || {}),
      external_executor: {
        state: 'dispatched',
        repository: repositoryFullName,
        branch: branchName,
        workflow_file: dispatched.workflowFile,
        run_name: dispatched.runName,
        run_id: null,
        stage,
        cycle,
        result_path: resultPath,
        dispatched_at: nowIso(),
        review_result: reviewResult || null
      }
    };
    await store.patchTaskMetadata(context.task.id, metadata);
    return { dispatched: true, metadata };
  };

  const executeInternal = async (context) => {
    const prompt = buildTaskPrompt(context);
    const research = context.task.mode === 'research';
    let response = await responses.run({ prompt, research, reasoningEffort: research ? 'high' : 'medium' });
    let output = response.output;
    let review = isReviewTask(context.task) ? normalizeReview(output) : null;

    if (isReviewTask(context.task) && review?.status === 'FAIL' && context.task.mode !== 'release_gate') {
      for (let cycle = 0; cycle < MAX_REVIEW_CORRECTIONS && review?.status === 'FAIL'; cycle += 1) {
        const correctionPrompt = `${buildTaskPrompt(context)}\n\n# Correction pass\n独立レビューで次の問題が見つかりました。再レビューではなく、元の成果物を修正版として作り直してください。\n${JSON.stringify(review, null, 2)}`;
        const correction = await responses.run({ prompt: correctionPrompt, research: false, reasoningEffort: 'medium' });
        const correctionArtifact = await saveTextArtifact(context, correction.output, { correction_cycle: cycle + 1, corrected_from: context.task.task_key });
        context.artifacts = [...(context.artifacts || []), { ...correctionArtifact, content_text: correction.output, metadata: { correction_cycle: cycle + 1 } }];
        response = await responses.run({ prompt: buildTaskPrompt(context), research: false, reasoningEffort: 'medium' });
        output = response.output;
        review = normalizeReview(output);
      }
    }

    const artifact = await saveTextArtifact(context, output, {
      model: response.model,
      response_id: response.responseId,
      citations: response.citations,
      sources: response.sources,
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
        const prompt = buildTaskPrompt(context, { external: true });
        return dispatchExternal(context, { prompt, stage: isReviewTask(context.task) ? 'review' : 'execute', cycle: 0 });
      }
      return await executeInternal(context);
    } catch (error) {
      return finishFailure(context.task.id, error);
    }
  };

  const pollExternalTask = async (task) => {
    const external = task.metadata?.external_executor;
    if (!external?.repository || !external?.run_name) return null;

    let runId = external.run_id;
    if (!runId) {
      const run = await github.findDispatchedRun({
        repositoryFullName: external.repository,
        workflowFile: external.workflow_file,
        runName: external.run_name
      });
      if (!run) return null;
      runId = run.id;
      await store.patchTaskMetadata(task.id, {
        ...task.metadata,
        external_executor: { ...external, state: 'running', run_id: runId, run_url: run.html_url || null }
      });
      if (run.status !== 'completed') return { taskId: task.id, state: run.status };
    }

    const run = await github.getRun({ repositoryFullName: external.repository, runId });
    if (run.status !== 'completed') return { taskId: task.id, state: run.status };

    const resultText = await github.getFileText({
      repositoryFullName: external.repository,
      path: external.result_path,
      ref: external.branch
    });
    const resultFile = parseResultFile(resultText) || {};
    const finalMessage = String(resultFile.final_message || resultFile.message || '').trim();

    if (run.conclusion !== 'success') {
      return finishFailure(task.id, `GitHub executor failed: ${run.conclusion || 'unknown'}`, {
        executor: 'github_codex', run_id: run.id, run_url: run.html_url || null, result: resultFile
      });
    }

    const context = await store.getTaskContext(task.id);
    if (external.stage === 'review') {
      const review = normalizeReview(finalMessage);
      if (!review) {
        return finishFailure(task.id, 'review executor returned no structured PASS/FAIL result', { run_id: run.id, result: resultFile });
      }
      if (review.status === 'FAIL') {
        const cycle = Number(external.cycle || 0);
        if (cycle >= MAX_REVIEW_CORRECTIONS) {
          await saveTextArtifact(context, finalMessage, { executor: 'github_codex', review, run_id: run.id });
          return finishFailure(task.id, review.summary || 'review failed after correction loop', { review, run_id: run.id });
        }
        const correctionPrompt = buildCorrectionPrompt(context, review);
        return dispatchExternal(context, { prompt: correctionPrompt, stage: 'correction', cycle, reviewResult: review });
      }

      const artifact = await saveTextArtifact(context, finalMessage, { executor: 'github_codex', review, run_id: run.id, branch: external.branch });
      return store.finishTask({
        taskId: task.id,
        success: true,
        result: { executor: 'github_codex', artifact_id: artifact?.id || null, review, run_id: run.id, branch: external.branch }
      });
    }

    if (external.stage === 'correction') {
      const nextCycle = Number(external.cycle || 0) + 1;
      const reviewPrompt = buildTaskPrompt(context, { external: true });
      return dispatchExternal(context, { prompt: reviewPrompt, stage: 'review', cycle: nextCycle });
    }

    const artifact = await saveTextArtifact(context, finalMessage || `GitHub executor completed ${run.id}`, {
      executor: 'github_codex', run_id: run.id, branch: external.branch, commit_sha: run.head_sha || null
    });
    return store.finishTask({
      taskId: task.id,
      success: true,
      result: {
        executor: 'github_codex', artifact_id: artifact?.id || null, run_id: run.id, run_url: run.html_url || null,
        branch: external.branch, commit_sha: run.head_sha || null
      }
    });
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

export { normalizeReview, isExternalTask, branchFor, resultPathFor };
