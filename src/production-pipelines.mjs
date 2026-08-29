const task = ({ key, role, title, phase, dependsOn = [], mode = 'execute', metadata = {} }) => ({
  task_key: key,
  agent_role: role,
  title,
  phase,
  depends_on: dependsOn,
  mode,
  metadata
});

const WEB_NEW = {
  pipeline: 'web_new_full',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'deploy_ready', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'intake_spec', role: 'customer_intake', title: '依頼・事業情報・制約を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'project_spec', role: 'project_director', title: 'PROJECT_SPECと受け入れ条件を確定する', phase: 'understand', dependsOn: ['intake_spec'], mode: 'direct' }),
    task({ key: 'market_ux_research', role: 'research_strategist', title: '市場・競合・UXリサーチを行う', phase: 'research', dependsOn: ['project_spec'], mode: 'research' }),
    task({ key: 'design_reference_research', role: 'visual_designer', title: 'デザイン参考事例を調査し判断理由を抽出する', phase: 'research', dependsOn: ['project_spec'], mode: 'research', metadata: { implementation_forbidden: true } }),
    task({ key: 'copy_language_research', role: 'content_editor', title: '顧客言語・競合・検索意図からコピーを調査する', phase: 'research', dependsOn: ['project_spec'], mode: 'research', metadata: { drafting_forbidden: true } }),
    task({ key: 'direction_synthesis', role: 'project_director', title: 'Researchを統合して制作方向を確定する', phase: 'direction', dependsOn: ['market_ux_research', 'design_reference_research', 'copy_language_research'], mode: 'direct' }),
    task({ key: 'ux_architecture', role: 'ux_architect', title: '情報設計・導線・ページ構成を設計する', phase: 'direction', dependsOn: ['direction_synthesis'], mode: 'design' }),
    task({ key: 'copy_direction', role: 'content_editor', title: 'COPY_DIRECTION・COPY_GUIDEと掲載原稿を作る', phase: 'direction', dependsOn: ['ux_architecture'], mode: 'create' }),
    task({ key: 'design_direction', role: 'visual_designer', title: 'DESIGN_DIRECTION・DESIGN_SYSTEMを作る', phase: 'direction', dependsOn: ['ux_architecture'], mode: 'create' }),
    task({ key: 'build', role: 'frontend_engineer', title: '仕様・コピー・デザインに基づいて実装する', phase: 'build', dependsOn: ['copy_direction', 'design_direction'], mode: 'build' }),
    task({ key: 'seo_a11y_review', role: 'seo_accessibility', title: '最終DOMと実画面のSEO・アクセシビリティを検証する', phase: 'review', dependsOn: ['build'], mode: 'review' }),
    task({ key: 'visual_review', role: 'quality_assurance', title: '実ブラウザ・全viewportでVisual Reviewを行う', phase: 'review', dependsOn: ['build'], mode: 'visual_review' }),
    task({ key: 'copy_review', role: 'content_editor', title: '実装画面の最終コピーを独立レビューする', phase: 'review', dependsOn: ['build'], mode: 'copy_review' }),
    task({ key: 'technical_review', role: 'quality_assurance', title: 'コード・テスト・API・セキュリティを独立レビューする', phase: 'review', dependsOn: ['build'], mode: 'technical_review' }),
    task({ key: 'release_gate', role: 'quality_assurance', title: '全QA結果を統合しDEPLOY READYを判定する', phase: 'release', dependsOn: ['seo_a11y_review', 'visual_review', 'copy_review', 'technical_review'], mode: 'release_gate' })
  ]
};

const WEB_CHANGE = {
  pipeline: 'web_change_adaptive',
  initialPhase: 'understand',
  metadata: {
    autonomous_until: 'deploy_ready',
    research_required: 'conditional',
    dynamic_expansion: true,
    expansion_rule: 'web_change_impact'
  },
  tasks: [
    task({ key: 'change_intake', role: 'customer_intake', title: '変更内容と対象箇所を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'change_impact_triage', role: 'project_director', title: '変更影響を判定し必要工程を選択する', phase: 'triage', dependsOn: ['change_intake'], mode: 'triage', metadata: { must_expand_workflow: true } })
  ]
};

const COPY = {
  pipeline: 'copy_research',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'copy_intake', role: 'customer_intake', title: '目的・媒体・事実情報を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'copy_research', role: 'content_editor', title: '顧客言語・競合・媒体文脈を調査する', phase: 'research', dependsOn: ['copy_intake'], mode: 'research' }),
    task({ key: 'copy_direction', role: 'project_director', title: '訴求順序・トーン・禁止表現を確定する', phase: 'direction', dependsOn: ['copy_research'], mode: 'direct' }),
    task({ key: 'copy_create', role: 'content_editor', title: 'コピーを制作する', phase: 'build', dependsOn: ['copy_direction'], mode: 'create' }),
    task({ key: 'copy_review', role: 'content_editor', title: '初稿と分離したコンテキストでコピーをレビューする', phase: 'review', dependsOn: ['copy_create'], mode: 'copy_review' }),
    task({ key: 'quality_gate', role: 'quality_assurance', title: '事実性・要件・納品形式を最終確認する', phase: 'release', dependsOn: ['copy_review'], mode: 'release_gate' })
  ]
};

const SOCIAL = {
  pipeline: 'social_content',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'social_intake', role: 'customer_intake', title: '媒体・目的・素材・投稿条件を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'social_research', role: 'research_strategist', title: 'ブランド文脈・競合・直近投稿を調査する', phase: 'research', dependsOn: ['social_intake'], mode: 'research' }),
    task({ key: 'social_create', role: 'content_editor', title: '投稿案を制作する', phase: 'build', dependsOn: ['social_research'], mode: 'create' }),
    task({ key: 'social_review', role: 'quality_assurance', title: '事実性・トーン・媒体適合性を確認する', phase: 'review', dependsOn: ['social_create'], mode: 'review' })
  ]
};

const IMAGE = {
  pipeline: 'image_creative',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'image_intake', role: 'customer_intake', title: '用途・サイズ・素材・権利条件を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'visual_reference_research', role: 'visual_designer', title: '参考表現を調査しビジュアル原則を抽出する', phase: 'research', dependsOn: ['image_intake'], mode: 'research' }),
    task({ key: 'visual_direction', role: 'visual_designer', title: '生成・制作のビジュアル方向を定義する', phase: 'direction', dependsOn: ['visual_reference_research'], mode: 'direct' }),
    task({ key: 'asset_create', role: 'visual_designer', title: '画像アセットを制作する', phase: 'build', dependsOn: ['visual_direction'], mode: 'create' }),
    task({ key: 'visual_review', role: 'quality_assurance', title: '用途適合・可読性・破綻・権利リスクを確認する', phase: 'review', dependsOn: ['asset_create'], mode: 'visual_review' })
  ]
};

const RESEARCH = {
  pipeline: 'research',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'research_intake', role: 'customer_intake', title: '調査目的・範囲・判断基準を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'research_execute', role: 'research_strategist', title: '一次情報を優先して調査・比較する', phase: 'research', dependsOn: ['research_intake'], mode: 'research' }),
    task({ key: 'research_review', role: 'quality_assurance', title: '根拠・鮮度・引用・結論の妥当性を検証する', phase: 'review', dependsOn: ['research_execute'], mode: 'review' })
  ]
};

const AUTOMATION = {
  pipeline: 'automation',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'deploy_ready', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'automation_intake', role: 'customer_intake', title: '現行業務・入力・出力・例外を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'automation_spec', role: 'project_director', title: '自動化範囲・承認Gate・受け入れ条件を定義する', phase: 'direction', dependsOn: ['automation_intake'], mode: 'direct' }),
    task({ key: 'automation_research', role: 'research_strategist', title: 'API・連携仕様・制限を調査する', phase: 'research', dependsOn: ['automation_spec'], mode: 'research' }),
    task({ key: 'automation_build', role: 'frontend_engineer', title: '自動化フローを実装する', phase: 'build', dependsOn: ['automation_research'], mode: 'build' }),
    task({ key: 'automation_review', role: 'quality_assurance', title: '失敗時処理・権限・重複実行・回帰を検証する', phase: 'review', dependsOn: ['automation_build'], mode: 'technical_review' }),
    task({ key: 'release_gate', role: 'quality_assurance', title: '有効化前のRelease Gateを判定する', phase: 'release', dependsOn: ['automation_review'], mode: 'release_gate' })
  ]
};

const SEO = {
  pipeline: 'seo',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: true, dynamic_expansion: false },
  tasks: [
    task({ key: 'seo_intake', role: 'customer_intake', title: '対象ページ・目的・現状を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'seo_research', role: 'research_strategist', title: '検索意図・競合・技術状態を調査する', phase: 'research', dependsOn: ['seo_intake'], mode: 'research' }),
    task({ key: 'seo_execute', role: 'seo_accessibility', title: 'SEO・AEO/GEO/LLMOを含む改善を設計・実施する', phase: 'build', dependsOn: ['seo_research'], mode: 'create' }),
    task({ key: 'seo_review', role: 'quality_assurance', title: '最終DOM・構造化・表示・回帰を確認する', phase: 'review', dependsOn: ['seo_execute'], mode: 'review' })
  ]
};

const CONSULTATION = {
  pipeline: 'consultation_triage',
  initialPhase: 'understand',
  metadata: { autonomous_until: 'complete', research_required: 'conditional', dynamic_expansion: true, expansion_rule: 'general_request_triage' },
  tasks: [
    task({ key: 'consultation_intake', role: 'customer_intake', title: '相談内容・目的・不足情報を整理する', phase: 'understand', mode: 'analyze' }),
    task({ key: 'consultation_triage', role: 'project_director', title: '相談を実装可能なRequest種別へ分類する', phase: 'triage', dependsOn: ['consultation_intake'], mode: 'triage', metadata: { must_expand_workflow: true } })
  ]
};

const PIPELINES_BY_REQUEST_TYPE = {
  web_new: WEB_NEW,
  web_change: WEB_CHANGE,
  copy: COPY,
  social: SOCIAL,
  image: IMAGE,
  research: RESEARCH,
  automation: AUTOMATION,
  seo: SEO,
  general: CONSULTATION,
  other: CONSULTATION
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const planProductionPipeline = (request) => {
  const requestType = String(request?.type || 'general').trim();
  const definition = PIPELINES_BY_REQUEST_TYPE[requestType] || CONSULTATION;
  return {
    requestType,
    pipeline: definition.pipeline,
    initialPhase: definition.initialPhase,
    metadata: {
      ...clone(definition.metadata),
      routed_from_type: requestType,
      router_version: '2026-08-29.1'
    },
    tasks: clone(definition.tasks).map((item, index) => ({ ...item, sequence: index + 1 }))
  };
};

export const productionPipelineCatalog = () => Object.fromEntries(
  Object.entries(PIPELINES_BY_REQUEST_TYPE).map(([type, definition]) => [type, {
    pipeline: definition.pipeline,
    initialPhase: definition.initialPhase,
    taskCount: definition.tasks.length,
    dynamicExpansion: Boolean(definition.metadata.dynamic_expansion)
  }])
);
