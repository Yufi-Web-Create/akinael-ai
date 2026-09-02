import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { businessConfig } from '../src/business-config.mjs';

const [html, script] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8')
]);

test('public landing page exposes complete tab semantics for authentication', () => {
  assert.match(html, /id="auth-register-tab"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="auth-panel"/);
  assert.match(html, /id="auth-login-tab"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="auth-panel"/);
  assert.match(html, /id="auth-panel" role="tabpanel" aria-labelledby="auth-register-tab" tabindex="0"/);
  assert.match(script, /button\.setAttribute\('aria-selected', String\(selected\)\)/);
  assert.match(script, /authPanel\.setAttribute\('aria-labelledby', button\.id\)/);
  assert.match(script, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
});

test('public landing page retains required SEO and keyboard-accessible landmarks', () => {
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>アキナエルAI｜小さなお店のAI相談役（集客・SNS・Web）<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/akinael-ai\.com\/">/);
  assert.match(html, /<meta property="og:title" content="[^"]+">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /"@type": "Organization"/);
  assert.match(html, /<a class="skip-link" href="#main">本文へ移動<\/a>/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /<h1[ >]/);
  assert.match(html, /<nav id="global-nav"[^>]*aria-label="メインナビゲーション"/);
  assert.match(html, /<img class="hero-media"[^>]*alt="[^"]+"/);
  assert.match(html, /aria-label="パスワードを表示" aria-pressed="false"/);
  assert.match(script, /authPasswordToggle\.setAttribute\('aria-pressed', String\(!showing\)\)/);
});

test('FAQPage JSON-LD exactly matches every FAQ rendered in the final DOM', () => {
  const faqSection = html.match(/<section class="faq section" id="faq">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(faqSection, 'FAQ section must exist');

  const renderedFaqs = [...faqSection.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .map(([, question, answer]) => ({
      question: question.replace(/<span aria-hidden="true">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim(),
      answer: answer.replace(/<[^>]+>/g, '').trim()
    }));

  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)]
    .map(([, block]) => JSON.parse(block));
  const faqPage = jsonLdBlocks.find((block) => block['@type'] === 'FAQPage');
  assert.ok(faqPage, 'FAQPage JSON-LD must exist');

  const structuredFaqs = faqPage.mainEntity.map((entry) => ({
    question: entry.name,
    answer: entry.acceptedAnswer?.text
  }));
  assert.deepEqual(structuredFaqs, renderedFaqs);
});

test('landing-page copy states the service, registration step, and formal pricing conditions accurately', () => {
  const { trial, mini, operations, advanced, instagramAds, websiteProduction } = businessConfig.pricing;

  assert.match(html, /Web担当者がいない[\s\S]*相談から制作・改善まで/);
  assert.match(html, /Webサイト制作、文章・SNS、予約導線の見直し、公開前の検査、公開後の更新・改善を支援します。/);
  assert.match(html, /相談内容を整理して、[\s\S]*必要な[\s\S]*制作・改善[\s\S]*を進めます。/);
  assert.match(html, /無料登録して相談を始める/);
  assert.match(html, /無料登録後、メール確認とログインを済ませてから相談を入力できます。/);
  assert.match(html, new RegExp(`${trial.amount}円`));
  assert.match(html, new RegExp(`月額\\s*${mini.monthlyAmount.toLocaleString('ja-JP')}円[\\s\\S]*税込`));
  assert.match(html, new RegExp(`月額\\s*${operations.monthlyAmount.toLocaleString('ja-JP')}円[\\s\\S]*税込`));
  assert.match(html, new RegExp(`月額\\s*${advanced.monthlyAmount.toLocaleString('ja-JP')}円[\\s\\S]*税込`));
  assert.match(html, new RegExp(`${websiteProduction.startingAmount.toLocaleString('ja-JP')}円〜[\\s\\S]*税込`));
  assert.match(html, new RegExp(`広告費の${instagramAds.feeRate * 100}%（月額${instagramAds.minimumMonthlyFee.toLocaleString('ja-JP')}円（税込）から）`));
  assert.match(html, /広告費はお客さまのご負担です。その他の外部サービス料金、顧客専用SaaSなどの顧客固有費用も原則としてお客さまのご負担です。/);
  assert.match(html, /月額プランの解約・返金条件は契約時に明示します。/);
  assert.match(html, /しっかり運用ではWebサイト更新・小規模ページ改善、発展運用では分析や業務改善までを支援します。/);
  assert.doesNotMatch(html, /料金、税表示、契約条件は現在最終確認中です。|確定前の金額を正式料金として掲載しません。|商いの願いを|無料でAIに相談する|公開後も一緒に改善/);
});
