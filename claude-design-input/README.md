# Claude Design 実装入力

このディレクトリは、2026-09-16にClaude Designで確定したアキナエルAIのUI刷新仕様をClaude Codeへ引き継ぐための実装入力です。

## 読む順番
1. `/AGENTS.md`
2. `/CLAUDE.md`
3. `/docs/PROJECT_STATUS.md`
4. `/docs/HANDOFF.md`
5. `/docs/NEXT_TASKS.md`
6. `/docs/platform-architecture.md` と関連資料
7. `./IMPLEMENTATION_BRIEF.md`
8. `./customer-portal/README.md`
9. `./admin-console/README.md`
10. 公開サイトrepo `Yufi-Web-Create/akinael-ai-web` の同名branch `design-input/claude-redesign-20260916` にある `claude-design-input/public-site/README.md`

## 対象
- `portal/`: 顧客マイページ刷新
- `admin/`: 管理ツール刷新
- Core Backend/API/Supabase/Workflow: 新UI接続に必要な範囲で調整
- `akinael-ai-web`: 公開LP刷新

## 重要
これは「デザインだけの差し替え」ではない。既存のSupabase Auth、DB、AI Workflow、承認、成果物、preview_url、Stripe導線等へ実際に接続すること。

prototype由来のmock data / setTimeout / 擬似チャットをproductionに残さない。内部用語を顧客・通常管理画面へ露出しない。

実装は最新mainから別branchを作って行い、このbranch自体へproduction実装を積み上げないこと。
