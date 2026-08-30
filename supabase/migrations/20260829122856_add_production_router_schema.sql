alter table public.requests
  add column if not exists pipeline text,
  add column if not exists routed_at timestamptz;

alter table public.workflow_runs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.tasks
  add column if not exists task_key text,
  add column if not exists phase text,
  add column if not exists sequence integer not null default 0,
  add column if not exists mode text not null default 'execute',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists workflow_runs_request_unique_idx
  on public.workflow_runs (request_id)
  where request_id is not null;

create unique index if not exists tasks_workflow_task_key_unique_idx
  on public.tasks (workflow_run_id, task_key)
  where workflow_run_id is not null and task_key is not null;

create index if not exists workflow_runs_status_created_at_idx
  on public.workflow_runs (status, created_at asc);

create index if not exists tasks_status_sequence_idx
  on public.tasks (status, sequence asc, created_at asc);

create or replace function public.start_request_workflow(
  p_request_id uuid,
  p_pipeline text,
  p_initial_phase text,
  p_tasks jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  workflow_run_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.requests%rowtype;
  v_existing uuid;
  v_run_id uuid;
  v_task jsonb;
  v_index integer := 0;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request not found'; end if;
  if v_request.status in ('completed', 'cancelled') then raise exception 'request is not routable'; end if;

  select wr.id into v_existing
  from public.workflow_runs wr
  where wr.request_id = p_request_id
  limit 1;

  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) = 0 then
    raise exception 'workflow tasks are required';
  end if;

  insert into public.workflow_runs (
    tenant_id, project_id, request_id, pipeline, status, current_phase, metadata
  ) values (
    v_request.tenant_id, v_request.project_id, v_request.id, p_pipeline, 'queued', p_initial_phase,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_run_id;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    insert into public.tasks (
      tenant_id, project_id, workflow_run_id, task_key, agent_role, title, status,
      depends_on, phase, sequence, mode, metadata
    ) values (
      v_request.tenant_id,
      v_request.project_id,
      v_run_id,
      v_task->>'task_key',
      v_task->>'agent_role',
      v_task->>'title',
      case when v_index = 0 then 'queued' else 'blocked' end,
      coalesce(v_task->'depends_on', '[]'::jsonb),
      v_task->>'phase',
      coalesce((v_task->>'sequence')::integer, v_index + 1),
      coalesce(nullif(v_task->>'mode', ''), 'execute'),
      coalesce(v_task->'metadata', '{}'::jsonb)
    );
    v_index := v_index + 1;
  end loop;

  update public.requests
  set status = 'in_progress',
      pipeline = p_pipeline,
      routed_at = now(),
      metadata = metadata || jsonb_build_object('routing', coalesce(p_metadata, '{}'::jsonb)),
      updated_at = now()
  where id = p_request_id;

  return query select v_run_id, true;
end;
$$;

revoke all on function public.start_request_workflow(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.start_request_workflow(uuid,text,text,jsonb,jsonb) to service_role;
