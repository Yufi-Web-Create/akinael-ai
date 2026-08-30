alter table public.tasks
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists claimed_by text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error text;

alter table public.workflow_runs
  add column if not exists last_error text;

create or replace function public.claim_next_workflow_task(p_worker_id text)
returns table (task_id uuid, workflow_run_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_run_id uuid;
  v_phase text;
begin
  select t.id, t.workflow_run_id, t.phase
    into v_task_id, v_run_id, v_phase
  from public.tasks t
  join public.workflow_runs wr on wr.id = t.workflow_run_id
  where t.status = 'queued'
    and wr.status in ('queued', 'running')
  order by t.created_at asc, t.sequence asc
  for update of t skip locked
  limit 1;

  if v_task_id is null then return; end if;

  update public.tasks
  set status = 'running',
      attempts = attempts + 1,
      claimed_by = p_worker_id,
      started_at = now(),
      last_error = null,
      updated_at = now()
  where id = v_task_id;

  update public.workflow_runs
  set status = 'running',
      current_phase = v_phase,
      started_at = coalesce(started_at, now()),
      last_error = null,
      updated_at = now()
  where id = v_run_id;

  return query select v_task_id, v_run_id;
end;
$$;

create or replace function public.finish_workflow_task(
  p_task_id uuid,
  p_success boolean,
  p_result jsonb default null,
  p_error text default null
)
returns table (task_status text, workflow_status text, needs_expansion boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_workflow public.workflow_runs%rowtype;
  v_next public.tasks%rowtype;
  v_needs_expansion boolean := false;
  v_final_status text;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'task not found'; end if;

  select * into v_workflow from public.workflow_runs where id = v_task.workflow_run_id for update;
  if v_task.status <> 'running' then raise exception 'task is not running'; end if;

  if not p_success then
    if v_task.attempts < v_task.max_attempts then
      update public.tasks
      set status = 'queued', result = p_result,
          last_error = left(coalesce(p_error, 'task execution failed'), 4000),
          claimed_by = null, updated_at = now()
      where id = p_task_id;

      update public.workflow_runs
      set status = 'running',
          last_error = left(coalesce(p_error, 'task execution failed'), 4000),
          updated_at = now()
      where id = v_task.workflow_run_id;

      return query select 'queued'::text, 'running'::text, false;
      return;
    end if;

    update public.tasks
    set status = 'failed', result = p_result,
        last_error = left(coalesce(p_error, 'task execution failed'), 4000),
        claimed_by = null, completed_at = now(), updated_at = now()
    where id = p_task_id;

    update public.workflow_runs
    set status = 'failed',
        last_error = left(coalesce(p_error, 'task execution failed'), 4000),
        updated_at = now()
    where id = v_task.workflow_run_id;

    update public.requests
    set metadata = metadata || jsonb_build_object(
          'execution_failure', jsonb_build_object(
            'task_id', p_task_id,
            'error', left(coalesce(p_error, 'task execution failed'), 1000),
            'at', now()
          )
        ),
        updated_at = now()
    where id = v_workflow.request_id;

    return query select 'failed'::text, 'failed'::text, false;
    return;
  end if;

  update public.tasks
  set status = 'completed', result = coalesce(p_result, '{}'::jsonb),
      last_error = null, claimed_by = null, completed_at = now(), updated_at = now()
  where id = p_task_id;

  update public.tasks target
  set status = 'queued', updated_at = now()
  where target.workflow_run_id = v_task.workflow_run_id
    and target.status = 'blocked'
    and not exists (
      select 1
      from jsonb_array_elements_text(target.depends_on) dep(task_key)
      left join public.tasks prereq
        on prereq.workflow_run_id = target.workflow_run_id
       and prereq.task_key = dep.task_key
      where prereq.id is null or prereq.status <> 'completed'
    );

  select * into v_next
  from public.tasks
  where workflow_run_id = v_task.workflow_run_id
    and status in ('queued', 'running', 'blocked')
  order by sequence asc, created_at asc
  limit 1;

  if v_next.id is not null then
    update public.workflow_runs
    set status = 'running', current_phase = v_next.phase, updated_at = now()
    where id = v_task.workflow_run_id;
    return query select 'completed'::text, 'running'::text, false;
    return;
  end if;

  v_needs_expansion := coalesce((v_workflow.metadata->>'dynamic_expansion')::boolean, false);
  if v_needs_expansion then
    update public.workflow_runs
    set status = 'running', current_phase = 'expansion_pending', updated_at = now()
    where id = v_task.workflow_run_id;
    return query select 'completed'::text, 'running'::text, true;
    return;
  end if;

  if v_workflow.metadata->>'autonomous_until' = 'deploy_ready' then
    v_final_status := 'deploy_ready';
    update public.requests set status = 'deploy_ready', updated_at = now() where id = v_workflow.request_id;
    update public.projects set status = 'deploy_ready', updated_at = now()
      where id = v_workflow.project_id and status <> 'published';
  else
    v_final_status := 'completed';
    update public.requests set status = 'completed', updated_at = now() where id = v_workflow.request_id;
  end if;

  update public.workflow_runs
  set status = v_final_status,
      current_phase = case when v_final_status = 'deploy_ready' then 'release' else 'completed' end,
      completed_at = now(), updated_at = now()
  where id = v_task.workflow_run_id;

  return query select 'completed'::text, v_final_status, false;
end;
$$;

create or replace function public.append_workflow_tasks(
  p_workflow_run_id uuid,
  p_tasks jsonb,
  p_new_phase text,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow public.workflow_runs%rowtype;
  v_task jsonb;
  v_count integer := 0;
  v_base_sequence integer;
begin
  select * into v_workflow from public.workflow_runs where id = p_workflow_run_id for update;
  if not found then raise exception 'workflow not found'; end if;
  if v_workflow.status not in ('queued','running') then raise exception 'workflow is not expandable'; end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) = 0 then
    raise exception 'tasks are required';
  end if;

  select coalesce(max(sequence), 0) into v_base_sequence
  from public.tasks where workflow_run_id = p_workflow_run_id;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    insert into public.tasks (
      tenant_id, project_id, workflow_run_id, task_key, agent_role, title, status,
      depends_on, phase, sequence, mode, metadata
    ) values (
      v_workflow.tenant_id, v_workflow.project_id, p_workflow_run_id,
      v_task->>'task_key', v_task->>'agent_role', v_task->>'title', 'blocked',
      coalesce(v_task->'depends_on', '[]'::jsonb), v_task->>'phase',
      v_base_sequence + coalesce((v_task->>'sequence')::integer, v_count + 1),
      coalesce(nullif(v_task->>'mode', ''), 'execute'),
      coalesce(v_task->'metadata', '{}'::jsonb)
    ) on conflict (workflow_run_id, task_key)
      where workflow_run_id is not null and task_key is not null do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  update public.tasks target
  set status = 'queued', updated_at = now()
  where target.workflow_run_id = p_workflow_run_id
    and target.status = 'blocked'
    and not exists (
      select 1
      from jsonb_array_elements_text(target.depends_on) dep(task_key)
      left join public.tasks prereq
        on prereq.workflow_run_id = target.workflow_run_id
       and prereq.task_key = dep.task_key
      where prereq.id is null or prereq.status <> 'completed'
    );

  update public.workflow_runs
  set current_phase = p_new_phase,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('dynamic_expansion', false),
      updated_at = now()
  where id = p_workflow_run_id;

  return v_count;
end;
$$;

revoke all on function public.claim_next_workflow_task(text) from public, anon, authenticated;
revoke all on function public.finish_workflow_task(uuid,boolean,jsonb,text) from public, anon, authenticated;
revoke all on function public.append_workflow_tasks(uuid,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.claim_next_workflow_task(text) to service_role;
grant execute on function public.finish_workflow_task(uuid,boolean,jsonb,text) to service_role;
grant execute on function public.append_workflow_tasks(uuid,jsonb,text,jsonb) to service_role;
