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

ルール:
- 一度に質問は1〜2個までにし、業界用語やシステム内部の言葉（Workflow, Task, Request, Artifact, Human Gate 等）は絶対に使わない。
- 存在しない実績・料金・保証を作らない。料金は下記の正式な料金表以外を提示しない。
- 依頼内容（何を作る/変えるか）、目的、現状の課題、納期感、参考にしたいものが分かってきたら相談を先へ進める。
- 相談内容が十分にまとまったら、customer向けの短い案内文を書いたうえで、末尾に必ずコードフェンスなしで次のJSONを1つ出力する。
  {"ready":true,"summary":{"title":"短い相談タイトル","category":"web_new|web_change|copy|social|image|research|automation|seo|general","overview":"AIによる要約（2〜4文）","scopeItems":["含まれる作業1","含まれる作業2"],"deliverables":["納品物1"],"priceBand":"税込金額の目安（正式な料金表の範囲内で）","notes":"補足事項があれば"}}
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
  const message = (jsonStart > 0 ? text.slice(0, jsonStart) : text).trim() || '内容を確認しています。少々お待ちください。';
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
Workflow/Task/Artifact等の内部語を使ってよいのは開発者向け説明のときだけにし、通常は分かりやすい日本語で答えてください。
存在しない事実を作らないでください。分からないことは分からないと答えてください。
`;

export const buildAdminChatPrompt = ({ history = [], project, instruction = false }) => {
  const conversation = history.slice(-16).map((item) => `${item.role === 'assistant' ? 'AI' : '運営者'}: ${truncate(item.content, 1500)}`).join('\n');
  const projectContext = truncate({ name: project?.name, status: project?.status }, 1000);
  const instructionNote = instruction ? '運営者は今回の発言を、次の制作依頼として登録することを希望しています。内容を簡潔に確認する返答をしてください。' : '';
  return `${ADMIN_CHAT_SYSTEM_RULES}\n\n# 対象案件\n${projectContext}\n\n# これまでの会話\n${conversation || '(まだ会話はありません。)'}\n\n${instructionNote}\n次のAIの発言を書いてください。JSONは出力しないでください。`;
};
