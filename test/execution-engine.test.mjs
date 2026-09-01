import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReview, isExternalTask, branchFor, resultPathFor, qaFailureReview, externalExecutionProfile, isReviewRetryExhausted } from '../src/workflow-execution-engine.mjs';
import { planDynamicExpansion } from '../src/dynamic-expansion.mjs';
import { buildTaskPrompt } from '../src/execution-prompts.mjs';

test('normalizeReview parses structured PASS and FAIL outputs', () => {
  assert.deepEqual(normalizeReview('done\n{"status":"PASS","findings":[],"summary":"ok"}'), {
    status: 'PASS', findings: [], summary: 'ok'
  });
  const failed = normalizeReview('{"status":"FAIL","findings":[{"severity":"major","location":"hero"}],"summary":"fix"}');
  assert.equal(failed.status, 'FAIL');
  assert.equal(failed.findings.length, 1);
  assert.equal(normalizeReview('looks good'), null);
});

test('repository QA failures are represented as mandatory major review findings', () => {
  const review = qaFailureReview('npm run qa failed');
  assert.equal(review.status, 'FAIL');
  assert.equal(review.findings[0].severity, 'major');
  assert.match(review.findings[0].expected, /must pass/i);
});

test('external task routing keeps implementation and browser review on GitHub executor', () => {
  assert.equal(isExternalTask({ task: { mode: 'build', agent_role: 'frontend_engineer' } }), true);
  assert.equal(isExternalTask({ task: { mode: 'visual_review', agent_role: 'quality_assurance' } }), true);
  assert.equal(isExternalTask({ task: { mode: 'copy_review', agent_role: 'content_editor' }, repository: { repository_full_name: 'owner/site' } }), true);
  assert.equal(isExternalTask({ task: { mode: 'copy_review', agent_role: 'content_editor' }, repository: null }), false);
  assert.equal(isExternalTask({ task: { mode: 'research', agent_role: 'research_strategist' } }), false);
  assert.match(branchFor('11111111-2222-3333-4444-555555555555'), /^akinael\/run-/);
  assert.equal(resultPathFor('task-1', 'review', 2), '.akinael/results/task-1-review-2.json');
});

test('external model routing reserves Terra for builds, corrections, and technical review', () => {
  assert.deepEqual(externalExecutionProfile({ task: { mode: 'visual_review' }, stage: 'review' }), {
    model: 'gpt-5.6-luna', effort: 'low'
  });
  assert.deepEqual(externalExecutionProfile({ task: { mode: 'technical_review' }, stage: 'review' }), {
    model: 'gpt-5.6-terra', effort: 'medium'
  });
  assert.deepEqual(externalExecutionProfile({ task: { mode: 'visual_review' }, stage: 'correction' }), {
    model: 'gpt-5.6-terra', effort: 'medium'
  });
});

test('review correction exhaustion is terminal instead of restarting the whole task', () => {
  assert.equal(isReviewRetryExhausted({ stage: 'review', cycle: 2, reviewStatus: 'FAIL' }), true);
  assert.equal(isReviewRetryExhausted({ stage: 'correction', cycle: 1, qaFailed: true }), true);
  assert.equal(isReviewRetryExhausted({ stage: 'review', cycle: 1, reviewStatus: 'FAIL' }), false);
  assert.equal(isReviewRetryExhausted({ stage: 'review', cycle: 2, reviewStatus: 'PASS' }), false);
});

test('web change expansion routes content changes through builder and independent reviews', () => {
  const expansion = planDynamicExpansion({
    workflow: { pipeline: 'web_change_adaptive' },
    task: { task_key: 'change_impact_triage' },
    triage: { route: 'web_change', impact: 'content', reason: 'text-only request' }
  });
  assert.equal(expansion.newPhase, 'direction');
  assert.deepEqual(expansion.tasks.map((item) => item.task_key), [
    'change_copy', 'change_build', 'change_copy_review', 'change_visual_review', 'change_release_gate'
  ]);
  assert.deepEqual(expansion.tasks.find((item) => item.task_key === 'change_release_gate').depends_on, ['change_copy_review', 'change_visual_review']);
});

test('general consultation can expand into a full new-web workflow without another human stop', () => {
  const expansion = planDynamicExpansion({
    workflow: { pipeline: 'consultation_triage' },
    task: { task_key: 'consultation_triage' },
    triage: { route: 'web_new', impact: 'strategic', reason: 'new website requested' }
  });
  assert.ok(expansion.tasks.length > 10);
  assert.equal(expansion.tasks[0].depends_on.includes('consultation_triage'), true);
  assert.equal(expansion.tasks.some((item) => item.task_key === 'expanded_build'), true);
  assert.equal(expansion.tasks.some((item) => item.task_key === 'expanded_release_gate'), true);
});

test('execution prompt includes source truth and protected repository paths', () => {
  const prompt = buildTaskPrompt({
    task: { id: 't1', task_key: 'build', agent_role: 'frontend_engineer', title: '実装', phase: 'build', mode: 'build' },
    request: { type: 'web_new', title: '新規サイト', body: '作ってください', priority: 'normal' },
    project: { id: 'p1', name: '店舗サイト', status: 'production', metadata: {} },
    workflow: { id: 'w1' },
    priorTasks: [{ task_key: 'direction', agent_role: 'project_director', title: '方向', status: 'completed', result: { ok: true } }],
    artifacts: [],
    messages: [],
    repository: { repository_full_name: 'owner/site' }
  }, { external: true });
  assert.match(prompt, /作ってください/);
  assert.match(prompt, /owner\/site/);
  assert.match(prompt, /`\.github\/`/);
  assert.match(prompt, /テストを弱め/);
  assert.match(prompt, /読み取り専用環境でQA・build・browserを実行できないことはFindingにしない/);
});
