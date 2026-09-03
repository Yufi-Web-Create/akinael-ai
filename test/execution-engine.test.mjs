import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReview, isExternalTask, branchFor, resultPathFor, qaFailureReview, externalExecutionProfile, isReviewRetryExhausted, reconcileReviewWithQa, evaluateReleaseGate } from '../src/workflow-execution-engine.mjs';
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

test('successful repository QA overrides only read-only runner limitations', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Static checks found no defect, but the read-only workspace could not build.',
    findings: [{
      severity: 'major',
      location: 'npm run qa / .next generation',
      problem: '読み取り専用workspaceの権限制限で .next を作成できずブラウザ検証できない',
      expected: '書き込み可能な環境でnpm run qaを実行する'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'PASS');
  assert.deepEqual(review.findings, []);
});

test('real product findings remain failures even when repository QA passes', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Accessibility issue',
    findings: [{
      severity: 'major',
      location: 'header navigation',
      problem: 'Keyboard focus is not visible',
      expected: 'Provide a visible focus indicator'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'FAIL');
  assert.equal(review.findings.length, 1);
});

test('repository QA failure never gets reconciled into a pass', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'read-only workspace',
    findings: [{
      severity: 'major',
      location: 'npm run qa',
      problem: 'permission denied while building',
      expected: 'build must pass'
    }]
  }, { qaFailed: true, taskMode: 'review' });
  assert.equal(review.status, 'FAIL');
});

test('authoritative QA reconciles the observed Japanese runner-only build failure', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: '環境起因のビルド失敗',
    findings: [{
      severity: 'major',
      location: 'npm run qa / Next.js build',
      problem: '.nextディレクトリを作成できずビルドに失敗したため、QA全体と実ブラウザ検証を完了できない',
      expected: 'Next.js buildおよびnpm run qaが成功し、ブラウザ検証まで完了する'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'PASS');
});

test('authoritative QA ignores missing customer inputs that are outside the implemented prelaunch scope', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Target details are not provided',
    findings: [{
      severity: 'major',
      location: '検証対象全体',
      problem: '店舗サイトのURLと検証環境が未提供のため実画面を検証できない',
      expected: '対象店舗サイトのURLまたは正式情報を指定する'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'PASS');
  assert.deepEqual(review.findings, []);
});

test('authoritative QA ignores derived structured-data checks when official store facts are unavailable', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Official store facts are unavailable',
    findings: [{
      severity: 'minor',
      location: '店舗サイトの構造化データ',
      problem: '対象店舗の最終DOMを確認できないため構造化データを判定できない',
      expected: '正式な店舗情報を用いて構造化データを検証する'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'PASS');
  assert.deepEqual(review.findings, []);
});

test('authoritative repository QA supersedes a reviewer stale test failure observation', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Full test run failed',
    findings: [{
      severity: 'major',
      location: 'Release QA全体 / test/platform-server.test.mjs',
      problem: '全体テストでplatform-server.test.mjsがFAILした',
      expected: '全テストを再実行してPASSさせる'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'PASS');
  assert.deepEqual(review.findings, []);
});

test('common workspace and permission words do not hide a product authorization defect', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'Authorization defect',
    findings: [{
      severity: 'major',
      location: 'workspace settings',
      problem: 'Workspace members can build without the required permission; add a regression test',
      expected: 'Only authorized members can start builds'
    }]
  }, { qaFailed: false, taskMode: 'review' });
  assert.equal(review.status, 'FAIL');
  assert.equal(review.findings.length, 1);
});

test('visual review remains failed when independent browser inspection was not performed', () => {
  const review = reconcileReviewWithQa({
    status: 'FAIL',
    summary: 'read-only runner could not launch browser',
    findings: [{
      severity: 'major',
      location: 'Playwright visual review',
      problem: 'read-only runner environment could not launch the browser',
      expected: 'Run the required independent viewport inspection'
    }]
  }, { qaFailed: false, taskMode: 'visual_review' });
  assert.equal(review.status, 'FAIL');
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

test('release gate resolves completed full-pipeline tasks created by dynamic expansion', () => {
  const reviewTasks = new Set(['seo_a11y_review', 'visual_review', 'copy_review', 'technical_review']);
  const taskKeys = [
    'market_ux_research', 'design_reference_research', 'copy_language_research',
    'direction_synthesis', 'ux_architecture', 'copy_direction', 'design_direction',
    'build', 'seo_a11y_review', 'visual_review', 'copy_review', 'technical_review'
  ];
  const priorTasks = taskKeys.map((taskKey) => ({
    task_key: `expanded_${taskKey}`,
    status: 'completed',
    result: {
      artifact_id: `artifact-${taskKey}`,
      ...(reviewTasks.has(taskKey) ? { review: { status: 'PASS' } } : {})
    }
  }));

  assert.deepEqual(evaluateReleaseGate({ priorTasks }), {
    status: 'PASS',
    findings: [],
    summary: 'Research・Direction・Build・QA・Visual・Copy・Technicalの最新結果と実行証跡を確認し、DEPLOY READYです。'
  });
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
