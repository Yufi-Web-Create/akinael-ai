# PROJECT_STATUS.md

最終更新: 2026-09-09 JST（Claude Code、Admin mobile CSS browser互換性修正 — PR #62/#63 merge・production反映確認済み。Admin mobile再QA待ち）

## CURRENT PHASE

**PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS**

## PROJECT PROGRESS

**PHASE 5 / 9 COMPLETE**

| PHASE | 内容 | 状態 | 根拠 |
|---|---|---|---|
| 1 | Production E2E完全突破 | COMPLETE | Workflow `7469cea7-d664-451e-8c25-46a7204ae51b` が `deploy_ready / release`、Release Gate artifact PASS |
| 2 | Production Runtime監査・安定化 | COMPLETE | runtime timeout/cost guard、GitHub runtime、Worker、Review/QA再試行経路を本番で安定化 |
| 3 | Image / Asset Production | COMPLETE | 画像生成→Storage→顧客repo反映→Visual Reviewを本番完走 |
| 4 | Customer Portal完成 | COMPLETE | Supabase Authから実preview表示、最終承認、console error 0まで本番E2E PASS |
| 5 | Admin完成 | **COMPLETE** | 実Supabase Auth、PHASE 4案件の6タブ、Admin起点preview、reload、desktop/tablet/mobile、application console error 0を本番E2Eで確認 |
| 6 | Notification / Approval / Deployment Gate | IN PROGRESS | 実装・migration・password recovery（PR #43, #44, #45）すべてmain反映済みかつRender Live deploy確認済み。残るのはCloud Browser E2Eのみ |
| 7 | Akinael Reference Production | Research/Direction + 実装計画完了、Build未着手 | `docs/web-production/AKINAEL_PROJECT_SPEC.md`（PR #46）・`AKINAEL_IMPLEMENTATION_PLAN.md`（PR #48）。オーナー判断待ちの項目あり（各文書11節参照） |
| 8 | Full Production QA | NOT STARTED | 受入条件未確定 |
| 9 | Production Release | NOT STARTED | Human Gate対象を含む |

## URLs / production endpoints

| 対象 | URL | 最新確認 |
|---|---|---|
| 公開サイト | https://akinael-ai.com/ | HTTP 200（2026-09-07 UTC） |
| Customer Portal | https://akinael-ai.com/portal/ | HTTP 200（2026-09-07 UTC）、PHASE 4実E2E PASS |
| Admin | https://akinael-ai.com/admin/ | HTTP 200（2026-09-07 UTC）、実Supabase Authログイン PASS |
| PHASE 4実preview | https://akinael-ai.com/preview/52beffb0-0c87-4949-af45-a36a8e155462/8c84cd57-8850-4401-9f36-c6127316a68c | HTTP 200（2026-09-07 UTC）、Cloud Browser実表示はPHASE 4でPASS |

## PHASE 1〜3 completion evidence

### PHASE 1 / Production E2E完全突破 — COMPLETE

- Project: `be50c2c4-3bfa-4133-adbd-9d2d23dea10e`（E2E｜月灯り珈琲 新規Webサイト）
- Workflow: `7469cea7-d664-451e-8c25-46a7204ae51b`
- Final: `deploy_ready / release`
- Release Gate artifact: `aa9a7098-62bf-43ff-ad42-2889dc9dab22`（PASS）
- GitHub Actions Runs: `33318904374`, `33522195767`, `33576112866`, `33578272654`, `33576659672`（DB上すべてsucceeded）
- Core commitとして報告済み: `38beb5c`（Build customer apps before visual review）

### PHASE 2 / Production Runtime監査・安定化 — COMPLETE

- Render Web / Worker、Supabase、OpenAI Responses API、GitHub App、中央GitHub Actionsの実接続を確認。
- retry、terminal failure、timeout/cost guard、release evidence、customer repo bootstrap、QA/Review reconciliationを反復修正。
- PHASE 1/3/4の本番Workflow完走がruntime実稼働の証拠。Workerを「未有効」として再構築しない。

### PHASE 3 / Image / Asset Production — COMPLETE

- Workflow: `4d91d88d-6935-478d-90fc-57da520d59b8`
- Final: `completed / completed`
- Image artifact: `35261129-dbd3-44a6-9430-e39d9ee6629d`
- Visual Review artifact: `2319bd68-d76b-47f0-91a1-6dd0fe0832fa`
- Builder Run: `33601385076`（succeeded）
- Customer commitとして報告済み: `9218ab9f...`（完全SHAは現引継ぎでは未回収。prefix以上を推測しない）
- Render Worker deployとして報告済み: `6216228520`

## PHASE 4 / Customer Portal — COMPLETE

- E2E tenant: `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`
- E2E project: `52beffb0-0c87-4949-af45-a36a8e155462`（Cloud Browser Portal E2E）
- Customer: `50105824-c191-43b3-9960-7e83c9f97643`
- Customer Auth user: `df9b7574-4164-4014-8e95-5faa47aa5ff5`
- Final request: `8b94664a-8851-4de1-b447-58dc045cafe2`
- Final workflow: `baa79515-498b-4b38-b6a6-3d812fedf262` — `completed / completed`
- Build task: `7ef95dd3-8a2e-4d5e-b902-2c182f8cef75`
- SEO/A11y task: `853d4c7b-9764-4f8a-8a99-69a17763ad8a`
- Visual task: `e867995e-875b-46ac-abf2-01960ace01f8`
- Copy task: `07f60b15-21ef-475d-ab5c-22f0e1ee9e0f`
- Technical task: `8ca28beb-0502-4ba3-a0ca-fb69afbc5950`
- Release Gate task: `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc`
- Runs: Build `33637959513`; SEO/A11y `33644035238`; Visual `33647937315`; Copy `33661862728`; Technical `33725443457`
- Preview artifacts: `8c84cd57-8850-4401-9f36-c6127316a68c`, `bc3183b5-5294-448e-96b6-38c1d7e3c194`
- Release Gate artifact: `d1029659-fcc4-47bb-9701-d927dfb0bab6`（PASS）
- Final Approval: `35ec6138-1e0d-4b30-829d-a7baa4d9a70e`（`delivery / approved`）
- Verified: 実Supabase Auth、onboarding、project/request/messages、workflow progress、artifacts、preview_url紐付け、Portalから実preview表示、最終承認DB/Portal表示、Portal/Preview application console error 0。

## PHASE 5 / Admin — COMPLETE

### 実装済み

- React 19 + TypeScript + Vite SPAとして `/admin/` を実装。
- Supabase-backed v2 APIによるoverview/project detail。
- 6タブ: 概要、依頼・会話、Workflow、成果物・品質、承認、運用記録。
- Supabase Authログイン、role=`admin`検証、customer role拒否。
- password recovery / password update、許可済みredirect経路、strict CSP対応。

### 本番確認済み

- Admin Auth user: `4b9af2d3-f500-4f5e-bced-0decf88f8feb`
- Admin email: `kohayakawakohaya@gmail.com`（パスワードはユーザーだけが保持。文書化禁止）
- Admin profile: tenant `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`, role `admin`, display name `管理者`
- Account creation audit: `6dcf4244-f0f6-458f-9385-419856f26c1e`
- Recovery: Supabase Auth `PUT /user = 200`（2026-09-04 00:40:15 UTC）を確認。
- Password login: Supabase Auth `POST /token = 200`、`GET /user = 200`を確認。
- Cloud Browserで `/admin/` 実ログイン成功、管理者メール表示、案件一覧、E2E案件の概要を確認。
- `Cloud Browser Portal E2E`: workflow completed/current phase completed、Human Gate自動実行なし表示。
- `E2E｜月灯り珈琲 新規Webサイト`: project `deploy_ready`、workflow completed、tasks `21/21 完了`表示。
- customer roleでAdmin API 403、未認証401は確認済み。

### 直近で発見・修正した本番問題

- 症状: Auth成功後、Admin overviewが `internal server error`。
- 実原因: `notifications` のPostgREST呼出だけ403。続くproject detailで必要な `payments`, `deployments`, `audit_logs` もservice_role SELECT未付与。
- 本番修正: Supabase migration `grant_admin_read_service_role_access`, version `20260904004834` を適用。
- 確認: 4テーブルの `service_role SELECT` grant存在、修正後Admin実ログイン・overview表示PASS。
- **source-control drift**: 本番へ適用済みの `20260904004834 / grant_admin_read_service_role_access` を `supabase/migrations/20260904004834_grant_admin_read_service_role_access.sql` として `docs/shared-handoff-foundation` branch（PR #42、Draft）へretroactive migration記録済み（2026-09-08 JST, Claude Code）。**productionへの再適用は行っていない。** `origin/main` への反映はPR #42のmerge待ち。Supabase migration history（`supabase_migrations.schema_migrations`）上に`20260904004834`が正式に記録されているかは未確認のため、今後確認する。

### 最終本番E2E（2026-09-08 JST）

- Cloud Browserの安全な認証入力経由で実Supabase Auth管理者ログイン成功。Adminに管理者メールと案件一覧を表示。
- PHASE 4 project `52beffb0-0c87-4949-af45-a36a8e155462`（Cloud Browser Portal E2E）を選択し、概要、依頼・会話、Workflow、成果物・品質、承認、運用記録の6タブを本番データで確認。
- DB基準では最終workflow `baa79515-498b-4b38-b6a6-3d812fedf262` が `completed / completed`、tasks `16/16` completed。Adminの全体集計 `20/23` は初回失敗workflowを含む正しい集計であることを確認。
- 成果物タブの実リンクからpreview artifact `8c84cd57-8850-4401-9f36-c6127316a68c` を別タブで開き、実画面描画を確認。
- 承認タブで `35ec6138-1e0d-4b30-829d-a7baa4d9a70e` の `delivery / approved` を確認。DB記録と一致。
- reload後もログイン状態を維持し、PHASE 4案件の再選択・表示を確認。
- desktop `1363×936`、tablet `768×1024`、mobile `390×844` で、主要UI・6タブ・案件情報・Workflow・承認表示に崩れ・操作不能なし。
- Adminと実previewのapplication console errorは0件。Cloud Browser拡張由来の `chrome-extension://...` metadata error（Adminで21件）はアプリ外として分離。
- 主要な読取操作・タブ遷移・preview表示で403/500/不整合なし。

## GitHub / deploy state

- `origin/main`: `c2c328f`（2026-09-08、PR #53/#54 merge後）
- PHASE 5 commits: `516c3a2`, `7362090`, `7d78971`, `a871fc9`, `e2c2f8c`
- PHASE 6 commits/PRs: PR #43（`45e449e`）, PR #44（`a6bb4cc`）, PR #45（`75cda86`）, PR #46（`ee12c79`）, PR #50（`ce2e8d2`）, PR #51（`84d9050`）, PR #53（`838d1e6`）, PR #54（`c2c328f`）— すべてmerged
- PRs: #39, #40, #41, #42, #43, #44, #45, #46, #50, #51, #53, #54 merged。
- Render Web `akinael-ai`: `c2c328f`世代のLive deployを2026-09-08に読み取り専用HTTP確認で確認済み（`docs/HANDOFF.md`の確認手法を参照）。public/portal/はRender build時に自動再生成されるが、public/admin/はgit管理下の静的asset commitに依存しており、PR #43〜#51の期間はRenderの通常buildで自動更新されていなかった（原因未特定、`docs/HANDOFF.md`技術的負債表参照）。PR #54でsource commitとの同期を回復した。
- Render Worker `akinael-ai-worker`: 本番稼働をPHASE 1〜4で確認済み。DB上、現在 `queued/running` taskは0でアイドル。最終task更新は2026-09-03 07:10:02 UTC。
- GitHub App: `akinael-ai-runtime-yufi` App ID `4762113`。Core repoとcustomer Organization `akinael-ai-clients`への実接続を確認済み。
- Remote branches: `origin/main`を含め45参照（2026-09-07 fetch時）。**削除禁止**。

## Current blocker / Human Gate

- Current functional blocker: **なし**。PHASE 5本番E2Eは完了。
- Reproducibility blocker: **解消（2026-09-08 JST）**。本番migration `20260904004834` は `docs/shared-handoff-foundation` branch（PR #42、Draft、未merge）へsource control記録済み。`origin/main` への反映はPR #42のmerge待ち。Supabase migration history上の正式記録有無は未確認のまま残す。
- Human Gate: **NO**。PHASE 6で公開・DNS・課金・実顧客通知・データ削除・Secret操作へ進む場合はYES。


## PHASE 6 checkpoint (2026-09-08 UTC checkpoint)

- Branch / Draft PR: `codex/phase6-notification-deployment-gate` / #43
- Remote head: `ef53905ef8c8236ec30c1f75edad8cd320ced144`
- 実装済み: v2 production statusへRelease Gate PASS・delivery approval・deployment stateから導く`deploymentGate`、Portalの通知／公開候補／Human Gate表示、customer approval時の通知・audit記録、同一delivery approvalの重複抑止。
- PASS: Core `npm test` 87/87、Portal/Admin build。
- 未完了: DB制約を伴う重複防止の強化、Admin表示、PR CI/review、Render deploy、本番E2E。
- Production: 未反映。PR #43はDraftでmain未merge。
- Human Gate: NO。production publish・実顧客通知は実行していない。

## PHASE 6 checkpoint (2026-09-08 UTC — notification/deployment hardening)

- CURRENT PHASE: **PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS**
- Working branch / Draft PR: `codex/phase6-notification-deployment-gate` / #43
- Remote source commit: `28643261f1fa9de9feaa83f24197818c18f0214d`（remote branchの最新HEAD。ローカルGit HTTPS push不可のため、GitHub connectorで同一branchへ保存。）
- Completed: PR #43に混入していた文字列`\\n`による構文エラーを除去。customer delivery approvalは`idempotency_key`でDB upsertし、notification/audit失敗で承認済み状態を失敗扱いにしない。PortalのDeployment Gate変数未定義を修正し、Adminに通知・Release Gate・approval・DEPLOY READY・Human Gate/production状態を表示。
- Added migration: `20260908011350_add_notification_approval_idempotency.sql`（approvals/notificationsへのadditive idempotency/delivery-status列・unique index）。本番適用・index/column検証済み。
- PASS: Core `npm test` **88/88**、Admin `npm run build` PASS、Portal `npm run build` PASS、Supabase migration／schema verification PASS。
- Unfinished: PR #43のindependent review、main merge、Render deploy、その後E2E TESTでDB/Portal/Admin/authorization/failure/consoleを確認すること。
- Production: DB migrationのみ反映済み。application codeは未反映。production publish・DNS・実顧客通知は未実行。
- Human Gate: 現時点NO。production publish/DNSまたは実顧客通知はYES。

## PHASE 6 deployment checkpoint (2026-09-08 UTC)

- PR #43 merged to `origin/main`: merge commit `45e449e94ee6275285438d5d2ad2a87c1bc419fa`.
- CI: Core Quality Run `34176064714` PASS.
- DB: additive migration `20260908011350 / add_notification_approval_idempotency` applied; schema verification PASS（approval key column 1、notification columns 4、unique indexes 2）。
- Blocker: Cloud Browserでfresh `/admin/` を確認すると旧asset `index-B6nNySKH.js` が配信され、merged codeのAdmin Deployment Gate UIがまだliveではない。Render live deployがmain mergeを反映したことを確認できるまで、本番E2Eは開始しない。
- Human Gate: NO（Render application deployの確認・再試行はproduction publishではない）。実顧客通知・customer site production publishは未実行。

## PHASE 6 final Claude Code handoff checkpoint (2026-09-08 UTC)

- **CURRENT PHASE: PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS.** PHASE 6 is **not** COMPLETE; PHASE 1–5 are COMPLETE.
- This supersedes the earlier historical Render-old-asset note: owner confirmed Render Web main `a6d3e828ad89148448ee02b4520c46b631dc1009` is Deploy succeeded / Live and fresh `/admin/` displays the PHASE 6 UI.
- PHASE 6 implementation is merged to main at `45e449e94ee6275285438d5d2ad2a87c1bc419fa`; production migration `20260908011350_add_notification_approval_idempotency.sql` is applied and verified. Core tests **88/88 PASS**; Portal/Admin builds PASS.
- **Only blocker:** authenticated Customer Portal production-browser E2E. Existing E2E customer: `yuchi.info.contact@gmail.com`. No Portal session exists, and Portal exposes no supported safe password-recovery or passwordless route. Cloud Browser rejected new-customer creation under policy; no bypass/workaround was used and no data was created.
- **Exact next action for Claude Code:** implement a formal, policy-compliant Customer Portal password-recovery flow, securely authenticate the existing E2E customer through it, then finish authenticated notification/approval/deployment-gate E2E with Portal/Admin/DB consistency. Do not store credentials, tokens, or session data.
- Human Gate: real-customer notification, production publish, DNS change, payment/refund, production-data deletion, Secret issuance/reissue/revocation, and irreversible production changes. E2E/production data must not be deleted without explicit owner approval.

## PHASE 6 autonomous session checkpoint — UPDATED, all 3 PRs merged and confirmed live (2026-09-08, Claude Code)

Two consecutive autonomous sessions. First session implemented and opened PR #44/#45/#46 but hit a merge-permission block; this second session re-verified and merged all three. This entry supersedes the earlier "open, unmerged" checkpoint below it — do not read that one as current.

- **PR #44 `fix/portal-password-recovery` — MERGED** (`a6bb4cc`). Implements the Customer Portal password-recovery flow that was PHASE 6's sole E2E blocker. Reuses the already-shipped `/api/v2/auth/password-recovery` and `/api/v2/auth/password` endpoints as-is (no new auth surface, no bypass, no hardcoded credential). Makes the shared `/mypage` recovery bounce script (`public/assets/recovery-redirect.js`) role-aware via `/api/v2/auth/me` so a customer recovery link now lands on `/portal/?mode=recovery` instead of always on `/admin/`. Independent code review (`code-review` skill) found one real bug — the recovery UI was unreachable when a stale session token was present in localStorage — fixed in a follow-up commit on the same branch before merge. Three lower-severity/architectural notes (client-side role-guess fail-open direction, code duplication with Admin's recovery UI, substring-only test assertions) were evaluated and recorded as accepted tradeoffs / tech debt, not actioned — see `docs/HANDOFF.md` technical debt table.
- **PR #45 `fix/protect-portal-preview-from-indexing` — MERGED** (`75cda86`). `robots.txt` and `x-robots-tag`/`no-store` headers now cover `/portal/` and `/preview/:projectId/:artifactId`, matching the existing `/mypage`/`/admin` protection. Found during PHASE 7 research; independent of the auth fix.
- **PR #46 `docs/phase7-akinael-site-research` — MERGED** (`ee12c79`). PHASE 7 Research/Direction spec (`docs/web-production/AKINAEL_PROJECT_SPEC.md`). Docs-only.
- **`origin/main` HEAD is now `b0e8a6e84fdf327ec561a30a5111e24dc474c0fc`** (after also merging PR #47 — this checkpoint's own doc updates — and PR #48, the PHASE 7 implementation plan; both docs-only). Core tests 90/90 PASS on this commit (re-verified locally after merge). Portal and Admin production builds PASS. This is this session's final state; no further merges are pending.
- **Production deploy: CONFIRMED LIVE**, verified by this session via plain read-only HTTPS requests to `akinael-ai.com` (no Render dashboard credentials needed — the Node app itself exposes enough to check):
  - `GET /assets/recovery-redirect.js` → 200, body matches PR #44's new role-aware script verbatim.
  - `GET /robots.txt` → 200, body includes `Disallow: /portal` and `Disallow: /preview/` (PR #45).
  - `GET /portal/` → 200, response header `x-robots-tag: noindex, nofollow` present (PR #45).
  - The Portal's live JS bundle (`/portal/assets/index-CBNkG9eV.js`, fetched from the HTML's script tag) contains the strings `PASSWORD RECOVERY` and `password-recovery` (PR #44's UI is actually in the shipped bundle, not just merged in source).
  - **This confirms Render auto-deploys on push to `main`** — previously an open question in this repo's docs.
  - Caution for future checks: `curl -I` sends a HEAD request, which this app's router does not implement (only `GET` is checked per-route), so HEAD requests always 404 here even when the route works. Use `curl -s -o /dev/null -w '%{http_code}'` (GET) or fetch the body, not `-I`, when probing this app.
- **Merge-permission note:** the first session's `gh pr merge` attempt was blocked by that session's permission classifier; this second session's attempts succeeded without any workaround. The block is apparently per-session/variable, not a fixed rule — see `docs/HANDOFF.md` for the corrected guidance.
- **PHASE 6 remaining blocker — narrowed to exactly one item:** the actual authenticated Customer Portal E2E in a real browser (Cloud Browser), which Claude Code cannot perform (no browser). Implementation and production deploy are no longer blockers. Exact steps for Work are listed in `docs/NEXT_TASKS.md`.
- **Human Gate:** unaffected. No production data was created, changed, or deleted; no real-customer notification was sent; no DNS change; no secret was issued, viewed, or rotated. Merging application code to `main` and confirming a public URL's response headers are not Human Gate actions in themselves.

## PHASE 6 autonomous session checkpoint (2026-09-08, Claude Code, 1-hour autonomous window) — SUPERSEDED, see entry above

Owner stepped away for ~1 hour with autonomous-mode instructions. Summary of what was completed; full detail in `docs/HANDOFF.md` and `docs/NEXT_TASKS.md`.

- **PR #44 `fix/portal-password-recovery`** (open, unmerged): implements the exact-next-action above. Reuses the already-shipped `/api/v2/auth/password-recovery` and `/api/v2/auth/password` endpoints as-is (no new auth surface). Makes the shared `/mypage` recovery bounce script (`public/assets/recovery-redirect.js`) role-aware via `/api/v2/auth/me` so a customer recovery link now lands on `/portal/?mode=recovery` instead of always on `/admin/`. Independent code review (via the `code-review` skill) found one real bug — the recovery UI was unreachable when a stale session token was present in localStorage — fixed in a follow-up commit on the same branch. Three lower-severity/architectural notes from that review (client-side role-guess fail-open direction, code duplication with Admin's recovery UI, substring-only test assertions) were evaluated and recorded as accepted tradeoffs / tech debt rather than actioned, to avoid unvalidated changes to Supabase Auth redirect-URL configuration this session cannot inspect. Core tests 88/88 → 90/90 (see PR #45). Portal and Admin production builds PASS. CI (`Core Quality`) PASS.
- **PR #45 `fix/protect-portal-preview-from-indexing`** (open, unmerged): found during PHASE 7 research, unrelated to the auth fix. `robots.txt` and the `x-robots-tag`/`no-store` headers protect `/mypage` and `/admin` but were never extended to the completed Customer Portal (`/portal/`) or the per-customer draft preview route (`/preview/:projectId/:artifactId`), leaving unapproved draft site content indexable by default. Fixed with new tests (a temporary Portal build-output fixture, since `public/portal/` isn't committed to this repo, and a mocked-Supabase test for the preview route). Core tests 90/90 PASS. CI PASS.
- **PR #46 `docs/phase7-akinael-site-research`** (open, unmerged): PHASE 7 Research/Direction artifact (`docs/web-production/AKINAEL_PROJECT_SPEC.md`), following `AKINAEL_SITE_PLAN.md`'s own Phase 1 process and the existing `PROJECT_SPEC_TEMPLATE.md` format. Docs-only, no Build. Records two concrete findings for owner decision: the homepage's registration CTA still opens the legacy `/mypage` dialog instead of routing to the completed Customer Portal (so the two apps finished in PHASE 4/5 aren't actually wired into the site's acquisition funnel), and the live site is single-page while `website-content-requirements.md` specifies a multi-page IA. CI PASS.
- **Merge blocker (session-level, not a Human Gate):** `gh pr merge` on PR #44 was blocked by this session's own permission classifier ("Blocked by classifier... merging to main"), despite the owner's standing autonomous-mode instructions authorizing merge when CI/tests/review pass. This is a tool-permission boundary of this specific session, not a judgment call — no workaround was attempted (per the classifier's own guidance not to route around a denial). **PRs #44, #45, #46 are ready to merge (CI PASS, reviewed) but require the owner or a permitted session to run the actual merge.**
- **Exact next action:** merge PR #44, #45, #46 to `main` (any order — they touch disjoint files and are independent). After PR #44 merges, confirm Render actually redeployed the new commit before attempting the Customer Portal recovery E2E — PHASE 6's PR #43 merge earlier the same day had a real instance of Render continuing to serve a stale asset bundle until the deploy was manually confirmed live (see the "PHASE 6 deployment checkpoint" note in `docs/HANDOFF.md`), so don't assume the merge alone means the fix is live in production.
- **Human Gate:** unaffected by this checkpoint. No production data was created, changed, or deleted; no real-customer notification; no production deploy or DNS change; no secret was issued, viewed, or rotated.

## PHASE 6 critical-fix checkpoint (2026-09-08, third Claude Code session) — supersedes prior "blocker resolved" claims

- **`origin/main` is now `ce2e8d27f1550e8c296ba4116f3c7ed0fafae962`.**
- **Correction to the record:** the earlier checkpoint above ("PHASE 6 remaining blocker narrowed to Cloud Browser E2E only") was **incomplete**. PR #44's recovery flow was merged and live, but a real script-loading race (`app.js`, deferred, unconditionally consumes and strips the same URL hash `recovery-redirect.js` needs, and reliably finishes first) meant the feature was **broken for actual browser users** the whole time it was live — the emailed recovery link would land on `/portal/?mode=recovery` with no `access_token`, so the password-set form never appeared. This was only caught via independent review (executing the real scripts under `node:vm` with the race simulated), not by the HTTP/static checks this session relied on earlier. **Fixed and confirmed live** in PR #51 (`84d9050`) — see `docs/HANDOFF.md` for detail. New regression test (`test/recovery-redirect-race.test.mjs`) verified to fail against the pre-fix code and pass against the fix.
- Also merged: PR #50 (`ce2e8d2`), CORS support scoped to `/api/v2/auth/register`+`/login`, needed by the new `akinael-ai-web` marketing site's register widget (separate repo, PHASE 7, owner-approved Astro Build in progress there — PR #4).
- Core tests 93/93 PASS on `ce2e8d2`.
- **The Cloud Browser E2E can now actually be attempted with a reasonable expectation of success.** Prior attempts (if any were made against the broken window) would have failed regardless of correct link/credentials.
- New unfixed technical debt recorded (not actioned, out of this session's scope): `admin/src/Admin.tsx` has the identical stale-session recovery-UI bug `Portal.tsx` had before `9233e79`; `Portal.tsx`'s `updatePassword` doesn't clear an old session after a successful reset. See `docs/HANDOFF.md` technical debt table. **— both fixed; see the checkpoint below.**
- Human Gate: unaffected. No production data, DNS, notification, or payment action.

## PHASE 6 critical-fix checkpoint (2026-09-08, fourth Claude Code session) — the two remaining recovery bugs are fixed, tested, merged, and confirmed live

Both bugs recorded as unfixed technical debt in the checkpoint above are now fixed, with regression tests, and confirmed live in production. **PHASE 6 is still IN PROGRESS — this closes the last known code-level blocker, not the phase itself. PHASE 6 becomes COMPLETE only when Work's Cloud Browser E2E actually PASSes (see `docs/NEXT_TASKS.md`).**

- **Bug 1 — Admin stale-session recovery-UI unreachable.** `admin/src/Admin.tsx` never received the fix `Portal.tsx` got in `9233e79`: the recovery card was nested inside `if(!token||!me)`, so an admin whose browser still had a valid stale `localStorage` session couldn't reach the "set new password" form from an emailed recovery link — the background session check would resolve successfully and route to the dashboard instead. Fixed with a one-line gate reorder: `if(recoveryMode||!token||!me)`.
- **Bug 2 — Portal/Admin don't clear the old session after a successful password reset.** Both `Portal.tsx`'s and `Admin.tsx`'s `updatePassword` left the pre-reset `token`/`localStorage` session in place after a successful reset, so a stale-but-valid session would carry the user straight into the authenticated dashboard instead of a normal-login state with the new password — contradicting the UI's own "log in again" message. Fixed by calling each component's existing `logout()` (already correctly, conditionally hitting the real Supabase-backed `/api/v2/auth/logout`, and clearing state/localStorage) before redirecting.
- Both fixes reuse existing, already-correct logic — no new auth mechanism, no bypass, no hardcoded credential, no test-only endpoint.
- Added Vitest + Testing Library + jsdom test infrastructure to `portal/` and `admin/` (previously untested React packages). New tests: `admin/src/Admin.test.tsx` (3 tests), `portal/src/Portal.test.tsx` (4 tests) — covering stale-session recovery access, post-reset session cleanup, normal login regression, and recovery-hash-missing regression. **Verified with teeth**: stashed each `.tsx` fix, confirmed the corresponding new test fails against the pre-fix code, restored the fix, confirmed it passes.
- Core suite: 93/93 PASS. Both `portal`/`admin` `npm run build` clean.
- **PR #53** (`bec7a02` → merged `838d1e6`): the two code fixes + tests. CI PASS, merged.
- **PR #54** (`5c4171f` → merged `c2c328f`): a necessary follow-up. After #53 merged, `akinael-ai.com/portal/`'s live bundle updated to the fix within minutes (byte-diff confirmed identical to a local build off the merge commit), but `akinael-ai.com/admin/` kept serving the exact same pre-fix bytes as before. Root cause: `public/admin/` is committed to git (unlike `public/portal/`, which Render regenerates from `admin/dist`/`portal/dist` at deploy time per `render.yaml`), and it hadn't been refreshed since `7362090`/`7d78971` — Render's build isn't actually keeping it in sync, for a reason this session couldn't diagnose without dashboard/build-log access. PR #54 rebuilt `admin/` off `838d1e6` and re-synced the committed bundle (`index-B6nNySKH.js` → `index-DmdIVxZS.js`), matching this repo's own established precedent (`7362090`) for shipping Admin changes. This is a **new, still-open technical debt item** — see `docs/HANDOFF.md`.
- **PR #54's merge was blocked twice by this session's own permission classifier** (same session-variable behavior documented in earlier checkpoints — sometimes blocks, sometimes doesn't). Per the no-workaround rule, this session stopped and reported it; **the owner merged PR #54 manually.**
- **Production verification (read-only, this session, post-merge of both PRs):**
  - `GET /admin/assets/index-B6nNySKH.js` → `404` (old bundle gone).
  - `GET /admin/assets/index-DmdIVxZS.js` → `200`, byte-for-byte identical to a fresh local `admin/` build off `c2c328f`.
  - `GET /portal/`'s live JS bundle → byte-for-byte identical to a fresh local `portal/` build off `838d1e6`.
  - `GET /admin/` → `200`, correct HTML shell, correct CSP/`x-robots-tag` headers, both new JS and CSS assets resolve `200`.
  - **Not verified by this session** (no browser available): actual DOM rendering, interactive behavior, or JavaScript console errors for `/admin/`. HTTP/byte-level evidence is strong (identical bytes to a build that passed 3/3 targeted regression tests plus the full 93/93 suite), but real-browser confirmation — including console error 0 — is Work's Cloud Browser E2E, per the existing Claude Code / Work split (see `docs/NEXT_TASKS.md` step 9).
- `origin/main` is now `c2c328f`.
- Human Gate: unaffected. No production data, DNS, real-customer notification, or payment action. No Secret was issued/viewed/rotated.


## PHASE 6 Production Browser E2E — FAIL checkpoint (2026-09-08 UTC, Work)

- **CURRENT PHASE remains PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS. PHASE 6 is not COMPLETE.**
- Recovery PASS evidence: production Portal showed the password-recovery request UI; recovery email request succeeded; the owner completed the secure recovery link/password step without exposing secrets; normal Customer Portal authentication succeeded and survived Portal reload.
- Existing E2E project: `52beffb0-0c87-4949-af45-a36a8e155462`. Created exactly one authorized E2E request, `746feb20-b98b-42ce-bc44-47218402534e`, title `E2E TEST PHASE 6 APPROVAL`. Its workflow `eed70c53-ec31-4d8a-861a-262fb534f08c` completed 4/4 consultation tasks. Do not delete this data; record it as a deletion candidate only.
- Approval E2E FAIL: Portal POST returned non-2xx and displayed `承認を記録できませんでした`. The Cloud Browser surface did not expose the numeric response status. DB after the attempt remained approvals=1 (only legacy approval `35ec6138-1e0d-4b30-829d-a7baa4d9a70e`), notifications=0, deployments=0; therefore a second send could not test duplicate protection and was not retried blindly.
- Root-cause evidence: production code sends PostgREST `on_conflict=idempotency_key`; production DB provides only partial unique index `approvals_idempotency_key_unique ... WHERE idempotency_key IS NOT NULL`. PostgreSQL cannot infer that partial index for an unqualified `ON CONFLICT (idempotency_key)`, explaining the insert failure. The notification index uses the same pattern and requires review.
- Deployment Gate consistency FAIL: DB task `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc` has `task_key=expanded_release_gate`, completed, review PASS, while code filters `task_key=eq.release_gate`. Portal/Admin consequently displayed Release Gate unmet / not ready despite valid PASS evidence and approved delivery. Production remained not published, as required.
- Browser QA: Portal/Admin authenticated reload PASS; Admin six-tab navigation available; application-origin console errors 0. Only `chrome-extension://kcdongibgcplmaagnmgpjhpjgmmaaaaa` metadata errors were present and were classified as browser-extension errors. Full responsive PASS was not claimed after the critical E2E failure.
- **Exact next action:** Claude Code should fix the PostgREST idempotency/index mismatch for approvals and notifications, fix Release Gate task-key lookup to match persisted `expanded_release_gate` records (with deterministic ordering), add regression tests that use PostgreSQL semantics rather than mocks alone, deploy, then rerun this Production Browser E2E.
- Human Gate unchanged: production publish, real-customer notification, DNS, payment/refund, production-data deletion, Secret operations, and irreversible production changes. None were performed.

## PHASE 6 production defect fix checkpoint (2026-09-09 UTC, Work)

- **CURRENT PHASE: PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS.** PHASE 1〜5はCOMPLETE。Production Browser再E2Eが全項目PASSするまでPHASE 6 COMPLETEにしない。
- Production E2E FAILの原因2件を修正し、PR #56をmainへmerge。main commit: `f12514a16aa8989d05e444c5c7749ff00ca57cd0`。
- Approval/Notification: partial unique indexを通常のUNIQUE indexへ安全に変更し、PostgREST `on_conflict=idempotency_key` とDB制約を一致。duplicate insertは`ignore-duplicates`で既存actor/note/timestampを上書きせず、競合時は既存approvalを再取得する。
- Notification failure: durable approvalをfalse failureにせず`pending_retry`を返し、同一approval再送時にnotification insertを再試行。approval/notificationはいずれも1件へ収束する。
- Deployment Gate: `mode=release_gate`から候補を取得し、Release Gateを含む最新workflowを選択。そのworkflow内では`expanded_release_gate`をlegacy `release_gate`より優先。古いworkflowのPASSを新しいpending/FAILより優先しない。
- Tests: Core **105/105 PASS**、Portal **4/4 PASS** + lint/build PASS、Admin **3/3 PASS** + lint/build PASS。Core Quality Run `34299851288` PASS。独立レビューは初回のnotification retry欠落を検出、修正後再レビューでblocking finding 0。
- Production DB: migration history version `20260909013641` / `make_idempotency_indexes_postgrest_compatible` 適用済み。source fileは同version名へ整合。適用前duplicate non-null key groupはapprovals/notificationsとも0。適用後、両indexはWHERE句なしのUNIQUE btreeであることを確認。
- Render/application: main merge後の一時502を経てCustomer Portal `/portal/` は実ブラウザ表示成功。Cloud Browserの`/health` URL policy拒否は既知の非blocker。Production Browserのapproval再E2Eは未実行。
- E2E data（削除禁止、削除にはオーナー承認が必要）: request `746feb20-b98b-42ce-bc44-47218402534e`、workflow `eed70c53-ec31-4d8a-861a-262fb534f08c`、project `52beffb0-0c87-4949-af45-a36a8e155462`。
- Human Gate: production publish、実顧客notification、DNS、payment/refund、production data削除、Secret操作。今回いずれも未実行。

## PHASE 6 Production Browser再E2E — notification privilege FAIL (2026-09-09 UTC, Work)

- **RESULT: FAIL。PHASE 6はIN PROGRESSのまま。** PHASE 1〜5 COMPLETE。
- Baseline（request `746feb20-b98b-42ce-bc44-47218402534e`）: approvals 0、対応notifications 0、audit 0、project deployments 0。workflow `eed70c53-ec31-4d8a-861a-262fb534f08c` completed。latest relevant Release Gateはtask `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc` / `expanded_release_gate` / completed / PASS。
- Portal Auth / project / request: PASS。通常login成功、E2E projectと対象requestを確認。PortalはRelease Gate修正後の「公開候補です」「本番公開にはオーナーの明示承認が必要です」を表示。
- 1回目approval: Portalは「最終承認を記録しました。」を表示。DBにapproval `aa5c4245-fb07-4a27-a0aa-71b7f92b94aa` がrequest_id一致、delivery/approvedで1件作成された。APIはPortalの`r.ok`成功分岐に入ったため2xxと判断できるが、数値status/bodyはCloud Browser surfaceでは未取得。
- **FAIL:** 対応notification 0、audit 0。Portal通知欄も「新しい通知はありません」。deployment 0は期待どおり。
- Root cause: production table privilegeで`service_role`は`approvals INSERT`を保持するが、`notifications INSERT`と`audit_logs INSERT`を保持しない。server-side PostgREST insertが権限拒否され、applicationはdurable approval維持のためnotificationを`pending_retry`として握り、auditもbest-effortで失敗していると判断。
- Failure policyに従い2回目approval、Admin整合、responsive最終判定には進んでいない。duplicate protectionは未検証。
- Console: application-origin error 0。記録されたerrorはすべて`chrome-extension://kcdongibgcplmaagnmgpjhpjgmmaaaaa`由来でアプリ外。
- Retain: request `746feb20-b98b-42ce-bc44-47218402534e`、workflow `eed70c53-ec31-4d8a-861a-262fb534f08c`、new approval `aa5c4245-fb07-4a27-a0aa-71b7f92b94aa`。削除禁止。
- Human Gate維持。production publish・実顧客notification・DNS・payment/refund・production data削除・Secret操作は未実行。

## PHASE 6 notification/audit recovery fix (2026-09-09 JST, Claude Code, fifth session)

上記BLOCKERで特定された`service_role`権限不足に加え、Workが指摘した通り**権限修正だけでは再E2Eでaudit evidenceが再び0件になり得る**structural gapを発見・修正した。**PHASE 6はまだCOMPLETEにしない。**

- **重要な訂正の経緯**: このセッションは最初、直近の`origin/main`を取得せずにfix branchを作成してしまい、`fix/approval-notification-audit-recovery`（PR #59）としてPR化した。その後、PR #56（`f12514a`、別セッションによる既存merge済み修正）が同じ`createCustomerApproval`関数をすでに`recordNotification`/`recordAudit` helper closure構成へ書き換えていたことに気づき、PR #59を古い前提のコードとしてcloseし、`origin/main`最新（`7983c58`）から作り直した。
- **root cause 1（grant不足）**: `service_role`は`approvals INSERT`のみ保持し、`notifications INSERT`/`audit_logs INSERT`を保持していなかった。新migration `20260909063434_grant_notification_audit_service_role_insert.sql` でこの2権限のみ追加（既存SELECT grant維持、ALL/UPDATE/DELETEは追加しない）。追加前にcodebase全体の`notifications`/`audit_logs`への書込み操作を監査し、INSERT以外の操作が存在しないことを確認済み。
- **root cause 2（PR #56自体に残っていた欠陥、Workの指摘どおり）**: PR #56の`createCustomerApproval`は、既存approvalへの再送時に`if (notification.status === 'pending_retry') await recordAudit(existing, notification);`という条件でrecordAuditを呼んでいた。つまりnotificationが成功（`status === 'recorded'`）した瞬間、recordAuditは一切呼ばれない。grantを直しただけでは、retry時にnotificationは復旧してもauditは永遠に0件のままになるはずだった。新approval側にも同型の`if (inserted || notification.status === 'pending_retry')`という同じ欠陥があった。
- **修正**: 両呼び出し箇所でrecordAuditを無条件呼び出しに変更し、「重複させない」ルールをrecordAudit内部へ移動した。具体的には、notification.status==='recorded'のときだけ、当該approvalに既存の`delivery_approval_recorded` audit行があるかをtenant_id/resource_type/resource_id/actionで確認し、あれば何もしない。`pending_retry`のaudit行は、実際に別々の失敗試行を記録するものとして重複排除の対象外とした（`delivery_approval_recorded`だけを無意味に増殖させないという指示に合わせた設計判断）。
- **test**: production baselineを正確に再現するCASE A（notification/auditとも作成時に権限不足で失敗 → grant修正後の再送でnotification 0→1、audit 0→1、approval件数不変）、CASE B（すでに完全に記録済みのapprovalへの再送はaudit重複なしのno-op）を新規追加。既存の「a duplicate approval retries a previously failed notification...」testにaudit件数の明示assertion（2件：初回のpending_retry + recovery時のdelivery_approval_recorded）を追加。`src/platform-store.mjs`をgit stashで一時的に戻し、CASE Aと強化した既存testが修正前コードに対して実際にFAILすることを確認後、復元してPASSを確認済み。
- **独立レビュー**: 2回実施（1回目は古いbase由来のため無効化・破棄、2回目を正しいdiffに対して実行）。並行性に関する残存リスク（同一approvalへの真の同時多重送信が`delivery_approval_recorded`を2件作る可能性）をコメントで明記のうえ、DB制約なしのbest-effort設計として許容と判断。verdict: safe to merge as-is。
- **PR #60** (`4bd98cb` → merged `841bb93`)。CI PASS。Core tests **107/107 PASS**。`origin/main`は`841bb93`。
- **production migration適用はこのセッションでは実行できていない**: このClaude Code環境にはSupabase CLI・DB接続文字列・Management API tokenのいずれも存在せず、GRANT文（DDL）を直接実行する手段がない。Work、またはSupabase SQL editorへアクセスできるセッション/オーナーが`supabase/migrations/20260909063434_grant_notification_audit_service_role_insert.sql`を本番へ適用する必要がある。適用前にWorkが同じapprovalを再送しても、notification/auditは依然として0件のままになる。
- Human Gate: 影響なし。production data作成・変更・削除、実顧客notification、DNS、Secret操作のいずれも実行していない。

## PHASE 6 Admin mobile QA investigation (2026-09-09 JST, Claude Code, 第6セッション)

Gemini mobile visual QAで、Portal PASS・Admin FAILという結果が報告された（Adminのsidebarが画面幅の約30〜40%を固定占有し、主要コンテンツ・tabsが右側で見切れる）。指示どおり推測で修正せず、再現・root cause特定を先に行った。**PHASE 6はまだCOMPLETEにしない。**

- **再現できなかった**: 実ブラウザ2種（ローカルcache済みChromium、および本番`https://akinael-ai.com/admin/`直接）で390x844・375x812をPlaywrightで検証したところ、いずれも正常表示（横方向overflowなし、sidebarはfull-width・stacked、`matchMedia`はtrue）。Portalの報告どおりのPASS挙動と一致し、報告されたAdmin FAILとは矛盾する結果だった。
- **数値的に一致する仮説（未確定、推測として明記）**: viewport幅828pxで検証すると、sidebar幅がちょうど画面の32.6%となり、「約30〜40%」という報告と正確に一致した（760pxのbreakpointを超えているためmobile CSSが適用されない状態）。QAツールが`<meta name="viewport">`を正しく解釈せず、より広いlayout viewportへfallbackしていた可能性が高いと推測されるが、Gemini側の実際のbrowser/viewport設定はこのセッションから確認できず、証明はできていない。
- **原因を問わず修正した実在の互換性gap**: Viteの既定CSS minifierが、source側の`max-width:760px`等のclassic media query構文を、実行時ブラウザ対応がより狭いCSS Media Queries Level 4のrange構文（`width<=760px`）へ自動変換していたことが判明。未対応browserでは`@media`ブロック全体が無効になるため、報告された症状（sidebar・tabs・metrics・textすべて同時におかしくなる）と整合する。`admin/vite.config.ts`・`portal/vite.config.ts`へ`build.cssTarget:"safari14"`を追加し、classic構文へ回帰させた（build出力のbyte diffで、この1点以外に差分がないことを確認済み）。
- **新規test**: `admin/e2e/mobile-responsive.spec.ts`（Playwright、このrepo初の実ブラウザtest。既存のVitest/jsdomでは実CSS layoutを検証できないため）。390x844・375x812での横overflowなし・sidebar非固定・主要panelがviewport内・console error 0、および1280pxでのdesktop layout回帰確認をカバー。mobile breakpointを一時的に破壊してtestがFAILすることを確認後、復元してPASSを確認済み（fail-before/pass-after）。CIには組み込まず、ローカル`npm run test:mobile`実行の運用（既存frontend testと同じ扱い）。
- **overflow:hiddenのband-aidは使用していない**: 実際のlayoutは複数engineで正しいことを確認済みのため、隠す必要のあるoverflowは存在しなかった。
- **PR #62**（`2b47168` → merged `9eb989b`）・**PR #63**（`1064264` → merged `34d2cc0`、`public/admin/`の既知の静的asset非同期問題への追加対応、PR #54と同一パターン）。独立レビュー実施、verdict: safe to merge as-is。
- **production反映確認**: `GET /admin/assets/index-B6rBGd6d.css`が200・ローカルbuildとbyte一致・classic構文を含むことを確認。旧bundleは404。本番へPlaywright再実行し、390x844・375x812とも横overflowなし・console error 0を確認。
- Core tests 107/107 PASS（今回は影響なし、frontend限定の変更）。`origin/main`は`34d2cc0`。
- **正直な限界の明記**: このcssTarget修正がGemini再検証を確実にPASSさせると断言はできない。確認できたのは、(a) 実際のresponsive実装は複数engine・本番環境で正しく動作していること、(b) 報告された症状と整合する実在のbrowser互換性gapを1件発見・修正したこと、の2点のみ。再検証後も再現する場合は、Gemini側が実際に使用しているbrowser/viewport emulationの確認が次の手がかりとなる。
- Human Gate: 影響なし。production data・実顧客notification・DNS・Secretの変更は一切なし。approval再送・notification生成・request作成は今回のtaskの範囲外として実行していない。
