-- Retroactive source-control record.
-- This grant was already applied to production as Supabase migration
-- version 20260904004834 before this file was recorded in git.
-- Admin overview/project-detail reads these tables via service_role.

grant select on table
  public.notifications,
  public.payments,
  public.deployments,
  public.audit_logs
to service_role;
