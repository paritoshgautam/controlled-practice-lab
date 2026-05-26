alter table public.test_attempts
add column if not exists details jsonb not null default '[]'::jsonb;

drop function if exists public.record_attempt(uuid, text, text, text, integer, text, numeric, integer, integer, integer, integer, integer);
drop function if exists public.record_attempt(uuid, text, text, text, integer, text, numeric, integer, integer, integer, integer, integer, jsonb);
drop function if exists public.list_attempts(uuid);

create or replace function public.record_attempt(
  p_user_id uuid,
  p_user_name text,
  p_username text,
  p_subject text,
  p_test_id integer,
  p_test_title text,
  p_score numeric,
  p_total integer,
  p_percent integer,
  p_answered integer,
  p_warnings integer,
  p_elapsed_seconds integer,
  p_details jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.test_attempts (
    user_id, user_name, username, subject, test_id, test_title, score,
    total, percent, answered, warnings, elapsed_seconds, details
  )
  values (
    p_user_id, p_user_name, p_username, p_subject, p_test_id, p_test_title, p_score,
    p_total, p_percent, p_answered, p_warnings, p_elapsed_seconds, coalesce(p_details, '[]'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.list_attempts(p_admin_id uuid)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  username text,
  subject text,
  test_id integer,
  test_title text,
  score numeric,
  total integer,
  percent integer,
  answered integer,
  warnings integer,
  elapsed_seconds integer,
  details jsonb,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users
    where app_users.id = p_admin_id and app_users.role = 'admin'
  ) then
    raise exception 'Only admins can list attempts';
  end if;

  return query
  select a.id, a.user_id, a.user_name, a.username, a.subject, a.test_id,
         a.test_title, a.score, a.total, a.percent, a.answered, a.warnings,
         a.elapsed_seconds, a.details, a.submitted_at
  from public.test_attempts a
  order by a.submitted_at desc;
end;
$$;

grant execute on function public.record_attempt(uuid, text, text, text, integer, text, numeric, integer, integer, integer, integer, integer, jsonb) to anon, authenticated;
grant execute on function public.list_attempts(uuid) to anon, authenticated;
