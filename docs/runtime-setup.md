# アキナエルAI Runtime Setup

この文書は、Execution Engineを実環境で初回E2E実行するための資格情報配置を定義する。
Secret値そのものはrepositoryへ保存しない。

## 1. Runtime boundary

```text
Render Worker
├─ Supabase service access
├─ OpenAI Responses API
├─ GitHub App API / workflow dispatch
└─ new-web repository bootstrap → akinael-ai-clients

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
- `GITHUB_APP_ID=4762113`
- `AKINAEL_BOT_USER=akinael-ai-runtime-yufi[bot]`
- `GITHUB_REPO_OWNER=akinael-ai-clients`
- `GITHUB_REPO_OWNER_TYPE=org`
- `GITHUB_CUSTOMER_REPO_PREFIX=client`
- `OPENAI_RESPONSES_URL=https://api.openai.com/v1/responses`
- `RESEARCH_MODEL=gpt-5.6-terra`
- `GENERAL_AGENT_MODEL=gpt-5.6-terra`

## 3. Core GitHub repository settings

Repository: `Yufi-Web-Create/akinael-ai`

### Actions secrets

Settings → Secrets and variables → Actions → Secrets

必要なのは2つだけ。

- `OPENAI_API_KEY`
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`

GitHub App ID `4762113` とbot user `akinael-ai-runtime-yufi[bot]` は非Secretのためworkflowへ固定済み。
`AKINAEL_GITHUB_APP_PRIVATE_KEY` はGitHub Appから発行したPEM全文を登録する。

## 4. GitHub App installations and permissions

同一GitHub Appを2か所へインストールする。

### `Yufi-Web-Create`

- repository access: `akinael-ai` のみ
- 中央workflow dispatchとCore repository参照に使用

### `akinael-ai-clients`

- repository access: All repositories
- customer private repositoryの自動作成・初期投入・通常アクセスに使用

Repository permissions:

- **Actions: Read and write** — Render WorkerからCoreの `akinael-agent.yml` を `workflow_dispatch` するために必要
- **Administration: Read and write** — `akinael-ai-clients` 配下へprivate repositoryを自動作成するために必要
- **Contents: Read and write** — customer repositoryのstarter投入、checkout、branch作成、commit/pushに必要
- **Metadata: Read** — GitHubにより暗黙に付与され、repository識別・存在確認に使用

Webhookは使用しない。

Runtime Node側で使用:
- `GITHUB_APP_ID=4762113`（非Secret、blueprint固定済み）
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_INSTALLATION_ID` は不要。`GITHUB_EXECUTOR_REPO` から自動検出する。

Core Actions側で使用:
- App IDはworkflow固定済み
- `AKINAEL_GITHUB_APP_PRIVATE_KEY`

中央Actions workflowでは対象customer repositoryだけにscopeした短命installation tokenを発行する。
Repository bootstrap時はcustomer OrganizationのinstallationをAPIで自動検出する。

## 5. Repository bootstrap

Productionではcustomer repositoryを `akinael-ai-clients` 配下へ作成する。
GitHub App installation tokenで作成するため、`GITHUB_BOOTSTRAP_TOKEN` / personal access tokenは不要。

```text
web_new request
→ first Build
→ resolve akinael-ai-clients App installation
→ create private repository
→ seed bundled Next.js starter
→ verify App access
→ register repository in Supabase
→ dispatch central Codex runner
```

`GITHUB_BOOTSTRAP_TOKEN` はpersonal-account運用へ戻す場合だけのlegacy fallbackとして残す。

## 6. Central Runtime Smoke

2026-08-30、feature branchの実資格情報を使用してlive smokeを実行し、以下をすべて確認済み。
Secretやinstallation tokenの値はログへ出力しない。

```text
OPENAI_API_KEY                    configured
AKINAEL_GITHUB_APP_ID             configured
AKINAEL_GITHUB_APP_PRIVATE_KEY    configured
AKINAEL_BOT_USER                  configured
OpenAI Responses API              pass (gpt-5.6-terra)
Core GitHub App access            pass
Customer Organization App access  pass
Central Codex Runner              ready
RUNTIME_READY=true
```

同一headのCore QualityもPASS済み。

## 7. Render Worker environment

Service: `akinael-ai-worker`

Workerが新しく必要とするSecretは1つだけ。

- `GITHUB_APP_PRIVATE_KEY`

`SUPABASE_SECRET_KEY` は既存Webサービス `akinael-ai` の同名環境変数を `fromService` で参照する。
`OPENAI_API_KEY` は既存Webサービスの `LLM_API_KEY` を `fromService` で参照する。
このため、Supabase/OpenAIのSecretをRenderへ重複登録しない。

`GITHUB_APP_ID=4762113`、Supabase URL、customer Organization名などの非Secret値は `render.yaml` に定義済み。
Installation IDは自動検出するため不要。
`GITHUB_TEMPLATE_REPO` はProductionでは未設定とし、Core内蔵starterを使用する。

Worker上で以下を実行すると、Supabase / OpenAI / Core GitHub App / Customer Organization Appの実疎通を確認する。

```bash
npm run readiness:worker
```

期待値:

```text
Supabase service access           pass
OpenAI Responses API              pass
GitHub App service access         pass
Customer Organization App access pass
RUNTIME_READY=true
```

## 8. First E2E

Runtime readinessが両方PASSした後、架空顧客・テストprojectで1件だけ実行する。

```text
Request
→ Production Router
→ Research
→ Direction
→ private repository bootstrap in akinael-ai-clients
→ Codex Build
→ repository QA
→ independent reviews
→ correction loop if needed
→ DEPLOY READY
```

E2Eではproduction domainへdeployしない。
`akinael/run-*` branchとSupabaseのworkflow/task/artifact/executor_job記録だけを検証する。

## 9. Human Gates

明示承認なしに実行しない:

- PR #7のproduction mergeがRender等の自動deployを発火させる場合のmerge
- paid Render Workerの新規作成・有効化
- production domain / DNS切替
- customer siteのproduction deploy
- billing / paid external service activation
- destructive production data operations
