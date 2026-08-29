# Autonomous Workflow Execution Engine

## Purpose

Production Router が作成した `workflow_runs` / `tasks` を、人間のフェーズ確認で停止せず実行する。
Web制作・自動化案件は Release Gate を通過して `DEPLOY READY` になるまで内部工程を継続する。

実際のProduction deploy、DNS変更、新規有料サービス有効化、正式情報不足、破壊的変更はHuman Gateとして残す。

## Runtime

```text
Request
→ Production Router
→ workflow_runs / tasks
→ Worker
   ├─ Responses Executor
   │   ├─ intake / direction / copy / analysis
   │   └─ research + Web Search
   └─ Central GitHub Codex Executor
       ├─ repository bootstrap when needed
       ├─ implementation
       ├─ browser / technical QA
       └─ correction loop
→ artifacts / quality evidence
→ Release Gate
→ DEPLOY READY
```

Worker entrypoint:

```bash
npm run worker
```

Workerは1回のtickで以下を行う。

1. 実行中の外部GitHub jobを確認する
2. `claim_next_workflow_task()` でqueueから1件claimする
3. タスク種類に応じてResponsesまたはGitHubへ実行を委譲する
4. 成果物を `artifacts` に保存する
5. `finish_workflow_task()` により依存タスクを自動解放する

DB claimは `FOR UPDATE SKIP LOCKED` を使用するため、Workerを複数起動しても同一taskを二重claimしない。

## Responses Executor

対象:
- intake
- direction
- copy / content
- triage
- research
- repositoryを必要としないreview

Research taskのみResponses APIのWeb Search toolを有効化する。
Research結果ではURL citation/sourceもartifact metadataへ保存する。

## Central GitHub Codex Executor

Codex runnerは顧客repositoryごとに複製せず、Core repositoryの `.github/workflows/akinael-agent.yml` に1つだけ置く。
顧客repositoryにはOpenAI API keyや実行workflowを保存しない。

Core Workerが中央workflowへ以下を送る。

- target repository
- `akinael/run-*` branch
- task / workflow id
- execution stage
- permission profile
- Coreが組み立てたprompt

中央workflowはGitHub Appから対象repository限定の短命tokenを発行し、そのrepositoryをcheckoutする。
`persist-credentials: false` を使用し、Codex workspaceへGitHub credentialを永続配置しない。

Codex permission profile:
- implementation / correction: `:workspace`
- independent review: `:read-only`

protected paths:
- `.github/`
- `.git/`
- `.codex/`
- `.akinael/`（result fileを除く）
- `AGENTS.md`

Core Actionsのsecret/variableは1回だけ設定する。

- `OPENAI_API_KEY`
- `AKINAEL_GITHUB_APP_ID`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`
- repository variable `AKINAEL_BOT_USER`

## Repository Bootstrap

新規Web案件ではResearch/Direction中にrepositoryを作らず、最初のBuild taskをclaimした時点で初めて作成する。

```text
web_new Build
→ repositoryがある?
   ├─ Yes → そのまま実装
   └─ No
      → private repository作成
      → starter/template投入
      → GitHub App access確認
      → Supabase repositoriesへ登録
      → Codex Build dispatch
```

`web_change` ではrepositoryが未登録でも新規repositoryを勝手に作らない。対象repository不足として失敗し、誤った別サイトを作ることを防ぐ。

Bootstrap方法:

1. `GITHUB_TEMPLATE_REPO` が設定されていればGitHub templateからprivate repositoryを生成する。
2. 未設定ならCore同梱のNext.js starterを直接seedする。

同梱starterには以下を含む。

- Next.js / TypeScript
- ESLint
- Playwright
- mobile / desktop smoke QA
- `npm run qa`
- root `AGENTS.md`

### GitHub ownerについて

現在のような個人GitHubアカウント配下へrepositoryを作成する場合、repository作成専用の `GITHUB_BOOTSTRAP_TOKEN` をWorkerに設定する。
GitHub Appは作成後のrepositoryアクセス・Actions実行に使用する。

将来customer repositoriesをGitHub Organization配下へ移す場合は、GitHub AppにAdministration/Contentsの適切な権限を与えることで、repository作成もApp中心へ寄せられる。

新規repositoryをSupabaseへ登録する前にGitHub Appから実アクセス確認を行う。Appが新repositoryへアクセスできない設定の場合は制作開始前に失敗させる。

## QA and correction loop

GitHub executorはCodexの文章だけでPASS判定しない。
Codex終了後にrepository固有の `npm run qa`（なければ `npm test`）を実行する。
QA command自体が無いrepositoryはPASS扱いにせずFAILとする。

```text
Builder
→ repository QA
→ Reviewer
→ PASS ─────────→ next task
→ FAIL
   → Builder correction
   → repository QA
   → same Reviewer
   → PASS / FAIL
```

Reviewer outputは機械判定可能なJSONを要求する。

```json
{
  "status": "PASS",
  "findings": [],
  "summary": "..."
}
```

`npm run qa` がFAILした場合、Reviewer本文がPASSでもCore側で強制FAILとする。
Review correctionは最大2周。通常task failureはDBの `max_attempts`（既定3回）まで自動retryする。

テストやReview基準を弱めてFAILを消すことは禁止する。

## Dynamic expansion

`web_change` / `general` は最初からフルPipelineを固定しない。
AI triage結果を正規化し、Coreが許可されたtask graphへ展開する。

`web_change` impact:
- content
- visual
- technical
- strategic

`general/other` route:
- web_new
- web_change
- copy
- social
- image
- research
- automation
- seo
- answer_only

AIが任意のexecutor commandや任意task graphを直接生成して実行することはない。

## Persistence

- `tasks`: queue / retry / result
- `workflow_runs`: pipeline state
- `artifacts`: AI成果物・review結果・citation
- `executor_jobs`: GitHub external job state / URL / result / error
- `repositories`: projectとGitHub repositoryの対応
- `requests`: customer request state
- `projects`: project state

外部taskは `executor_jobs.task_id` で一意。再dispatch時は前回のerror/result/completed stateをクリアする。

## Required production configuration

Core / Worker:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`
- `RESEARCH_MODEL`
- `GENERAL_AGENT_MODEL`
- `GITHUB_EXECUTOR_REPO`
- GitHub App credentials
- `GITHUB_REPO_OWNER`
- 個人ownerの場合 `GITHUB_BOOTSTRAP_TOKEN`

Core GitHub Actions:
- `OPENAI_API_KEY`
- `AKINAEL_GITHUB_APP_ID`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`
- `AKINAEL_BOT_USER`

Customer repositories:
- source code
- root `AGENTS.md`
- repository固有のQA command / browser tests
- OpenAI/GitHub secretは不要
- Codex workflowも不要

Render Workerを実際に作成・有効化することは有料インフラ操作なのでHuman Gate。
コードと設定はdeploy-readyにしても、明示承認なしに有料Workerを起動しない。
