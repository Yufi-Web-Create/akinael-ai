# Customer Web Runtime Template

顧客サイトrepositoryへ組み込むアキナエルAI実行境界。

必須:

- `.github/workflows/akinael-agent.yml`
- root `AGENTS.md`
- `package.json` の `qa` script（推奨）
- Playwright等の実ブラウザQA
- GitHub Actions secret `OPENAI_API_KEY`

Coreはworkflowを直接編集せず、この共通runnerへ `workflow_dispatch` する。
案件ごとの仕様・Research・Direction・Review基準はCoreがprompt/contextとして渡す。

`main` へ直接実装しない。作業は `akinael/run-*` branch上で行い、Release Gate後もproduction merge/deployはHuman Gateとする。

このディレクトリは配布用テンプレートであり、Core repository自身のActions workflowとしては実行しない。
