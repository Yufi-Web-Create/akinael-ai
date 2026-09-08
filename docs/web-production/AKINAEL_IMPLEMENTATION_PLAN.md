# AKINAEL_IMPLEMENTATION_PLAN.md — アキナエルAI公開サイト

`AKINAEL_PROJECT_SPEC.md`（Research/Direction）を受けた実装計画。Claude Codeが2026-09-08に作成。**この文書もBuildではない。** 実際のコード変更・コピー作成・デザイン変更は、オーナーが`AKINAEL_PROJECT_SPEC.md`11節の判断を下してから着手する。

この文書とProject Specの間に矛盾がないことを確認済み: Project Spec 11節「homepage登録CTAを`/portal/`へ向ける修正の実施可否」はオーナー判断待ちのままであり、本書はその判断が下された場合に実行する具体案を先に用意するものであって、Build着手を意味しない。

## 1. 現行CTA導線の確認済み事実（推測なし、コード確認済み）

`public/index.html`のCTAはすべて次の形。

```html
<a href="/mypage" data-auth-open="register">無料でAIに相談する</a>
<a href="/mypage" data-auth-open="login">ログイン</a>
```

`public/assets/app.js`が`data-auth-open`をクリック捕捉し、`event.preventDefault()`でページ内モーダルを開く（`href="/mypage"`はJS無効時のfallbackのみ）。モーダルの送信先は次の通り、確認済み。

- 登録: `POST /api/v2/auth/register`
- ログイン: `POST /api/v2/auth/login`
- 成功後: `localStorage.setItem('customer-token', ...)` → `location.href = '/mypage'`（`app.js` L163-165）
- 既にtokenがある場合: `location.href = '/mypage'`（`app.js` L136）

**重要な確認事実**: `portal/src/Portal.tsx`のtoken keyも`const tokenKey = "customer-token"`（完全一致）であり、呼び出すAPIも同じ`/api/v2/auth/register` `/api/v2/auth/login`である。つまり認証・データモデルは既に共通化済みで、**リダイレクト先の文字列`/mypage`を`/portal/`へ変更するだけ**で、ホームページのCTAは完成済みCustomer Portalへ接続できる。新しいroute・新しいAPIは一切不要。

## 2. CTA分離の実装案（route/APIは既存のみ使用）

| CTA | 現状 | 提案 | 理由 |
|---|---|---|---|
| 新規顧客「無料でAIに相談する」（header/hero/final-cta、計4箇所） | モーダルで`/api/v2/auth/register`→`/mypage`へ遷移 | モーダルの流れは維持し、成功後のリダイレクト先だけ`/mypage`→`/portal/`へ変更 | 既に動いているinlineな低摩擦の登録体験を壊さない。変更点は`app.js`の2箇所のリテラル文字列のみ |
| 既存顧客「ログイン」（header/footer、計2箇所） | モーダルで`/api/v2/auth/login`→`/mypage`へ遷移 | `data-auth-open="login"`を外し、単純な`<a href="/portal/">ログイン</a>`へ変更（モーダルを経由させない） | Portalは既に自前のログインフォームを持つため、同じUIを二重に維持する必要がない。ユーザーは「自分のPortalへ行く」という意図に対して直接的な導線になる |
| 「無料試作を依頼する」 | 存在しない（現状コピーにはない） | 新しい別routeとして作らない。既存の「無料でAIに相談する」の**コピー文言の一案**として扱う（同一route・同一機能） | ご指示の「存在しないrouteを作らない」に従う。実体は1つの登録導線であり、文言違いを2つ目のCTAと誤認しない |

この表の変更は、Build承認が下りた場合の最小diffの目安であり、今回は適用していない。

## 3. Single-page vs Multi-page 判断材料

`website-content-requirements.md`はサービス詳細・料金・業種別×4・課題別・事例・FAQ・信頼情報の独立ページを想定するが、機械的に全面移行せず、軸ごとに比較する。

| 軸 | Single-page（現状維持） | Multi-page（全面独立ページ化） | 所見 |
|---|---|---|---|
| SEO | 各セクションは`#anchor`のみでURLを持たず、検索結果の個別スニペットにならない | 業種別など検索意図が明確に異なるページは、専用URL・専用title/meta/構造化データで個別に評価されやすい | 業種ページのみ独立URL化する価値が高い。料金・FAQ・サービス詳細は現状ホームページ内でも検索意図と大きく乖離しない |
| Content volume | 各セクションが1〜3文で簡潔 | 独立ページ化すると各ページに追加コンテンツが必要（薄いページはSEO上むしろ不利） | 現状の分量のまま多ページ化すると"thin content"リスクがある。業種ページは業種固有の具体的コピーを追加できる余地がある（既存業種セクションは1業種1文のみ） |
| Maintenance | 1ファイルで完結、ナビゲーション断片化なし | ページ数に比例して更新箇所が増える。COPY_STANDARD/QA_STANDARDのレビュー対象も増える | 段階的移行（一部のみ独立ページ化）が保守コストの急増を避けられる |
| Conversion | 1本道のスクロールでCTAまで誘導する現行設計は機能している（構造化データ・disclaimer等、既に一定の完成度） | 別ページへ移動したユーザーがCTAに到達せず離脱するリスク。各ページに独立したCTA配置が必要 | 独立ページ化する場合も、ホームページと同じCTAコンポーネントを必ず配置する前提とする |
| User journey | 曖昧な悩みを持つ訪問者には、問題→流れ→料金→証跡→FAQと一本道で説明できる現行構成が適している | 「パーソナルジム　ホームページ制作」等、具体的検索意図を持つ訪問者には、その業種に特化したランディングページの方が離脱率が低い可能性が高い | ユーザーの入口（検索 vs 直接訪問/紹介）によって最適解が異なる。ホームページと業種ページの併存が両方に対応できる |
| Page performance | 画像は`loading="lazy"`済みだが、1ページに全業種・全セクションの画像を含む | 業種ページ化すれば各ページの画像数は減る | 現行のresponsive画像実装（avif/webp、複数解像度）は既に良好。多ページ化の主目的はSEOであり、performance改善が主目的ではない |
| Current architecture | 変更不要 | `src/server.mjs`の`pages`マッピングと静的HTMLファイル追加のみで実現可能（テンプレートエンジン導入は不要）。ただし各ページにヘッダー/フッター/CSSを重複させる必要がある（現状の静的HTML構成の制約） | 技術的障壁は低いが、共通部分（ヘッダー、フッター、構造化データの一部）をどう重複管理するかは実装時に決める必要がある |

### 推奨

**全面multi-page化ではなく、ハイブリッドを推奨する。**

1. ホームページの単一ページ構成は維持する（現行の転換導線を壊さない）。
2. 業種別ページ（美容室・サロン／カフェ・飲食店／教室・スクール／住宅メンテナンス、計4ページ）のみ独立URL化を検討する。検索意図が最も明確に業種別へ分岐する箇所であり、既存の業種セクションに追加すべきコピー要件も具体的（下記4節）。
3. サービス詳細・料金・FAQ・事例・課題別・信頼情報ページは、今回は独立ページ化しない。現行のホームページ内セクション（`#service` `#pricing` `#faq`）で十分に機能しており、薄いコンテンツの複数ページ化はSEO上のリスクがcontent volumeの制約から上回ると判断する。
4. 事例ページは実績データがUNKNOWNのため、いずれの構成でも作成できない（Project Spec 4節参照）。

この推奨はSEO実測データ（Search Console等）が今後得られた場合に再評価する。

## 4. 業種別ページ化した場合に必要なコピー（作成不要、要件のみ）

各業種ページに必要な要素（実際の執筆はBuild承認後、Production Router経由のcontent_editorロールが担当する）。

- 業種固有の見出し（現行の1文コピーから拡張）
- 業種固有の課題・提供価値（2〜3段落。COPY_STANDARDの具体性テストを満たすこと。他業種名に置き換えて成立する文章は禁止）
- 業種固有FAQ（3〜5問。既存FAQ11問から業種関連分を抽出・拡張）
- 共通CTA（ホームページと同一コンポーネント）
- 業種固有のOGP画像・title・meta description

未確定の実績・数値は今回もUNKNOWNのまま扱う。捏造しない。

## 5. SEO構造（多ページ化する場合の技術要件）

- 各業種ページに独立した`<link rel="canonical">`、`title`、`meta description`
- `public/sitemap.xml`へ追加
- `public/robots.txt`は現状`Allow: /`のためこれらのページは追加のDisallow不要（`/portal` `/preview/`のような非公開ページとは異なる）
- ホームページの業種セクションから各業種ページへの内部リンクを追加し、逆に各業種ページからホームページ・料金セクションへの内部リンクも設置する
- 構造化データ: 各業種ページにも`Organization`スキーマを維持し、可能なら`Service`または`LocalBusiness`スキーマの追加を検討（対応地域がUNKNOWNのため`LocalBusiness`の`areaServed`等は確定情報が揃うまで保留）

## 6. Responsive戦略

新規ページを作る場合も新しいCSSシステムを導入せず、既存の`public/assets/styles.css`とヘッダー/フッターHTML構造をそのまま再利用する。`docs/web-production/DESIGN_STANDARD.md`のviewport matrix（360〜1440px）で検証する対象が、ページ数の分だけ増えることに留意する。

## 7. 未確定情報（このplanでは埋めない）

- 対応地域、法人格、運営者情報（Project Spec 4節と同一のUNKNOWN）
- 実績・事例（作成不可）
- Instagram広告運用ページ等、追加ページの要否

## 8. Human decisions required（Project Spec 11節と重複しないものだけ）

- 上記2節のCTA変更案（`/mypage`→`/portal/`）を実施するBuildの承認
- 業種別ページのみ独立化するハイブリッド方針の承認、または全面multi-page/現状維持のいずれかへの変更判断
