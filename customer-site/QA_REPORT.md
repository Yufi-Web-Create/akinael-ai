# QA_REPORT｜確認用サイト

## 実装対象

- URL: `customer-site/index.html`（静的プレビュー）
- tested revision: `7ac3740` を基点とした作業ツリー
- 対象ページ: `/` のみ

## 修正内容

| 指摘 | 対応 | 結果 |
|---|---|---|
| SVGの矛盾したA11y属性 | 装飾SVGから `role="img"` を削除し、`aria-hidden="true"` のみに統一 | PASS |
| SEO基本情報の不足 | OGPのlocale/site name、確認済み事実だけを使う`LocalBusiness` JSON-LDを追加 | PASS |
| 未確定情報でのインデックス懸念 | `noindex, nofollow` と全クロール拒否の `robots.txt` を追加 | PASS |
| プレビューを公開候補と誤認する回帰 | canonical・`og:url`・`og:image` を未確定のまま追加しないこと、プレビューメタを維持することを自動検査 | PASS |
| モバイルメニューのキーボード利用性の回帰 | メニューの展開状態・制御先、Skip link、可視フォーカスを自動検査 | PASS |
| canonical・OGP画像・本番sitemap | 本番URL・素材未確定のため値を捏造せず、公開前チェックリストへ分離 | 保留 |
| 住所・電話・地図導線 | 正式情報が未提供のため、確認中表示を維持。値の捏造はしない | BLOCKER |

## 自動検査

| 検査 | コマンド | 結果 |
|---|---|---|
| ユニット／コンテンツ検査 | `npm run test` | PASS |
| HTML・アンカー・SEO/A11y静的検査 | `npm run check:html` | PASS |
| JavaScript構文検査 | `npm run check:js` | PASS |
| 統合QA | `npm run qa` | PASS |

静的検査では、確定済み事実、アンカー整合、プレビューのクロール拒否、OGP基本メタ、JSON-LD、SVGのA11y属性、未確認電話・番地の非掲載を確認した。

## 実ブラウザ確認

次の8 viewportを確認対象とした: 360x800、375x812、390x844、430x932、768x1024、1024x768、1280x800、1440x900。

Chromium headless を `--headless --no-sandbox --disable-dev-shm-usage --disable-crash-reporter --disable-crashpad --no-first-run --disable-gpu --user-data-dir=<tmp>` で再実行したが、Crashpad 初期化時の `setsockopt: Operation not permitted` により終了した。ローカルHTTPサーバーも `listen EPERM` となり、実行環境のネットワーク制限により起動できなかった。そのため、指定8 viewportのスクリーンショット、実キーボード操作、ブラウザコンソールの確認は**未実施**であり、PASS扱いにしていない。

## SEO/A11y判定

- 最終DOMの静的SEO/A11y検査: **PASS**
- 実画面・キーボード・コンソール検査: **未完了（環境制約）**
- 公開判定: **FAIL（公開不可）**

## 未解決事項／公開前の必須作業

1. 正式住所、掲載許可済み電話番号、正確な地図位置を受領し、画面・`tel:`・地図・構造化データへ同じ値を反映する。
2. 公開URLと公開可能なOGP画像を確定し、canonical、`og:url`、絶対URLの`og:image`、本番用robots/sitemapを設定する。詳細は `PREPUBLISH_SEO_CHECKLIST.md` を参照する。
3. ブラウザが利用可能な環境で、指定8 viewportの表示、横スクロール、固定CTA、モバイルメニュー、Skip link、キーボード操作、コンソールを検証し、スクリーンショットを記録する。
4. 写真・ロゴの公開利用許諾を確認する。
