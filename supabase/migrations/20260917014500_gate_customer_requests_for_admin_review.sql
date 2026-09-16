-- Customer-confirmed consultations must surface to Admin before production starts.
-- The application now routes the request only after an admin explicitly acknowledges it.
-- Keep this transition in the existing customer-only RPC so request creation and project
-- attention state are committed together.

create or replace function public.create_customer_request(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_priority text default 'normal'::text
)
returns table(request_id uuid, message_id uuid)
language plpgsql
set search_path to ''
as $function$
declare
  v_request_id uuid;
  v_message_id uuid;
begin
  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.tenant_id = p_tenant_id
      and p.customer_id = p_customer_id
  ) then
    raise exception 'project does not belong to customer';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    join public.customer_members cm
      on cm.tenant_id = up.tenant_id
     and cm.user_id = up.id
     and cm.customer_id = p_customer_id
    where up.id = p_user_id
      and up.tenant_id = p_tenant_id
      and up.role = 'customer'
  ) then
    raise exception 'user is not a member of customer';
  end if;

  insert into public.requests (
    tenant_id, customer_id, project_id, created_by, type, title, body, status, priority, metadata
  ) values (
    p_tenant_id, p_customer_id, p_project_id, p_user_id, p_type, p_title, p_body,
    'waiting_approval', p_priority,
    jsonb_build_object('intake_gate', 'awaiting_admin_approval')
  ) returning id into v_request_id;

  insert into public.messages (
    tenant_id, project_id, request_id, author_user_id, author_type, content, metadata
  ) values (
    p_tenant_id, p_project_id, v_request_id, p_user_id, 'customer', p_body, '{}'::jsonb
  ) returning id into v_message_id;

  update public.projects
  set updated_at = now(),
      needs_attention = true,
      attention_reasons = case
        when 'customer_consultation_confirmed' = any(attention_reasons) then attention_reasons
        else array_append(attention_reasons, 'customer_consultation_confirmed')
      end
  where id = p_project_id
    and tenant_id = p_tenant_id;

  return query select v_request_id, v_message_id;
end;
$function$;
