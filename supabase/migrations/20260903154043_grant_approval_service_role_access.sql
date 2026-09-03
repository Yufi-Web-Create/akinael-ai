-- The Core API accesses approvals through the server-side Supabase client.
-- Keep browser roles unchanged; grant only the operations used by the API.
grant select, insert on table public.approvals to service_role;
