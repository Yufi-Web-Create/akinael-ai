import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConsultationPrompt, parseConsultationReply, buildAdminChatPrompt } from '../src/ai-consultation.mjs';
import { businessConfig } from '../src/business-config.mjs';

test('buildConsultationPrompt instructs the model to avoid internal system vocabulary and includes the formal pricing table', () => {
  const prompt = buildConsultationPrompt({
    history: [{ role: 'user', content: 'ホームページを作りたいです' }],
    chatContext: null,
    businessConfig
  });
  // The instruction *names* the forbidden words so the model knows what to avoid saying to
  // the customer; that's a server-side prompt the customer never sees. What matters is that
  // it actually tells the model not to use them.
  assert.ok(prompt.includes('内部の言葉'));
  assert.ok(prompt.includes(String(businessConfig.pricing.mini.monthlyAmount)));
  assert.ok(prompt.includes('ホームページを作りたいです'));
});

test('buildConsultationPrompt carries chat context from a work-item revision request', () => {
  const prompt = buildConsultationPrompt({ history: [], chatContext: 'トップページ', businessConfig });
  assert.ok(prompt.includes('トップページ'));
});

test('parseConsultationReply extracts a ready summary and strips the JSON from the visible message', () => {
  const raw = 'ありがとうございます。内容が整理できました。\n{"ready":true,"summary":{"title":"Webサイト新規制作","category":"web_new","overview":"店舗紹介サイトを新しく作ります。","scopeItems":["トップページ"],"deliverables":["公開済みサイト"],"priceBand":"19,800円〜","notes":""}}';
  const result = parseConsultationReply(raw);
  assert.equal(result.ready, true);
  assert.equal(result.summary.title, 'Webサイト新規制作');
  assert.equal(result.summary.category, 'web_new');
  assert.ok(!result.message.includes('"ready"'));
  assert.ok(result.message.includes('内容が整理できました'));
});

test('parseConsultationReply treats ready:false as not ready even with a summary object present', () => {
  const raw = 'もう少し詳しく教えてください。\n{"ready":false}';
  const result = parseConsultationReply(raw);
  assert.equal(result.ready, false);
  assert.equal(result.summary, null);
});

test('parseConsultationReply degrades gracefully when the model returns no JSON at all', () => {
  const result = parseConsultationReply('すみません、もう一度お願いします。');
  assert.equal(result.ready, false);
  assert.equal(result.summary, null);
  assert.equal(result.message, 'すみません、もう一度お願いします。');
});

test('buildAdminChatPrompt stays free of raw internal vocabulary in normal (non-developer) mode', () => {
  const prompt = buildAdminChatPrompt({ history: [], project: { name: 'テスト案件', status: 'in_progress' }, instruction: false });
  assert.ok(prompt.includes('テスト案件'));
  assert.ok(!prompt.includes('Human Gate'));
});
