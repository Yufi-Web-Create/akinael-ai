create or replace function public.upsert_executor_job(
  p_task_id uuid,
  p_executor text,
  p_external_reference text default null,
  p_external_url text default null,
  p_status text default 'pending',
  p_payload jsonb default '{}'::jsonb,
  p_next_check_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_job_id uuid;
  v_active boolean;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'task not found'; end if;

  v_active := p_status in ('pending','dispatched','running');

  insert into public.executor_jobs (
    tenant_id, project_id, workflow_run_id, task_id, executor, status,
    external_reference, external_url, payload, next_check_at
  ) values (
    v_task.tenant_id, v_task.project_id, v_task.workflow_run_id, v_task.id, p_executor, p_status,
    p_external_reference, p_external_url, coalesce(p_payload, '{}'::jsonb), p_next_check_at
  )
  on conflict (task_id) do update set
    executor = excluded.executor,
    status = excluded.status,
    external_reference = coalesce(excluded.external_reference, public.executor_jobs.external_reference),
    external_url = coalesce(excluded.external_url, public.executor_jobs.external_url),
    payload = public.executor_jobs.payload || excluded.payload,
    result = case when v_active then null else public.executor_jobs.result end,
    last_error = case when v_active then null else public.executor_jobs.last_error end,
    next_check_at = excluded.next_check_at,
    completed_at = case when v_active then null else public.executor_jobs.completed_at end,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.upsert_executor_job(uuid,text,text,text,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_executor_job(uuid,text,text,text,text,jsonb,timestamptz) to service_role;
