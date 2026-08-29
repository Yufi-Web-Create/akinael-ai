create table if not exists public.executor_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  executor text not null,
  status text not null default 'pending' check (status in ('pending','dispatched','running','succeeded','failed','cancelled')),
  external_reference text,
  external_url text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  last_error text,
  next_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.executor_jobs enable row level security;

create policy executor_jobs_select on public.executor_jobs for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select private.current_role()) = 'admin'
    or exists (
      select 1 from public.projects p
      where p.id = executor_jobs.project_id
        and private.is_customer_member(p.customer_id)
    )
  )
);

grant select on public.executor_jobs to authenticated;

create index if not exists executor_jobs_status_next_check_idx on public.executor_jobs(status, next_check_at);
create index if not exists executor_jobs_workflow_run_idx on public.executor_jobs(workflow_run_id);
create index if not exists executor_jobs_tenant_idx on public.executor_jobs(tenant_id);

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
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'task not found'; end if;

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
    next_check_at = excluded.next_check_at,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.upsert_executor_job(uuid,text,text,text,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_executor_job(uuid,text,text,text,text,jsonb,timestamptz) to service_role;
