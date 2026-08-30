create or replace function public.provision_customer_account(
  p_tenant_id uuid,
  p_user_id uuid,
  p_email text,
  p_display_name text default null,
  p_business_name text default null
)
returns table(
  user_id uuid,
  tenant_id uuid,
  customer_id uuid,
  role text,
  display_name text,
  customer_name text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_existing_tenant uuid;
  v_customer_id uuid;
  v_customer_name text;
  v_display_name text;
begin
  if p_user_id is null or p_tenant_id is null then
    raise exception 'user and tenant are required';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant does not exist';
  end if;

  select up.tenant_id into v_existing_tenant
  from public.user_profiles up
  where up.id = p_user_id;

  if v_existing_tenant is not null and v_existing_tenant <> p_tenant_id then
    raise exception 'user belongs to another tenant';
  end if;

  v_display_name := nullif(btrim(coalesce(p_display_name, '')), '');
  v_customer_name := coalesce(
    nullif(btrim(coalesce(p_business_name, '')), ''),
    v_display_name,
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'お客様'
  );

  insert into public.user_profiles (id, tenant_id, role, display_name)
  values (p_user_id, p_tenant_id, 'customer', v_display_name)
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
        updated_at = now();

  select cm.customer_id into v_customer_id
  from public.customer_members cm
  where cm.tenant_id = p_tenant_id
    and cm.user_id = p_user_id
  order by cm.created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (tenant_id, name)
    values (p_tenant_id, v_customer_name)
    returning id into v_customer_id;

    insert into public.customer_members (tenant_id, customer_id, user_id)
    values (p_tenant_id, v_customer_id, p_user_id);
  else
    select c.name into v_customer_name
    from public.customers c
    where c.id = v_customer_id and c.tenant_id = p_tenant_id;
  end if;

  return query
  select p_user_id, p_tenant_id, v_customer_id, 'customer'::text, v_display_name, v_customer_name;
end;
$$;

revoke all on function public.provision_customer_account(uuid, uuid, text, text, text) from public;
revoke all on function public.provision_customer_account(uuid, uuid, text, text, text) from anon;
revoke all on function public.provision_customer_account(uuid, uuid, text, text, text) from authenticated;
grant execute on function public.provision_customer_account(uuid, uuid, text, text, text) to service_role;

grant select on table
  public.tenants,
  public.user_profiles,
  public.customer_members,
  public.customers,
  public.projects,
  public.requests,
  public.messages,
  public.workflow_runs,
  public.tasks,
  public.artifacts,
  public.quality_checks
to service_role;

grant insert on table
  public.user_profiles,
  public.customer_members,
  public.customers,
  public.projects,
  public.requests,
  public.messages,
  public.workflow_runs,
  public.tasks
to service_role;

grant update on table
  public.user_profiles,
  public.requests
to service_role;

revoke all on function public.create_customer_request(uuid, uuid, uuid, uuid, text, text, text, text) from public;
revoke all on function public.create_customer_request(uuid, uuid, uuid, uuid, text, text, text, text) from anon;
revoke all on function public.create_customer_request(uuid, uuid, uuid, uuid, text, text, text, text) from authenticated;
grant execute on function public.create_customer_request(uuid, uuid, uuid, uuid, text, text, text, text) to service_role;

revoke all on function public.start_request_workflow(uuid, text, text, jsonb, jsonb) from public;
revoke all on function public.start_request_workflow(uuid, text, text, jsonb, jsonb) from anon;
revoke all on function public.start_request_workflow(uuid, text, text, jsonb, jsonb) from authenticated;
grant execute on function public.start_request_workflow(uuid, text, text, jsonb, jsonb) to service_role;
