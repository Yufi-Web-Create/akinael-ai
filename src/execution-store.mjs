import { createSupabaseAdmin } from './supabase-admin.mjs';

const first = (value) => Array.isArray(value) ? value[0] || null : value || null;
const clampText = (value, max = 20000) => String(value ?? '').slice(0, max);

export const createExecutionStore = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });

  const claimNextTask = async (workerId) => first(await admin.request('/rest/v1/rpc/claim_next_workflow_task', {
    method: 'POST',
    body: { p_worker_id: String(workerId) }
  }));

  const getTaskContext = async (taskId) => {
    const task = first(await admin.request('/rest/v1/tasks', {
      query: `id=eq.${encodeURIComponent(taskId)}&select=*&limit=1`
    }));
    if (!task) throw new Error('task not found');

    const workflow = first(await admin.request('/rest/v1/workflow_runs', {
      query: `id=eq.${encodeURIComponent(task.workflow_run_id)}&select=*&limit=1`
    }));
    if (!workflow) throw new Error('workflow not found');

    const [requestRows, projectRows, priorTasks, artifacts, messages, repositories] = await Promise.all([
      workflow.request_id ? admin.request('/rest/v1/requests', {
        query: `id=eq.${encodeURIComponent(workflow.request_id)}&select=*&limit=1`
      }) : [],
      admin.request('/rest/v1/projects', {
        query: `id=eq.${encodeURIComponent(workflow.project_id)}&select=*&limit=1`
      }),
      admin.request('/rest/v1/tasks', {
        query: `workflow_run_id=eq.${encodeURIComponent(workflow.id)}&sequence=lt.${encodeURIComponent(task.sequence)}&select=id,task_key,agent_role,title,status,result,phase,sequence,metadata&order=sequence.asc`
      }),
      admin.request('/rest/v1/artifacts', {
        query: `workflow_run_id=eq.${encodeURIComponent(workflow.id)}&select=id,kind,title,content_text,metadata,created_at&order=created_at.asc`
      }),
      workflow.request_id ? admin.request('/rest/v1/messages', {
        query: `request_id=eq.${encodeURIComponent(workflow.request_id)}&select=id,author_type,content,metadata,created_at&order=created_at.asc`
      }) : [],
      admin.request('/rest/v1/repositories', {
        query: `project_id=eq.${encodeURIComponent(workflow.project_id)}&select=*&limit=1`
      })
    ]);

    return {
      task,
      workflow,
      request: first(requestRows),
      project: first(projectRows),
      repository: first(repositories),
      priorTasks: Array.isArray(priorTasks) ? priorTasks : [],
      artifacts: Array.isArray(artifacts) ? artifacts : [],
      messages: Array.isArray(messages) ? messages : []
    };
  };

  const saveArtifact = async ({ context, kind = 'task_output', title, contentText, metadata = {} }) => {
    const rows = await admin.request('/rest/v1/artifacts', {
      method: 'POST',
      query: 'select=id,kind,title,metadata,created_at',
      headers: { Prefer: 'return=representation' },
      body: {
        tenant_id: context.workflow.tenant_id,
        project_id: context.workflow.project_id,
        workflow_run_id: context.workflow.id,
        kind,
        title: clampText(title || context.task.title, 300),
        content_text: clampText(contentText, 120000),
        metadata
      }
    });
    return first(rows);
  };

  const finishTask = async ({ taskId, success, result = null, error = null }) => first(await admin.request('/rest/v1/rpc/finish_workflow_task', {
    method: 'POST',
    body: {
      p_task_id: taskId,
      p_success: Boolean(success),
      p_result: result,
      p_error: error ? clampText(error, 4000) : null
    }
  }));

  const appendWorkflowTasks = async ({ workflowRunId, tasks, newPhase, metadata = {} }) => admin.request('/rest/v1/rpc/append_workflow_tasks', {
    method: 'POST',
    body: {
      p_workflow_run_id: workflowRunId,
      p_tasks: tasks,
      p_new_phase: newPhase,
      p_metadata: metadata
    }
  });

  const patchTaskMetadata = async (taskId, metadata) => {
    const rows = await admin.request('/rest/v1/tasks', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(taskId)}&select=id,metadata,status,updated_at`,
      headers: { Prefer: 'return=representation' },
      body: { metadata }
    });
    return first(rows);
  };

  const stopTaskRetries = async (taskId, attempts) => {
    const rows = await admin.request('/rest/v1/tasks', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(taskId)}&status=eq.running&select=id,attempts,max_attempts,status`,
      headers: { Prefer: 'return=representation' },
      body: { max_attempts: Math.max(1, Number(attempts) || 1) }
    });
    return first(rows);
  };

  const upsertExecutorJob = async ({ taskId, status, externalReference = null, externalUrl = null, payload = {}, nextCheckAt = null }) => admin.request('/rest/v1/rpc/upsert_executor_job', {
    method: 'POST',
    body: {
      p_task_id: taskId,
      p_executor: 'github_codex',
      p_external_reference: externalReference,
      p_external_url: externalUrl,
      p_status: status,
      p_payload: payload,
      p_next_check_at: nextCheckAt
    }
  });

  const patchExecutorJob = async (taskId, patch) => {
    const rows = await admin.request('/rest/v1/executor_jobs', {
      method: 'PATCH',
      query: `task_id=eq.${encodeURIComponent(taskId)}&select=*`,
      headers: { Prefer: 'return=representation' },
      body: patch
    });
    return first(rows);
  };

  const listRunningExternalTasks = async (limit = 25) => {
    const rows = await admin.request('/rest/v1/tasks', {
      query: `status=eq.running&select=id,workflow_run_id,task_key,title,mode,metadata,attempts,max_attempts,updated_at&order=updated_at.asc&limit=${Math.max(1, Math.min(Number(limit) || 25, 100))}`
    });
    return (Array.isArray(rows) ? rows : []).filter((item) => item.metadata?.external_executor);
  };

  const getRepository = async (projectId) => first(await admin.request('/rest/v1/repositories', {
    query: `project_id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`
  }));

  const registerRepository = async ({ tenantId, projectId, repositoryFullName, defaultBranch = 'main' }) => {
    const rows = await admin.request('/rest/v1/repositories', {
      method: 'POST',
      query: 'select=*',
      headers: { Prefer: 'return=representation' },
      body: {
        tenant_id: tenantId,
        project_id: projectId,
        provider: 'github',
        repository_full_name: clampText(repositoryFullName, 255),
        default_branch: clampText(defaultBranch || 'main', 120)
      }
    });
    return first(rows);
  };

  return {
    config: admin.config,
    claimNextTask,
    getTaskContext,
    saveArtifact,
    finishTask,
    appendWorkflowTasks,
    patchTaskMetadata,
    stopTaskRetries,
    upsertExecutorJob,
    patchExecutorJob,
    listRunningExternalTasks,
    getRepository,
    registerRepository
  };
};
