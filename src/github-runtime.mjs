import { createSign } from 'node:crypto';

const secret = (value) => String(value || '').trim();
const configured = (value, fallback) => String(value || fallback).trim();
const base64url = (value) => Buffer.from(value).toString('base64url');

export class GitHubRuntimeError extends Error {
  constructor(message, { status = 500, body = null } = {}) {
    super(message);
    this.name = 'GitHubRuntimeError';
    this.status = status;
    this.body = body;
  }
}

const createAppJwt = ({ appId, privateKey, now = Date.now() }) => {
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 540, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
};

const splitRepo = (repositoryFullName) => {
  const [owner, repo] = String(repositoryFullName || '').split('/');
  if (!owner || !repo) throw new GitHubRuntimeError('repository_full_name is invalid', { status: 400 });
  return { owner, repo };
};

export const createGitHubRuntime = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const apiBase = configured(env.GITHUB_API_URL, 'https://api.github.com').replace(/\/+$/, '');
  const staticToken = secret(env.GITHUB_WORKER_TOKEN);
  const appId = secret(env.GITHUB_APP_ID);
  const installationId = secret(env.GITHUB_APP_INSTALLATION_ID);
  const privateKey = secret(env.GITHUB_APP_PRIVATE_KEY).replace(/\\n/g, '\n');
  let installationToken = null;
  let installationTokenExpiresAt = 0;

  const getToken = async () => {
    if (staticToken) return staticToken;
    if (!appId || !installationId || !privateKey) return null;
    if (installationToken && Date.now() < installationTokenExpiresAt - 120_000) return installationToken;
    const jwt = createAppJwt({ appId, privateKey });
    const response = await fetchImpl(`${apiBase}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28'
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.token) {
      throw new GitHubRuntimeError(payload?.message || 'Could not create GitHub App installation token', { status: response.status, body: payload });
    }
    installationToken = payload.token;
    installationTokenExpiresAt = Date.parse(payload.expires_at || '') || Date.now() + 50 * 60 * 1000;
    return installationToken;
  };

  const request = async (path, { method = 'GET', body, headers = {}, tokenOverride = null } = {}) => {
    const token = tokenOverride || await getToken();
    if (!token) throw new GitHubRuntimeError('GitHub runtime credentials are not configured', { status: 503 });
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new GitHubRuntimeError(payload?.message || `GitHub API failed: ${response.status}`, { status: response.status, body: payload });
    return payload;
  };

  const dispatchAgent = async ({ repositoryFullName, ref = 'main', taskId, workflowRunId, prompt, branchName, permissionProfile = ':workspace', stage = 'execute', cycle = 0 }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const workflowFile = configured(env.GITHUB_AGENT_WORKFLOW, 'akinael-agent.yml');
    const runName = `Akinael ${taskId} ${stage} ${cycle}`;
    await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
      method: 'POST',
      body: {
        ref,
        inputs: {
          task_id: String(taskId),
          workflow_run_id: String(workflowRunId),
          branch_name: String(branchName),
          permission_profile: String(permissionProfile),
          stage: String(stage),
          cycle: String(cycle),
          run_name: runName,
          prompt: String(prompt).slice(0, 55_000)
        }
      }
    });
    return { workflowFile, runName };
  };

  const findDispatchedRun = async ({ repositoryFullName, workflowFile = 'akinael-agent.yml', runName }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const payload = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?event=workflow_dispatch&per_page=50`);
    const run = (payload?.workflow_runs || []).find((item) => item.display_title === runName);
    return run || null;
  };

  const getRun = async ({ repositoryFullName, runId }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}`);
  };

  const getFileText = async ({ repositoryFullName, path, ref }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    try {
      const payload = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
      if (!payload?.content) return null;
      return Buffer.from(String(payload.content).replace(/\n/g, ''), payload.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
    } catch (error) {
      if (error instanceof GitHubRuntimeError && error.status === 404) return null;
      throw error;
    }
  };

  const createFromTemplate = async ({ templateRepository, owner, name, description = '' }) => {
    const [templateOwner, templateRepo] = String(templateRepository || '').split('/');
    if (!templateOwner || !templateRepo) throw new GitHubRuntimeError('GITHUB_TEMPLATE_REPO is not configured', { status: 503 });
    return request(`/repos/${encodeURIComponent(templateOwner)}/${encodeURIComponent(templateRepo)}/generate`, {
      method: 'POST',
      body: { owner, name, description, include_all_branches: false, private: true }
    });
  };

  return {
    mode: staticToken || (appId && installationId && privateKey) ? 'connected' : 'not_configured',
    getToken,
    request,
    dispatchAgent,
    findDispatchedRun,
    getRun,
    getFileText,
    createFromTemplate
  };
};

export { createAppJwt };
