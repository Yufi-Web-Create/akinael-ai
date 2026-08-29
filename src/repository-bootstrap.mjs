import { customerWebStarterFiles } from './customer-web-starter.mjs';

const clean = (value) => String(value || '').trim();

const slugify = (value) => clean(value)
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()
  .slice(0, 45);

export const repositoryNameForProject = (project, { prefix = 'client' } = {}) => {
  const projectSlug = slugify(project?.name) || 'project';
  const id = clean(project?.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'new';
  return `${slugify(prefix) || 'client'}-${projectSlug}-${id}`.slice(0, 100);
};

export const canBootstrapRepository = (context) => {
  if (context?.repository?.repository_full_name) return false;
  if (context?.task?.mode !== 'build') return false;
  if (context?.request?.type === 'web_new') return true;
  return context?.workflow?.metadata?.expansion_route === 'web_new';
};

export const bootstrapProjectRepository = async ({ context, github, store, env = process.env }) => {
  if (context?.repository?.repository_full_name) return context.repository;
  if (!canBootstrapRepository(context)) throw new Error('project repository is not configured');
  if (github.mode !== 'connected') throw new Error('GitHub repository bootstrap credentials are not configured');

  const owner = clean(env.GITHUB_REPO_OWNER);
  if (!owner) throw new Error('GITHUB_REPO_OWNER is not configured');

  const name = repositoryNameForProject(context.project, { prefix: env.GITHUB_CUSTOMER_REPO_PREFIX || 'client' });
  const description = `Akinael AI customer project: ${clean(context.project?.name) || context.project?.id}`.slice(0, 300);
  const templateRepository = clean(env.GITHUB_TEMPLATE_REPO);
  let created;

  if (templateRepository) {
    created = await github.createFromTemplate({ templateRepository, owner, name, description });
  } else {
    created = await github.createPrivateRepository({
      owner,
      ownerType: clean(env.GITHUB_REPO_OWNER_TYPE || 'user'),
      name,
      description
    });
    if (!created?.full_name) throw new Error('GitHub repository creation returned no repository name');
    await github.seedRepository({
      repositoryFullName: created.full_name,
      branch: created.default_branch || 'main',
      files: customerWebStarterFiles()
    });
  }

  if (!created?.full_name) throw new Error('GitHub repository bootstrap returned no repository name');

  // The central executor uses the GitHub App. Verify access before the repository is registered in business state.
  await github.verifyAppRepositoryAccess(created.full_name);

  const repository = await store.registerRepository({
    tenantId: context.workflow.tenant_id,
    projectId: context.workflow.project_id,
    repositoryFullName: created.full_name,
    defaultBranch: created.default_branch || 'main'
  });
  if (!repository?.repository_full_name) throw new Error('created repository could not be registered');
  return repository;
};
