-- Queue functions intentionally remain SECURITY INVOKER. The production worker
-- therefore needs only the table privileges exercised by those functions and
-- by the GitHub executor state machine.
grant select, insert, update on table
  public.tasks,
  public.workflow_runs,
  public.requests,
  public.projects,
  public.artifacts,
  public.messages,
  public.repositories,
  public.executor_jobs,
  public.quality_checks
to service_role;
