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
   └─ GitHub Codex Executor
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

## Executors

### Responses Executor

対象:
- intake
- direction
- copy / content
- triage
- research
- repositoryを必要としないreview

Research taskのみResponses APIのWeb Search toolを有効化する。
Research結果ではURL citation/sourceもartifact metadataへ保存する。

### GitHub Codex Executor

対象:
- frontend/build
- SEO/A11yで実repository確認が必要な工程
- visual/browser review
- technical review
- review FAIL後のBuilder correction

顧客repositoryには `.github/workflows/akinael-agent.yml` を配置する。
Coreは `workflow_dispatch` でtaskを送信し、Codexはworkflow専用branch `akinael/run-<workflow-id>` 上だけで作業する。

CodexにはGitHub credentialを渡さない。
`actions/checkout` は `persist-credentials: false` とし、branch fetch/pushだけをCodex実行の前後の限定stepで行う。

Codex permission profile:
- implementation / correction: `:workspace`
- independent review: `:read-only`

protected paths:
- `.github/`
- `.git/`
- `.codex/`
- `.akinael/`（Coreが作るresult fileを除く）
- `AGENTS.md`

## QA and correction loop

GitHub executorはCodexの文章だけでPASS判定しない。
Codex終了後にrepository固有の `npm run qa`（なければ `npm test`）を実行する。

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
- GitHub App credentials（production推奨）

Target repositories:
- `.github/workflows/akinael-agent.yml`
- GitHub Actions secret `OPENAI_API_KEY`
- repository固有のQA command

Render Workerを実際に作成・有効化することは有料インフラ操作なのでHuman Gate。
コードと設定はdeploy-readyにしても、明示承認なしに有料Workerを起動しない。
