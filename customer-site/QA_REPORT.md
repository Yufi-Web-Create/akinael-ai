# QA report — 2026-09-16

## 対象

- Revision: 作業ツリー（未コミット）
- Page: `customer-site/index.html`

## 修正内容

- 全viewportで機能するヒーロー、情報カード、レスポンシブレイアウト、余白、可読性、可視フォーカス、44px以上の操作領域を実装した。
- オリジナルの抽象OGPイラスト `og-image.svg` と、`og:image`・代替テキスト・Twitter Cardを追加した。
- 既存の静的QAを、OGP、主要レイアウト、モバイル積み上げ、フォーカス、動きの抑制、操作領域を検査する内容へ拡張した。

## 実行結果

| Check | Result |
|---|---|
| `npm run qa` | PASS |
| `git diff --check` | PASS |
| ローカルHTTPサーバー起動 | BLOCKED: 実行環境がローカルsocket作成を拒否 |
| Chromium headless DOM / screenshot | BLOCKED: sandboxがChromiumのchild socket / Crashpad初期化を拒否 |

## SEO / accessibility確認

- `lang="ja"`、固有のtitle・description、1つのh1、論理的なsection見出し、main/nav/footer: PASS
- キーボード用スキップリンク、可視フォーカス、44px以上のリンク操作領域、`prefers-reduced-motion`: PASS（静的検査）
- OGP画像・画像代替テキスト: PASS
- canonical: 保留。公開URLが未確定のため、架空のabsolute URLを設定しない。公開先の確定時に、そのURLをcanonicalおよびOGP URLとして設定する。

## 実ブラウザ確認の引き継ぎ

コード上のレスポンシブ対応は実装済みだが、この実行環境ではブラウザプロセスとローカルHTTPサーバーがsandboxにより起動できず、実スクリーンショット・コンソール確認は実施不能だった。公開承認前に、許可されたブラウザ環境で以下のviewportを確認する。

`360x800`, `375x812`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1280x800`, `1440x900`

各viewportで横スクロール、ヘッダー/ナビゲーション、本文と住所の切れ、フォーカス表示、コンソールエラーを確認する。また、営業時間・定休日・住所と公開URLは店舗側・公開担当者が最終確認する。
