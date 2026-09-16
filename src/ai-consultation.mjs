import { extractLooseJson } from './openai-responses.mjs';

const truncate = (value, max = 8000) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
};

const pricingSummary = (businessConfig) => {
  const plans = businessConfig.pricing;
  return [
    `${plans.trial.name}: ${plans.trial.amount}円（無料）`,
    `${plans.mini.name}: 月額${plans.mini.monthlyAmount}円`,
    `${plans.operations.name}: 月額${plans.operations.monthlyAmount}円`,
    `${plans.advanced.name}: 月額${plans.advanced.monthlyAmount}円`,
    `${plans.websiteProduction.name}: ${plans.websiteProduction.startingAmount}円〜（個別見積あり）`,
    `${plans.instagramAds.name}: 広告費の${Math.round(plans.instagramAds.feeRate * 100)}%（最低月額${plans.instagramAds.minimumMonthlyFee}円）`
  ].join('\n');
};

// The visible reply must never contain Workflow/Task/Request/Artifact/Human Gate or other
// internal system vocabulary — those are Core implementation details, not customer-facing
// language (see claude-design-input/customer-portal/README.md).
const CONSULTATION_SYSTEM_RULES = `
あなたは小規模店舗・個人事業主向けサービス「アキナエルAI」の相談AIです。
普段づかいの言葉で話す店主に、専門用語を使わせず丁寧に要望を引き出してください。

会話の雰囲気:
- 基本は明るく、親しみやすく、話しかけやすい雰囲気にする。
- ただし馴れ馴れしすぎず、仕事の相談相手として安心できる丁寧さを保つ。
- 冷たい事務文、命令口調、必要以上に堅い敬語は避ける。
- お客様の希望を前向きに受け止め、「できること」「次に決めること」が自然に分かる返答にする。
- 絵文字や過度な感嘆符には頼らず、言葉そのものを柔らかくする。

ルール:
- 一度に質問は1〜2個までにし、業界用語やシステム内部の言葉（Workflow, Task, Request, Artifact, Human Gate 等）は絶対に使わない。
- 存在しない実績・料金・保証を作らない。料金は下記の正式な料金表以外を提示しない。
- 料金の話題になった場合は、単発費用だけでなく、相談内容に合う月額プランがあることも自然に案内する。ただし契約状況が不明な場合は「現在のご契約内容も確認したうえで、追加料金が必要かご案内します」と伝え、勝手にプラン変更を確定しない。
- 依頼内容（何を作る/変えるか）、目的、現状の課題、納期感、参考にしたいものが分かってきたら相談を先へ進める。
- summary.title は管理ツールでそのまま案件名として使う。見ただけで内容が分かる短い名前にする。
- 店名・事業名が分かる場合は「店名・事業名｜依頼内容」の形式を基本とする。例: 「ゆうやけこやけ｜新規Webサイト制作」「喫茶ゆあみ｜Instagram投稿画像制作」。
- 店名・事業名が不明な場合は「業種・対象｜依頼内容」の形式にする。曖昧な「○○のご相談」「案件」「制作依頼」だけのタイトル、メールアドレスやアカウント名、システム内部名は使わない。
- 案件名は原則36文字以内に収め、依頼種別（新規Webサイト、サイト修正、SNS投稿、チラシ、画像制作など）が一目で分かる表現にする。
- 相談内容が十分にまとまったら、お客様向けに明るく親しみやすい短い案内文を書いたうえで、末尾に必ずコードフェンスなしで次のJSONを1つ出力する。
  {"ready":true,"summary":{"title":"店名・事業名｜依頼内容","category":"web_new|web_change|copy|social|image|research|automation|seo|general","overview":"AIによる要約（2〜4文）","scopeItems":["含まれる作業1","含まれる作業2"],"deliverables":["納品物1"],"priceBand":"税込金額の目安（正式な料金表の範囲内で。月額プランが関係する場合はその旨も簡潔に）","notes":"補足事項があれば"}}
- まだ情報が不十分な場合は、末尾に次のJSONだけを出力する。{"ready":false}
- JSON以外の説明文はこのJSONより前に書く。JSONはこの1つだけ。

正式な料金表（この範囲でのみ金額を案内する）:
${'{{PRICING}}'}
`;

export const buildConsultationPrompt = ({ history = [], chatContext = null, businessConfig }) => {
  const conversation = history.slice(-16).map((item) => `${item.role === 'assistant' ? 'AI' : 'お客様'}: ${truncate(item.content, 1500)}`).join('\n');
  const contextLine = chatContext
    ? `このお客様は制作物「${truncate(chatContext, 200)}」についての修正相談から会話を始めています。まずその成果物のどこをどう変えたいかを聞いてください。`
    : '新しい相談です。まず何をしたいかを聞いてください。';
  const rules = CONSULTATION_SYSTEM_RULES.replace('{{PRICING}}', pricingSummary(businessConfig));
  return `${rules}\n\n# 今回の状況\n${contextLine}\n\n# これまでの会話\n${conversation || '(まだ会話はありません。最初の挨拶と質問をしてください。)'}\n\n次のAIの発言を書いてください。`;
};

export const parseConsultationReply = (rawOutput) => {
  const text = String(rawOutput || '').trim();
  const structured = extractLooseJson(text);
  // The prompt asks for exactly one trailing JSON object, so the *first* "{" marks where the
  // human-readable reply ends — using the last "{" would cut mid-way through a nested object
  // (e.g. "summary":{...}) and leak part of the JSON into the visible message.
  const jsonStart = text.indexOf('{');
  const message = (jsonStart > 0 ? text.slice(0, jsonStart) : text).trim() || '内容を確認しています。もう少しだけお待ちください。';
  if (!structured || typeof structured !== 'object') {
    return { message, ready: false, summary: null };
  }
  const ready = Boolean(structured.ready) && structured.summary && typeof structured.summary === 'object';
  return {
    message,
    ready,
    summary: ready ? {
      title: String(structured.summary.title || '').slice(0, 200),
      category: String(structured.summary.category || 'general'),
      overview: String(structured.summary.overview || '').slice(0, 4000),
      scopeItems: Array.isArray(structured.summary.scopeItems) ? structured.summary.scopeItems.map(String).slice(0, 20) : [],
      deliverables: Array.isArray(structured.summary.deliverables) ? structured.summary.deliverables.map(String).slice(0, 20) : [],
      priceBand: String(structured.summary.priceBand || '').slice(0, 200),
      notes: String(structured.summary.notes || '').slice(0, 2000)
    } : null
  };
};

const ADMIN_CHAT_SYSTEM_RULES = `
あなたはアキナエルAIの運営者向け「司令塔AI」です。運営者の案件判断を助けるアシスタントとして、案件の状況について簡潔に回答してください。
基本の雰囲気は明るく親しみやすく、相談しやすいチームメンバーのように話してください。ただし判断に必要な情報は曖昧にせず、仕事として頼れる丁寧さを保ってください。
冷たい事務文、過度に堅い敬語、ぶっきらぼうな命令口調は避けてください。絵文字や感嘆符に頼らず、自然な言葉で温かさを出してください。
Workflow/Task/Artifact等の内部語を使ってよいのは開発者向け説明のときだけにし、通常は分かりやすい日本語で答えてください。
存在しない事実を作らないでください。分からないことは分からないと答えてください。
`;

export const buildAdminChatPrompt = ({ history = [], project, instruction = false }) => {
  const conversation = history.slice(-16).map((item) => `${item.role === 'assistant' ? 'AI' : '運営者'}: ${truncate(item.content, 1500)}`).join('\n');
  const projectContext = truncate({ name: project?.name, status: project?.status }, 1000);
  const instructionNote = instruction ? '運営者は今回の発言を、次の制作依頼として登録することを希望しています。内容を明るく親しみやすいトーンで簡潔に確認してください。' : '';
  return `${ADMIN_CHAT_SYSTEM_RULES}\n\n# 対象案件\n${projectContext}\n\n# これまでの会話\n${conversation || '(まだ会話はありません。)'}\n\n${instructionNote}\n次のAIの発言を書いてください。JSONは出力しないでください。`;
};
