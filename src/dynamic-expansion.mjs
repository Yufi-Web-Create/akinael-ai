import { planProductionPipeline } from './production-pipelines.mjs';

const task = ({ key, role, title, phase, dependsOn = [], mode = 'execute', metadata = {} }) => ({
  task_key: key,
  agent_role: role,
  title,
  phase,
  depends_on: dependsOn,
  mode,
  metadata
});

const WEB_CHANGE_EXPANSIONS = {
  content: [
    task({ key: 'change_copy', role: 'content_editor', title: '変更箇所の最終原稿を作成する', phase: 'direction', dependsOn: ['change_impact_triage'], mode: 'create' }),
    task({ key: 'change_build', role: 'frontend_engineer', title: '対象箇所へ変更を実装する', phase: 'build', dependsOn: ['change_copy'], mode: 'build' }),
    task({ key: 'change_copy_review', role: 'content_editor', title: '実装画面のコピーを独立レビューする', phase: 'review', dependsOn: ['change_build'], mode: 'copy_review' }),
    task({ key: 'change_visual_review', role: 'quality_assurance', title: '変更後の表示とレスポンシブを確認する', phase: 'review', dependsOn: ['change_build'], mode: 'visual_review' }),
    task({ key: 'change_release_gate', role: 'quality_assurance', title: '変更内容をRelease Gateで確認する', phase: 'release', dependsOn: ['change_copy_review', 'change_visual_review'], mode: 'release_gate' })
  ],
  visual: [
    task({ key: 'change_visual_direction', role: 'visual_designer', title: '既存ブランドを維持して変更方向を定義する', phase: 'direction', dependsOn: ['change_impact_triage'], mode: 'design' }),
    task({ key: 'change_build', role: 'frontend_engineer', title: 'ビジュアル変更を実装する', phase: 'build', dependsOn: ['change_visual_direction'], mode: 'build' }),
    task({ key: 'change_visual_review', role: 'quality_assurance', title: '全対象viewportで変更を検証する', phase: 'review', dependsOn: ['change_build'], mode: 'visual_review' }),
    task({ key: 'change_technical_review', role: 'quality_assurance', title: '回帰・実装品質を確認する', phase: 'review', dependsOn: ['change_build'], mode: 'technical_review' }),
    task({ key: 'change_release_gate', role: 'quality_assurance', title: '変更内容をRelease Gateで確認する', phase: 'release', dependsOn: ['change_visual_review', 'change_technical_review'], mode: 'release_gate' })
  ],
  technical: [
    task({ key: 'change_spec', role: 'project_director', title: '変更仕様と回帰条件を確定する', phase: 'direction', dependsOn: ['change_impact_triage'], mode: 'direct' }),
    task({ key: 'change_build', role: 'frontend_engineer', title: '技術変更を実装する', phase: 'build', dependsOn: ['change_spec'], mode: 'build' }),
    task({ key: 'change_technical_review', role: 'quality_assurance', title: 'テスト・エラー処理・回帰を検証する', phase: 'review', dependsOn: ['change_build'], mode: 'technical_review' }),
    task({ key: 'change_release_gate', role: 'quality_assurance', title: '変更内容をRelease Gateで確認する', phase: 'release', dependsOn: ['change_technical_review'], mode: 'release_gate' })
  ],
  strategic: [
    task({ key: 'change_research', role: 'research_strategist', title: '変更に必要な競合・UX・技術情報を調査する', phase: 'research', dependsOn: ['change_impact_triage'], mode: 'research' }),
    task({ key: 'change_direction', role: 'project_director', title: '調査から変更方針と受け入れ条件を確定する', phase: 'direction', dependsOn: ['change_research'], mode: 'direct' }),
    task({ key: 'change_build', role: 'frontend_engineer', title: '方針に基づき変更を実装する', phase: 'build', dependsOn: ['change_direction'], mode: 'build' }),
    task({ key: 'change_seo_a11y', role: 'seo_accessibility', title: 'SEO・アクセシビリティへの影響を確認する', phase: 'review', dependsOn: ['change_build'], mode: 'review' }),
    task({ key: 'change_visual_review', role: 'quality_assurance', title: '全対象viewportで変更を確認する', phase: 'review', dependsOn: ['change_build'], mode: 'visual_review' }),
    task({ key: 'change_technical_review', role: 'quality_assurance', title: '技術品質と回帰を確認する', phase: 'review', dependsOn: ['change_build'], mode: 'technical_review' }),
    task({ key: 'change_release_gate', role: 'quality_assurance', title: '変更内容をRelease Gateで確認する', phase: 'release', dependsOn: ['change_seo_a11y', 'change_visual_review', 'change_technical_review'], mode: 'release_gate' })
  ]
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeExpandedPipeline = (route, triageKey) => {
  if (route === 'answer_only') {
    return [
      task({ key: 'consultation_answer', role: 'content_editor', title: '相談への具体的な回答を作成する', phase: 'build', dependsOn: [triageKey], mode: 'create' }),
      task({ key: 'consultation_review', role: 'quality_assurance', title: '回答の事実性・不足・過剰断定を確認する', phase: 'review', dependsOn: ['consultation_answer'], mode: 'review' })
    ];
  }

  const plan = planProductionPipeline({ type: route });
  if (plan.pipeline === 'web_change_adaptive') return clone(WEB_CHANGE_EXPANSIONS.strategic);

  const roots = new Set(plan.tasks.map((item) => item.task_key));
  const omitted = new Set();
  const source = plan.tasks.filter((item, index) => {
    if (index === 0 && item.phase === 'understand') {
      omitted.add(item.task_key);
      return false;
    }
    return true;
  });

  const keyMap = new Map(source.map((item) => [item.task_key, `expanded_${item.task_key}`]));
  return source.map((item) => ({
    ...clone(item),
    task_key: keyMap.get(item.task_key),
    depends_on: (item.depends_on || []).map((dep) => {
      if (keyMap.has(dep)) return keyMap.get(dep);
      if (omitted.has(dep) || roots.has(dep)) return triageKey;
      return dep;
    })
  }));
};

export const planDynamicExpansion = ({ workflow, task, triage }) => {
  const route = String(triage?.route || '').trim();
  const impact = String(triage?.impact || '').trim();
  const triageKey = task.task_key;

  if (workflow.pipeline === 'web_change_adaptive') {
    const selectedImpact = ['content', 'visual', 'technical', 'strategic'].includes(impact) ? impact : 'strategic';
    return {
      newPhase: selectedImpact === 'strategic' ? 'research' : 'direction',
      metadata: { expansion_route: 'web_change', expansion_impact: selectedImpact, expansion_reason: triage?.reason || null },
      tasks: clone(WEB_CHANGE_EXPANSIONS[selectedImpact])
    };
  }

  const allowedRoute = ['web_new', 'web_change', 'copy', 'social', 'image', 'research', 'automation', 'seo', 'answer_only'].includes(route)
    ? route
    : 'answer_only';
  const tasks = normalizeExpandedPipeline(allowedRoute, triageKey);
  return {
    newPhase: tasks[0]?.phase || 'build',
    metadata: { expansion_route: allowedRoute, expansion_impact: impact || null, expansion_reason: triage?.reason || null },
    tasks
  };
};
