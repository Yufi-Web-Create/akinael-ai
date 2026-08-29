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
  const bootstrapToken = secret(env.GITHUB_BOOTSTRAP_TOKEN || env.GITHUB_WORKER_TOKEN);
  const appId = secret(env.GITHUB_APP_ID);
  const installationId = secret(env.GITHUB_APP_INSTALLATION_ID);
  const privateKey = secret(env.GITHUB_APP_PRIVATE_KEY).replace(/\\n/g, '\n');
  const executorRepository = configured(env.GITHUB_EXECUTOR_REPO, 'Yufi-Web-Create/akinael-ai');
  const executorRef = configured(env.GITHUB_EXECUTOR_REF, 'main');
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
    const target = splitRepo(repositoryFullName);
    const executor = splitRepo(executorRepository);
    const workflowFile = configured(env.GITHUB_AGENT_WORKFLOW, 'akinael-agent.yml');
    const runName = `Akinael ${taskId} ${stage} ${cycle}`;
    await request(`/repos/${encodeURIComponent(executor.owner)}/${encodeURIComponent(executor.repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
      method: 'POST',
      body: {
        ref: executorRef,
        inputs: {
          task_id: String(taskId),
          workflow_run_id: String(workflowRunId),
          target_repository: String(repositoryFullName),
          target_owner: target.owner,
          target_repo: target.repo,
          target_default_branch: String(ref || 'main'),
          branch_name: String(branchName),
          permission_profile: String(permissionProfile),
          stage: String(stage),
          cycle: String(cycle),
          run_name: runName,
          prompt: String(prompt).slice(0, 55_000)
        }
      }
    });
    return { workflowFile, runName, executorRepository, executorRef };
  };

  const findDispatchedRun = async ({ workflowFile = 'akinael-agent.yml', runName, executorRepository: overrideRepository = null }) => {
    const executor = splitRepo(overrideRepository || executorRepository);
    const payload = await request(`/repos/${encodeURIComponent(executor.owner)}/${encodeURIComponent(executor.repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?event=workflow_dispatch&per_page=50`);
    const run = (payload?.workflow_runs || []).find((item) => item.display_title === runName);
    return run || null;
  };

  const getRun = async ({ repositoryFullName = executorRepository, runId }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}`);
  };

  const getBranchHead = async ({ repositoryFullName, branchName }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const refPath = ['heads', ...String(branchName || '').split('/').filter(Boolean)].map(encodeURIComponent).join('/');
    const payload = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/${refPath}`);
    return payload?.object?.sha || null;
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
    if (!templateOwner || !templateRepo) throw new GitHubRuntimeError('template repository is invalid', { status: 503 });
    return request(`/repos/${encodeURIComponent(templateOwner)}/${encodeURIComponent(templateRepo)}/generate`, {
      method: 'POST',
      body: { owner, name, description, include_all_branches: false, private: true }
    });
  };

  const createPrivateRepository = async ({ owner, ownerType = 'user', name, description = '' }) => {
    const type = String(ownerType || 'user').toLowerCase();
    if (!['user', 'org'].includes(type)) throw new GitHubRuntimeError('GITHUB_REPO_OWNER_TYPE must be user or org', { status: 500 });
    let path;
    let tokenOverride = bootstrapToken || null;
    if (type === 'user') {
      if (!bootstrapToken) {
        throw new GitHubRuntimeError('GITHUB_BOOTSTRAP_TOKEN is required to create repositories on a personal GitHub account', { status: 503 });
      }
      path = '/user/repos';
    } else {
      path = `/orgs/${encodeURIComponent(owner)}/repos`;
    }
    return request(path, {
      method: 'POST',
      tokenOverride,
      body: {
        name,
        description,
        private: true,
        auto_init: true,
        has_issues: true,
        has_projects: false,
        has_wiki: false
      }
    });
  };

  const putRepositoryFile = async ({ repositoryFullName, path, content, branch = 'main', message = 'Initialize Akinael project' }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const tokenOverride = bootstrapToken || null;
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${String(path).split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      tokenOverride,
      body: {
        message,
        content: Buffer.from(String(content)).toString('base64'),
        branch
      }
    });
  };

  const seedRepository = async ({ repositoryFullName, files, branch = 'main' }) => {
    for (const [path, content] of Object.entries(files || {})) {
      await putRepositoryFile({ repositoryFullName, path, content, branch, message: `Initialize ${path}` });
    }
    return { repositoryFullName, branch, fileCount: Object.keys(files || {}).length };
  };

  const verifyAppRepositoryAccess = async (repositoryFullName) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const appToken = staticToken ? null : await getToken();
    await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { tokenOverride: appToken });
    return true;
  };

  return {
    mode: staticToken || (appId && installationId && privateKey) ? 'connected' : 'not_configured',
    executorRepository,
    executorRef,
    getToken,
    request,
    dispatchAgent,
    findDispatchedRun,
    getRun,
    getBranchHead,
    getFileText,
    createFromTemplate,
    createPrivateRepository,
    putRepositoryFile,
    seedRepository,
    verifyAppRepositoryAccess
  };
};

export { createAppJwt };
