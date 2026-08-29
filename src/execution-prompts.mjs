const truncate = (value, max = 12000) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
};

const roleRules = {
  customer_intake: '依頼内容・事実・目的・制約・不足情報を整理する。未確認情報を補完しない。',
  project_director: '前工程の根拠から方針・優先順位・受け入れ条件を決める。不要な人間確認を増やさない。',
  research_strategist: '一次情報を優先し、事実と推測を分離して調査する。採用理由まで示す。',
  ux_architect: 'ユーザー目的、情報優先度、導線、モバイルを含めて設計する。',
  content_editor: '具体的で自然な日本語を使う。汎用的なAIコピーや未確認の実績・数字を作らない。',
  visual_designer: '見た目の模倣ではなく判断原則を抽出し、ブランドと用途に合う方向を定義する。',
  frontend_engineer: '仕様を実装し、テストと実ブラウザ確認まで行う。テストを弱めて通さない。',
  seo_accessibility: '最終DOMと実画面を対象にSEO・アクセシビリティ・構造化を検証する。',
  quality_assurance: 'Builderと独立した観点で検証し、曖昧な「良さそう」でPASSにしない。'
};

const outputInstruction = (task) => {
  if (task.mode === 'triage') {
    return `最終出力の末尾に、必ず次のJSONをコードフェンスなしで1つ出力してください。\n{"route":"web_new|web_change|copy|social|image|research|automation|seo|answer_only","impact":"content|visual|technical|strategic|none","reason":"短い理由"}`;
  }
  if (task.mode === 'release_gate') {
    return 'PASS/FAILを明示し、FAILなら阻害要因を列挙する。人間承認が必要なのは本番公開・DNS・新規課金・正式情報不足などHuman Gateだけ。';
  }
  if (String(task.mode).includes('review')) {
    return 'PASS/FAILを明示し、FAILの場合は location / problem / expected / severity を具体的に返す。';
  }
  return '成果物としてそのまま次工程へ渡せる完成形を返す。判断理由と未解決事項を分ける。';
};

export const buildTaskPrompt = (context, { external = false } = {}) => {
  const { task, workflow, request, project, priorTasks, artifacts, messages, repository } = context;
  const prior = (priorTasks || []).filter((item) => item.status === 'completed').map((item) => ({
    task_key: item.task_key,
    role: item.agent_role,
    title: item.title,
    result: item.result
  }));
  const artifactContext = (artifacts || []).map((item) => ({
    kind: item.kind,
    title: item.title,
    content: truncate(item.content_text, 9000),
    metadata: item.metadata
  }));
  const conversation = (messages || []).slice(-12).map((item) => ({
    author: item.author_type,
    content: truncate(item.content, 3000)
  }));

  const sections = [
    '# Role',
    `${task.agent_role}: ${roleRules[task.agent_role] || '担当タスクを仕様に沿って遂行する。'}`,
    '',
    '# Execution rule',
    'フェーズは内部工程です。Researchやレビューのたびに人間確認で停止せず、与えられたタスクを完了してください。',
    '正式な事業情報・料金・実績を捏造しないでください。本番公開、DNS切替、新規課金、破壊的操作は実行しません。',
    '',
    '# Current task',
    `Task key: ${task.task_key || task.id}`,
    `Title: ${task.title}`,
    `Phase: ${task.phase}`,
    `Mode: ${task.mode}`,
    outputInstruction(task),
    '',
    '# Customer request',
    truncate({ type: request?.type, title: request?.title, body: request?.body, priority: request?.priority, metadata: request?.metadata }, 14000),
    '',
    '# Project',
    truncate({ id: project?.id, name: project?.name, status: project?.status, metadata: project?.metadata }, 8000),
    '',
    '# Previous completed tasks',
    truncate(prior, 26000),
    '',
    '# Existing artifacts',
    truncate(artifactContext, 28000),
    '',
    '# Recent conversation',
    truncate(conversation, 12000)
  ];

  if (external) {
    sections.push(
      '',
      '# Repository execution',
      `Repository: ${repository?.repository_full_name || 'unknown'}`,
      'あなたはチェックアウト済みworkspace内で作業します。ネットワークアクセスは前提にしません。依存パッケージは事前に準備されています。',
      '`.github/`, `.git/`, `.codex/`, `.akinael/`, `AGENTS.md` は変更しないでください。',
      '実装タスクでは必要なファイルを編集し、既存テストとQAを実行して失敗を修正してください。',
      'レビューモードでは原則コードを変更せず、実装済み状態を検査してください。'
    );
  }

  return sections.join('\n').slice(0, 54000);
};
