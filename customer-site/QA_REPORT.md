# QA report — 2026-09-16

## 対象

- Revision: 作業ツリー（未コミット）
- Page: `customer-site/index.html`

## 今回の修正

- `head` に `<link rel="canonical" href="./">` を追加した。公開時のルートまたはサブディレクトリのURLに解決されるため、未確定のドメインを捏造せずに正規URLを明示できる。
- `qa.mjs` にcanonicalの存在と値を検査する回帰テストを追加した。

## 実行結果

| Check | Result | Evidence |
|---|---|---|
| `npm run qa` | PASS | コンテンツ、SEOメタ情報、canonical、見出し、アンカー、A11y用CSSを検査 |
| `git diff --check` | PASS | whitespace errorなし |
| `python3 -m http.server 4173 --directory customer-site` | BLOCKED | sandboxがローカルsocket作成を拒否（`PermissionError: [Errno 1] Operation not permitted`） |
| Chromium headless screenshot（1440×900） | BLOCKED | Crashpadのchild socket初期化がsandboxに拒否された（exit 134） |
| Firefox headless screenshot（1440×900） | BLOCKED | sandbox内でsegmentation fault（exit 139） |

## SEO / accessibility確認

- `lang="ja"`、固有のtitle・description、1つのh1、論理的なsection見出し、`main` / `nav` / `footer`: PASS（静的検査）
- canonical: PASS（相対URL `./`）。公開URLを未確定のまま絶対URLとして捏造していない。
- OGP画像・画像代替テキスト・Twitter Card: PASS（静的検査）
- スキップリンク、可視フォーカス、44px以上のリンク操作領域、`prefers-reduced-motion`: PASS（静的検査）

## 最終判定

**FAIL（実ブラウザ検証未完了）**。SEO/A11yの静的検査とcanonical指摘の修正は完了したが、QA_STANDARDで必須の実画面・複数viewport・コンソール確認をこのsandboxから実行できないため、公開判定は出せない。

## 次工程で必要な確認

許可されたブラウザ環境で、次のviewportを確認する。

`360x800`, `375x812`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1280x800`, `1440x900`

各viewportで横スクロール、ヘッダー／ナビゲーション、本文と住所の切れ、キーボードフォーカス、コンソールエラーを確認する。公開先が確定した場合は、canonicalをその絶対URLへ置き換え、同一URLを`og:url`にも設定する。営業時間・定休日・住所も公開前に店舗側で最終確認する。
