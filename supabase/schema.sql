create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  user_name text not null,
  username text not null,
  subject text not null,
  test_id integer not null,
  test_title text not null,
  score numeric not null,
  total integer not null,
  percent integer not null,
  answered integer not null,
  warnings integer not null,
  elapsed_seconds integer not null,
  submitted_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.test_attempts enable row level security;

revoke all on public.app_users from anon, authenticated;
revoke all on public.test_attempts from anon, authenticated;

insert into public.app_users (name, username, password_hash, role)
values ('Parent Admin', 'admin', extensions.crypt('CHANGE_THIS_ADMIN_PASSWORD', extensions.gen_salt('bf')), 'admin')
on conflict (username) do update
set password_hash = excluded.password_hash,
    role = 'admin';

create or replace function public.login_user(p_username text, p_password text)
returns table (
  id uuid,
  name text,
  username text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.username, u.role, u.created_at
  from public.app_users u
  where lower(u.username) = lower(trim(p_username))
    and u.password_hash = extensions.crypt(trim(p_password), u.password_hash);
end;
$$;

create or replace function public.create_student_user(
  p_admin_id uuid,
  p_name text,
  p_username text,
  p_password text
)
returns table (
  id uuid,
  name text,
  username text,
  role text,
  created_at timestamptz
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
    raise exception 'Only admins can create users';
  end if;

  return query
  insert into public.app_users (name, username, password_hash, role)
  values (trim(p_name), lower(trim(p_username)), extensions.crypt(trim(p_password), extensions.gen_salt('bf')), 'student')
  returning app_users.id, app_users.name, app_users.username, app_users.role, app_users.created_at;
end;
$$;

create or replace function public.list_app_users(p_admin_id uuid)
returns table (
  id uuid,
  name text,
  username text,
  role text,
  created_at timestamptz
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
    raise exception 'Only admins can list users';
  end if;

  return query
  select u.id, u.name, u.username, u.role, u.created_at
  from public.app_users u
  order by u.created_at asc;
end;
$$;

create or replace function public.reset_student_password(
  p_admin_id uuid,
  p_student_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users
    where app_users.id = p_admin_id and app_users.role = 'admin'
  ) then
    raise exception 'Only admins can reset passwords';
  end if;

  update public.app_users
  set password_hash = extensions.crypt(trim(p_password), extensions.gen_salt('bf'))
  where id = p_student_id and role = 'student';

  if not found then
    raise exception 'Student not found';
  end if;
end;
$$;

create or replace function public.delete_student_user(
  p_admin_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users
    where app_users.id = p_admin_id and app_users.role = 'admin'
  ) then
    raise exception 'Only admins can delete users';
  end if;

  delete from public.app_users
  where id = p_student_id and role = 'student';

  if not found then
    raise exception 'Student not found';
  end if;
end;
$$;

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
  p_elapsed_seconds integer
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
    total, percent, answered, warnings, elapsed_seconds
  )
  values (
    p_user_id, p_user_name, p_username, p_subject, p_test_id, p_test_title, p_score,
    p_total, p_percent, p_answered, p_warnings, p_elapsed_seconds
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
         a.elapsed_seconds, a.submitted_at
  from public.test_attempts a
  order by a.submitted_at desc;
end;
$$;

grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.create_student_user(uuid, text, text, text) to anon, authenticated;
grant execute on function public.list_app_users(uuid) to anon, authenticated;
grant execute on function public.reset_student_password(uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_student_user(uuid, uuid) to anon, authenticated;
grant execute on function public.record_attempt(uuid, text, text, text, integer, text, numeric, integer, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.list_attempts(uuid) to anon, authenticated;
