# アキナエルAI Runtime Setup

この文書は、Execution Engineを実環境で初回E2E実行するための資格情報配置を定義する。
Secret値そのものはrepositoryへ保存しない。

## 1. Runtime boundary

```text
Render Worker
├─ Supabase service access
├─ OpenAI Responses API
├─ GitHub App API / workflow dispatch
└─ new-web repository bootstrap

Core GitHub Actions / Akinael Agent
├─ OpenAI Codex Action
└─ short-lived GitHub App token → customer repository
```

Supabase secretはGitHub Actionsへ置かない。
GitHub Actions用SecretとRender Worker用Secretは役割が異なる。

## 2. Known non-secret values

以下はコード側で確定済み。

- `SUPABASE_URL=https://rxxmbnlqomtfjekdrblo.supabase.co`
- `AKINAEL_TENANT_NAME=akinael`
- `GITHUB_EXECUTOR_REPO=Yufi-Web-Create/akinael-ai`
- `GITHUB_EXECUTOR_REF=main`
- `GITHUB_AGENT_WORKFLOW=akinael-agent.yml`
- `GITHUB_REPO_OWNER=Yufi-Web-Create`
- `GITHUB_REPO_OWNER_TYPE=user`
- `GITHUB_CUSTOMER_REPO_PREFIX=client`
- `OPENAI_RESPONSES_URL=https://api.openai.com/v1/responses`
- `RESEARCH_MODEL=gpt-5.6-terra`
- `GENERAL_AGENT_MODEL=gpt-5.6-terra`

## 3. Core GitHub repository settings

Repository: `Yufi-Web-Create/akinael-ai`

### Actions secrets

Settings → Secrets and variables → Actions → Secrets

- `OPENAI_API_KEY`
- `AKINAEL_GITHUB_APP_ID`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`

### Actions variable

Settings → Secrets and variables → Actions → Variables

- `AKINAEL_BOT_USER`
  - value: GitHub App bot username, e.g. `akinael-ai[bot]`

`AKINAEL_GITHUB_APP_PRIVATE_KEY` はGitHub Appから発行したPEM全文を登録する。

設定後、feature branchの `Runtime Smoke` を再実行する。
期待値:

```text
OPENAI_API_KEY                  configured
AKINAEL_GITHUB_APP_ID           configured
AKINAEL_GITHUB_APP_PRIVATE_KEY  configured
AKINAEL_BOT_USER                configured
OpenAI Responses API            pass
Central Codex Runner            ready
RUNTIME_READY=true
```

## 4. GitHub App requirements

GitHub Appは `Yufi-Web-Create` にインストールする。
新規customer repositoryの自動作成後も利用できるよう、初期運用では **All repositories** へのinstallationを推奨する。

Repository permissions:

- **Actions: Read and write** — Render WorkerからCoreの `akinael-agent.yml` を `workflow_dispatch` するために必要
- **Contents: Read and write** — customer repositoryのcheckout、branch作成、commit/pushに必要
- **Metadata: Read** — repository識別・存在確認に使用

WebhookはExecution Engineの初期構成では必須ではない。

Runtime Node側で使用:
- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`

Core Actions側で使用:
- `AKINAEL_GITHUB_APP_ID`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`

同一GitHub Appを使用する。
中央Actions workflowでは対象customer repositoryだけにscopeした短命installation tokenを発行する。

Repository bootstrap後、CoreはAppから新規repositoryへ実アクセスできることを確認してからSupabaseへ登録する。

## 5. Repository bootstrap token

現在はcustomer repositoryを個人アカウント `Yufi-Web-Create` 配下へ作成するため、Render Workerに `GITHUB_BOOTSTRAP_TOKEN` が必要。

Fine-grained personal access tokenを使用する。
必要権限:

- **Administration: Read and write** — `POST /user/repos` でprivate repositoryを作成
- **Contents: Read and write** — bundled starterを初期投入

用途は新規private repository作成と初期starter投入に限定する。
GitHub App installation tokenは作成後の通常アクセス・Actions dispatchに使用する。

将来GitHub Organizationへ移行した場合は、このbootstrap境界をGitHub App中心へ変更できる。

## 6. Render Worker environment

Service: `akinael-ai-worker`

Secretとして設定:

- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_BOOTSTRAP_TOKEN`

非Secret値は `render.yaml` に定義済み。

Workerを実際に有効化する前に、同じ環境変数を使用できるShell/preview環境で以下を実行する。

```bash
npm run readiness:worker
```

期待値:

```text
Supabase service access   pass
OpenAI Responses API      pass
GitHub App service access pass
RUNTIME_READY=true
```

## 7. First E2E

Runtime readinessが両方PASSした後、架空顧客・テストprojectで1件だけ実行する。

```text
Request
→ Production Router
→ Research
→ Direction
→ private repository bootstrap
→ Codex Build
→ repository QA
→ independent reviews
→ correction loop if needed
→ DEPLOY READY
```

E2Eではproduction domainへdeployしない。
`akinael/run-*` branchとSupabaseのworkflow/task/artifact/executor_job記録だけを検証する。

## 8. Human Gates

明示承認なしに実行しない:

- PR #7のproduction mergeがRender等の自動deployを発火させる場合のmerge
- paid Render Workerの新規作成・有効化
- production domain / DNS切替
- customer siteのproduction deploy
- billing / paid external service activation
- destructive production data operations
