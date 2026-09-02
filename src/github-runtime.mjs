import { createSign } from 'node:crypto';

const secret = (value) => String(value || '').trim();
const configured = (value, fallback) => String(value || fallback).trim();
const base64url = (value) => Buffer.from(value).toString('base64url');

const BILLING_LOG_PATTERNS = [
  /no credits remaining/i,
  /insufficient[_\s-]*quota/i,
  /billing[_\s-]*hard[_\s-]*limit/i,
  /credit balance/i,
  /billing quota/i
];

export const classifyGitHubJobFailure = (logs = '') => {
  const text = String(logs || '');
  if (BILLING_LOG_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      kind: 'billing_quota',
      terminal: true,
      message: 'OpenAI API credits or billing quota exhausted'
    };
  }
  return { kind: 'runtime', terminal: false, message: 'GitHub executor failed' };
};

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
  const configuredInstallationId = secret(env.GITHUB_APP_INSTALLATION_ID);
  const privateKey = secret(env.GITHUB_APP_PRIVATE_KEY).replace(/\\n/g, '\n');
  const executorRepository = configured(env.GITHUB_EXECUTOR_REPO, 'Yufi-Web-Create/akinael-ai');
  const executorRef = configured(env.GITHUB_EXECUTOR_REF, 'main');
  const customerOwner = secret(env.GITHUB_REPO_OWNER);
  const customerOwnerType = configured(env.GITHUB_REPO_OWNER_TYPE, 'user').toLowerCase();
  let executorInstallationId = configuredInstallationId || null;
  let installationToken = null;
  let installationTokenExpiresAt = 0;
  const ownerTokenCache = new Map();

  const ensureAppIdentity = () => {
    if (!appId || !privateKey) {
      throw new GitHubRuntimeError('GitHub App credentials are not configured', { status: 503 });
    }
  };

  const appRequest = async (path, { method = 'GET', body } = {}) => {
    ensureAppIdentity();
    const jwt = createAppJwt({ appId, privateKey });
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new GitHubRuntimeError(payload?.message || `GitHub App API failed: ${response.status}`, { status: response.status, body: payload });
    return payload;
  };

  const mintInstallationToken = async (targetInstallationId) => {
    ensureAppIdentity();
    const payload = await appRequest(`/app/installations/${encodeURIComponent(targetInstallationId)}/access_tokens`, { method: 'POST' });
    if (!payload?.token) throw new GitHubRuntimeError('Could not create GitHub App installation token', { status: 503, body: payload });
    return {
      token: payload.token,
      expiresAt: Date.parse(payload.expires_at || '') || Date.now() + 50 * 60 * 1000
    };
  };

  const resolveExecutorInstallationId = async () => {
    if (executorInstallationId) return executorInstallationId;
    ensureAppIdentity();
    const { owner, repo } = splitRepo(executorRepository);
    const installation = await appRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`);
    if (!installation?.id) {
      throw new GitHubRuntimeError(`GitHub App is not installed for executor repository ${executorRepository}`, { status: 503, body: installation });
    }
    executorInstallationId = String(installation.id);
    return executorInstallationId;
  };

  const getToken = async () => {
    if (staticToken) return staticToken;
    if (!appId || !privateKey) return null;
    if (installationToken && Date.now() < installationTokenExpiresAt - 120_000) return installationToken;
    const targetInstallationId = await resolveExecutorInstallationId();
    const minted = await mintInstallationToken(targetInstallationId);
    installationToken = minted.token;
    installationTokenExpiresAt = minted.expiresAt;
    return installationToken;
  };

  const getInstallationTokenForOwner = async ({ owner, ownerType = 'org' }) => {
    if (staticToken) return staticToken;
    ensureAppIdentity();
    const normalizedType = String(ownerType || 'org').toLowerCase();
    if (!['user', 'org'].includes(normalizedType)) throw new GitHubRuntimeError('ownerType must be user or org', { status: 500 });
    const cacheKey = `${normalizedType}:${owner}`;
    const cached = ownerTokenCache.get(cacheKey);
    if (cached?.token && Date.now() < cached.expiresAt - 120_000) return cached.token;

    const installation = await appRequest(
      normalizedType === 'org'
        ? `/orgs/${encodeURIComponent(owner)}/installation`
        : `/users/${encodeURIComponent(owner)}/installation`
    );
    if (!installation?.id) throw new GitHubRuntimeError(`GitHub App is not installed on ${owner}`, { status: 503, body: installation });
    const minted = await mintInstallationToken(installation.id);
    ownerTokenCache.set(cacheKey, minted);
    return minted.token;
  };

  const tokenForRepositoryOwner = async (owner) => {
    if (customerOwner && owner === customerOwner && customerOwnerType === 'org' && !bootstrapToken) {
      return getInstallationTokenForOwner({ owner, ownerType: 'org' });
    }
    return null;
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

  const requestText = async (path, { tokenOverride = null } = {}) => {
    const token = tokenOverride || await getToken();
    if (!token) throw new GitHubRuntimeError('GitHub runtime credentials are not configured', { status: 503 });
    const response = await fetchImpl(`${apiBase}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28'
      }
    });
    const payload = await response.text().catch(() => '');
    if (!response.ok) throw new GitHubRuntimeError(`GitHub API failed: ${response.status}`, { status: response.status });
    return payload;
  };

  const dispatchAgent = async ({ repositoryFullName, ref = 'main', taskId, workflowRunId, prompt, branchName, permissionProfile = ':workspace', taskMode = 'execute', stage = 'execute', cycle = 0, model = 'gpt-5.6-terra', effort = 'medium' }) => {
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
          task_mode: String(taskMode),
          stage: String(stage),
          cycle: String(cycle),
          model: String(model),
          effort: String(effort),
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

  const getRunFailure = async ({ repositoryFullName = executorRepository, runId }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const jobs = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=20`);
    const failedJobs = (jobs?.jobs || []).filter((job) => job.conclusion === 'failure');
    const logParts = [];
    for (const job of failedJobs.slice(0, 3)) {
      try {
        logParts.push(await requestText(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/jobs/${encodeURIComponent(job.id)}/logs`));
      } catch {}
    }
    return classifyGitHubJobFailure(logParts.join('\n'));
  };

  const getBranchHead = async ({ repositoryFullName, branchName }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const refPath = ['heads', ...String(branchName || '').split('/').filter(Boolean)].map(encodeURIComponent).join('/');
    const ownerToken = await tokenForRepositoryOwner(owner);
    const payload = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/${refPath}`, { tokenOverride: ownerToken });
    return payload?.object?.sha || null;
  };

  const getFileText = async ({ repositoryFullName, path, ref }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    try {
      const ownerToken = await tokenForRepositoryOwner(owner);
      const payload = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, { tokenOverride: ownerToken });
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
    const ownerToken = customerOwnerType === 'org' && owner === customerOwner && !bootstrapToken
      ? await getInstallationTokenForOwner({ owner, ownerType: 'org' })
      : null;
    return request(`/repos/${encodeURIComponent(templateOwner)}/${encodeURIComponent(templateRepo)}/generate`, {
      method: 'POST',
      tokenOverride: ownerToken,
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
      if (!tokenOverride) tokenOverride = await getInstallationTokenForOwner({ owner, ownerType: 'org' });
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

  const createBranch = async ({ repositoryFullName, branchName, fromBranch = 'main' }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const ownerToken = await tokenForRepositoryOwner(owner);
    const tokenOverride = bootstrapToken || ownerToken || null;
    const base = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${String(fromBranch).split('/').map(encodeURIComponent).join('/')}`, { tokenOverride });
    try {
      return await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, { method: 'POST', tokenOverride, body: { ref: `refs/heads/${branchName}`, sha: base.object.sha } });
    } catch (error) {
      if (error instanceof GitHubRuntimeError && error.status === 422) return { ref: `refs/heads/${branchName}`, object: { sha: base.object.sha } };
      throw error;
    }
  };

  const putRepositoryFile = async ({ repositoryFullName, path, content, contentBase64 = null, branch = 'main', message = 'Initialize Akinael project' }) => {
    const { owner, repo } = splitRepo(repositoryFullName);
    const ownerToken = await tokenForRepositoryOwner(owner);
    const tokenOverride = bootstrapToken || ownerToken || null;
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${String(path).split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      tokenOverride,
      body: {
        message,
        content: contentBase64 || Buffer.from(String(content)).toString('base64'),
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
    const ownerToken = await tokenForRepositoryOwner(owner);
    const appToken = ownerToken || (staticToken ? null : await getToken());
    await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { tokenOverride: appToken });
    return true;
  };

  return {
    mode: staticToken || (appId && privateKey) ? 'connected' : 'not_configured',
    executorRepository,
    executorRef,
    getToken,
    resolveExecutorInstallationId,
    getInstallationTokenForOwner,
    request,
    dispatchAgent,
    findDispatchedRun,
    getRun,
    getRunFailure,
    getBranchHead,
    getFileText,
    createFromTemplate,
    createPrivateRepository,
    putRepositoryFile,
    createBranch,
    seedRepository,
    verifyAppRepositoryAccess
  };
};

export { createAppJwt };
