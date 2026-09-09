-- PHASE 6 production E2E (request 746feb20-b98b-42ce-bc44-47218402534e, approval
-- aa5c4245-fb07-4a27-a0aa-71b7f92b94aa) surfaced that service_role can INSERT into
-- approvals but not into notifications or audit_logs, so a customer delivery approval
-- is recorded durably while its notification and audit evidence silently fail.
-- Existing SELECT grants (from 20260904004834) are untouched. Only the two INSERT
-- operations the Core API's createCustomerApproval path actually performs are added —
-- no UPDATE/DELETE/ALL, matching the existing approvals INSERT grant's own scoping
-- (20260903154043).

grant insert on table
  public.notifications,
  public.audit_logs
to service_role;
