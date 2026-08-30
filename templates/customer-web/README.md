# Customer Web Repository Standard

顧客サイトrepositoryには、制作物と品質基準だけを保持する。
Codex実行workflowとOpenAI/GitHub secretsは顧客repositoryへコピーしない。

## Repository側に必要なもの

- root `AGENTS.md`
- `package.json` の `qa` script
- Playwright等の実ブラウザQA
- サイト本体のsource code

新規Web案件では、Coreが最初のBuild直前にprivate repositoryを自動作成する。
`GITHUB_TEMPLATE_REPO` が設定されていればGitHub templateから作成し、未設定ならCore同梱のNext.js starterを投入する。

## Execution

Codex実行はCore repositoryの `.github/workflows/akinael-agent.yml` に集約する。
Core Actions側だけに以下を設定する。

- `OPENAI_API_KEY`
- `AKINAEL_GITHUB_APP_ID`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`
- repository variable `AKINAEL_BOT_USER`

中央runnerがGitHub Appのrepository-scoped tokenを一時発行し、対象顧客repositoryをcheckoutする。
`persist-credentials: false` とし、CodexにはGitHub credentialを永続配置しない。

## Branch / Release boundary

`main` へ直接実装しない。
作業は `akinael/run-*` branch上で行う。
Release Gateを通過しても、production merge / deploy / DNS変更はHuman Gateとして残す。

このディレクトリはrepository標準の説明用であり、実行workflowは含めない。
