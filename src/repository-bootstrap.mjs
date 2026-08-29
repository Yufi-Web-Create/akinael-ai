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

  const templateRepository = clean(env.GITHUB_TEMPLATE_REPO);
  const owner = clean(env.GITHUB_REPO_OWNER);
  if (!templateRepository) throw new Error('GITHUB_TEMPLATE_REPO is not configured');
  if (!owner) throw new Error('GITHUB_REPO_OWNER is not configured');

  const name = repositoryNameForProject(context.project, { prefix: env.GITHUB_CUSTOMER_REPO_PREFIX || 'client' });
  const description = `Akinael AI customer project: ${clean(context.project?.name) || context.project?.id}`.slice(0, 300);
  const created = await github.createFromTemplate({ templateRepository, owner, name, description });
  if (!created?.full_name) throw new Error('GitHub repository bootstrap returned no repository name');

  const repository = await store.registerRepository({
    tenantId: context.workflow.tenant_id,
    projectId: context.workflow.project_id,
    repositoryFullName: created.full_name,
    defaultBranch: created.default_branch || 'main'
  });
  if (!repository?.repository_full_name) throw new Error('created repository could not be registered');
  return repository;
};
