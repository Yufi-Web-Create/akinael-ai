# PROJECT_SPEC.md — アキナエルAI公開サイト（Reference Project）

`AKINAEL_SITE_PLAN.md` の Phase 1（Intake from existing facts）に基づき、Claude Codeが2026-09-08に既存資料とライブサイトの監査から作成。PHASE 7 / Akinael Reference Production の Research → Direction 段階の成果物。**この文書はDirectionまで。Buildは未着手。**

## 1. Project identity

- Project name: アキナエルAI 公開サイト（`akinael-ai.com` ルートドメイン、`/portal/` `/admin/` を除く公開領域）
- Client / brand: アキナエルAI（自社。Reference Projectとして自社サイトを実案件同様に扱う）
- Project type: `web_change`（新規制作ではなく既存公開サイトの改善。全面刷新ではなく、確認済みギャップの解消と段階的なIA拡張）
- Status: Research / Direction 完了、Build未着手
- Last updated: 2026-09-08

## 2. Primary goal

Web担当者を持たない小規模店舗が、チャット相談から試作確認までの導線をこのサイト上で迷わず開始できる状態を維持しながら、現在確認されている実装ギャップ（後述）を解消し、`docs/website-content-requirements.md` が定義する情報設計へ段階的に近づける。

## 3. Target users

### Primary
- 誰か: 1〜5名規模で運営する予約制店舗の代表者（美容室、ネイル、整体、パーソナルジム、教室、カフェ・飲食店、住宅メンテナンス等）
- 状況: Web担当者がおらず、自分で更新・発信を続けられていない
- 知りたいこと: 何をしてくれるのか、いくらかかるのか、契約前に何が見えるのか
- 不安: AIに任せて公開や課金を勝手に進められないか、専門知識がなくても相談できるか
- 最終行動: 無料相談（Portalアカウント登録）を開始する

### Secondary
- 既存顧客（案件の進行状況確認、追加相談） — Customer Portal（`/portal/`）が主動線
- 運営者本人（Admin `/admin/`経由の運用確認）

## 4. Business facts

`docs/business-concept-summary.md` と `src/business-config.mjs` で確認済みの事実のみ記載する。

- 事業内容: チャット相談を起点に、要件整理・制作・品質検査・修正・継続改善を一気通貫で提供するAI集客・改善チーム
- 商品・サービス: お試し（0円）／本契約ミニ（月額3,980円）／しっかり運用（月額7,980円）／発展運用（月額17,800円）／Webサイト正式制作・公開（19,800円〜）／Instagram広告運用（広告費の20%、最低5,500円/月、発展運用契約者限定）
- 料金: 上記の通り。すべて税込。正式なpricingPolicyVersionは `2026-08-25`
- 営業情報: UNKNOWN（所在地・電話番号・法人格の公開可否は未確認）
- 実績: UNKNOWN（顧客実績・導入数は現時点で公開できる確定値なし。捏造禁止）
- 強み: 相談から納品までの一気通貫フロー、制作AIと検査AIの分離、公開・課金・削除等の不可逆操作への人間承認ゲート
- 対応地域: UNKNOWN（全国対応かローカル限定かの明記なし）

## 5. Site scope

### Pages（現状 vs 要件定義との差分）

| Page | 現状 | `website-content-requirements.md` が要求する状態 | Purpose | Primary CTA |
|---|---|---|---|---|
| トップページ（`/`） | 実装済み（1ページ内に#service, #pricing, #flow, #industries, #faqのアンカーセクション） | 実装済み想定と大きく矛盾しない | 相談開始への転換 | 無料でAIに相談する（Portal登録） |
| サービス詳細ページ | 未実装（トップの`#service`セクションで代替） | 独立ページとして要求 | 提供内容の詳細説明 | 相談開始 |
| 料金ページ | 未実装（トップの`#pricing`セクションで代替） | 独立ページとして要求 | 料金の詳細説明 | 相談開始 |
| 業種別ページ（4業種） | 未実装（トップの`#industries`に4業種のカードのみ） | 業種ごとに独立ページを要求 | 業種特化の訴求・検索流入 | 相談開始 |
| 課題別ページ | 未実装 | 拡張前提で要求 | 課題別の検索意図に応える | 相談開始 |
| 事例ページ | 未実装 | 要求あり | 信頼material（確定実績が無い間はUNKNOWN扱いのまま作れない） | 相談開始 |
| FAQページ | 部分実装（トップの`#faq`にFAQPage構造化データ付きで11問） | 独立ページとして要求 | 検索意図への直接回答・AEO | 相談開始 |
| 信頼情報ページ群 | 部分実装（`/legal`のみ、noindex設定済み） | 複数ページを要求 | 法務・信頼情報 | — |

### Features

| Feature | Required | Acceptance condition |
|---|---|---|
| 公開チャット（未ログイン向け） | 実装済み | `/api/public/chat`経由、会話は保存しない |
| 無料相談登録導線 | **要修正** | 現状トップページの登録CTA（`data-auth-open="register"`）は旧`/mypage`向けのダイアログ（`public/assets/app.js`）を呼び出しており、PHASE 4で完成した新Customer Portal（`/portal/`）へ接続していない。新規訪問者が登録すると新Portalではなく旧UIへ流れる |
| Portal / Admin分離 | 実装済み | 別々のVite SPA、別docroot、v2 API経由 |
| SEO基盤 | 実装済み＋修正済み | Organization/FAQPage構造化データ、OGP、canonical、responsive画像。Portal/Preview経路のnoindexはPR #45で対応済み（未merge） |

## 6. Content hierarchy

1. 何のサービスか（AI相談役、Web担当者不在の店舗向け）
2. 誰向けか（美容室・カフェ・教室等の小規模店舗）
3. 何をしてくれるか（相談→試作→納得後契約の流れ）
4. 料金や利用条件（0円から4段階、明確な承認前は課金しない）
5. 他との違い（制作と検査の分離、人間承認ゲート）
6. 利用手順（チャットで相談→試作確認→検討→公開後改善）
7. 運営者・信頼材料（UNKNOWN — 法務ページ以外は未確定）
8. 次に何をすればいいか（無料相談登録）

現行トップページはこの順序に概ね沿っている。

## 7. Constraints

- ブランド制約: サービス名「アキナエルAI」、コンセプト「商いの願いを叶えるAI」、提供思想「無料試作→納得後契約」。既存ロゴ（SVG、手書き感のあるオリジナルマーク）を維持する
- 法務・権利: 実績・成果・順位を保証する表現は禁止（`docs/business-concept-summary.md` 8節）。未確定の実績数値・解約条件をこのサイト上で断定しない（現行FAQは既にこの原則を守れている）
- 技術制約:
  - 公開サイトは `src/server.mjs`（legacy v1 static + v2 API混在プロセス）が配信。`public/`直下の静的ファイル
  - CSPは`script-src 'self'`固定。インラインスクリプト不可
  - `public/portal/`と`public/admin/`はRenderビルド時にのみ生成され、リポジトリにはコミットされない（admin側は例外的に一部コミット済み。技術的負債として別記録）
- 既存システム: Customer Portal（`/portal/`）とAdmin（`/admin/`）はPHASE 4/5で本番E2E完了済み。トップページの登録導線がこれらへ未接続という具体的な不整合を今回発見（上記5節）
- 納品・公開条件: production publishはHuman Gate。このサイト自体の変更も、DNS切替や新規有料サービスを伴わない限り、通常のPR/CIレビュー経路で進められる

## 8. References

| Reference | Use for | Do not copy |
|---|---|---|
| 現行 `public/index.html` | 既存の良い部分（具体的な日本語コピー、独自ロゴ、業種別実写風イメージ、責任分離を訴求する`assurance`セクション、FAQ構造化データ）はそのまま活かす | — |
| `docs/web-production/DESIGN_STANDARD.md` | 新規ページ追加時のレスポンシブ・AI感回避基準 | — |
| `docs/web-production/COPY_STANDARD.md` | 新規ページのコピー基準（具体性テスト等） | 既存の一部見出し（例: 「小さな商いに、大きな可能性を。」）は既にこの基準を概ね満たしている |

## 9. Acceptance Criteria

### Functional
- [ ] トップページの無料相談CTAが新Customer Portal（`/portal/`）への登録導線に接続されている（現状は`/mypage`へ接続 — 要修正）
- [ ] 追加ページ（サービス詳細・料金・業種別・FAQ）を作る場合、各ページのCTAがPortal登録に一貫して接続される

### Visual
- [ ] 新規ページもDESIGN_STANDARD.mdのviewport matrix（360〜1440px）で横スクロール・要素はみ出しがない

### Copy
- [ ] 新規コピーはCOPY_STANDARDの具体性テストを満たす（固有名詞を他社名に置き換えて成立しないこと）
- [ ] 未確定の実績・数値・解約条件を断定しない

### Responsive
- [ ] 既存トップページの品質基準を新規ページでも維持する

### Backend / integration
- [ ] 新規ページ追加時もCSP（`script-src 'self'`等）を維持する

### SEO / accessibility
- [x] `/portal/`と`/preview/:projectId/:artifactId`をnoindexにする（PR #45、CI PASS、未merge）
- [ ] 追加ページを`sitemap.xml`へ登録する

## 10. Out of scope（今回のResearch/Direction段階では作らない）

- 実際のページ追加・コピー変更・デザイン変更（Build）
- 事例ページ（確定実績がないため作成不可）
- 運営者情報・対応地域の公開（UNKNOWNのため）
- `akinael-ai-web`としてのリポジトリ分離（`AKINAEL_SITE_PLAN.md`が推奨するが、今回は判断保留 — 11節参照）

## 11. Human decisions required

- **リポジトリ分離の可否**: `AKINAEL_SITE_PLAN.md`は公開サイトを別リポジトリ（`akinael-ai-web`）に分離することを推奨しているが、現状は`akinael-ai`（Core）に同居している。分離するかどうか、するならいつ移行するかはオーナー判断が必要
- **登録導線を`/portal/`へ向ける修正の実施可否**: 5節で発見した「トップページの登録CTAが新Portalへ未接続」は技術的には小さな修正だが、本番の実際の新規顧客獲得導線に影響するため、Build着手前にオーナー確認を推奨する
- **多ページ化の優先度**: `website-content-requirements.md`が要求する多ページ構成（サービス詳細・料金・業種別・FAQ独立ページ）への拡張を、いつ・どの順序で行うかはオーナー判断が必要。現行の単一ページ構成でも致命的な欠陥はないため、緊急度は高くない
- **法務・運営者情報の確定**: 対応地域、法人格、問い合わせ先などの公開可否は法務確認が前提（Human Gate: 正式情報不足）
