-- Keep the Admin-facing project name aligned with the latest real customer request.
-- A project is the customer's active work container, so a generic onboarding name such as
-- "xxxのご相談" is not useful once the actual request has been confirmed.

create or replace function public.sync_project_name_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.project_id is not null and nullif(btrim(new.title), '') is not null then
    update public.projects
       set name = left(btrim(new.title), 120),
           updated_at = greatest(coalesce(updated_at, new.created_at), new.created_at)
     where id = new.project_id
       and tenant_id = new.tenant_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists requests_sync_project_name on public.requests;

create trigger requests_sync_project_name
after insert or update of title on public.requests
for each row
execute function public.sync_project_name_from_request();

-- Backfill existing projects so the Admin list immediately becomes understandable.
-- Use the latest request title per project and leave projects with no request untouched.
with latest_request as (
  select distinct on (r.project_id)
         r.project_id,
         r.tenant_id,
         left(btrim(r.title), 120) as title,
         r.created_at
    from public.requests r
   where r.project_id is not null
     and nullif(btrim(r.title), '') is not null
   order by r.project_id, r.created_at desc, r.id desc
)
update public.projects p
   set name = lr.title,
       updated_at = greatest(coalesce(p.updated_at, lr.created_at), lr.created_at)
  from latest_request lr
 where p.id = lr.project_id
   and p.tenant_id = lr.tenant_id
   and p.name is distinct from lr.title;
