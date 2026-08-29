import { createSupabaseAdmin } from './supabase-admin.mjs';
import { planProductionPipeline } from './production-pipelines.mjs';

const first = (value) => Array.isArray(value) ? value[0] || null : value || null;
const workflowSelect = 'id,tenant_id,project_id,request_id,pipeline,status,current_phase,model,metadata,started_at,completed_at,created_at,updated_at';
const taskSelect = 'id,tenant_id,project_id,workflow_run_id,task_key,agent_role,title,status,depends_on,phase,sequence,mode,metadata,result,created_at,updated_at';

export class ProductionRouterError extends Error {
  constructor(message, code = 'production_router_error') {
    super(message);
    this.name = 'ProductionRouterError';
    this.code = code;
  }
}

export const createProductionRouter = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });

  const route = async (request) => {
    if (!request?.id || !request?.project_id || !request?.tenant_id) {
      throw new ProductionRouterError('request identity is incomplete', 'invalid_request');
    }

    const plan = planProductionPipeline(request);
    const routed = first(await admin.request('/rest/v1/rpc/start_request_workflow', {
      method: 'POST',
      body: {
        p_request_id: request.id,
        p_pipeline: plan.pipeline,
        p_initial_phase: plan.initialPhase,
        p_tasks: plan.tasks,
        p_metadata: plan.metadata
      }
    }));

    if (!routed?.workflow_run_id) {
      throw new ProductionRouterError('workflow could not be started', 'workflow_start_failed');
    }

    const workflow = first(await admin.request('/rest/v1/workflow_runs', {
      query: `id=eq.${encodeURIComponent(routed.workflow_run_id)}&select=${workflowSelect}&limit=1`
    }));
    if (!workflow) {
      throw new ProductionRouterError('workflow could not be loaded', 'workflow_load_failed');
    }

    const tasks = await admin.request('/rest/v1/tasks', {
      query: `workflow_run_id=eq.${encodeURIComponent(workflow.id)}&select=${taskSelect}&order=sequence.asc`
    });

    return {
      created: Boolean(routed.created),
      workflow,
      tasks: Array.isArray(tasks) ? tasks : [],
      plan: {
        requestType: plan.requestType,
        pipeline: plan.pipeline,
        initialPhase: plan.initialPhase,
        dynamicExpansion: Boolean(plan.metadata.dynamic_expansion)
      }
    };
  };

  return { route };
};
