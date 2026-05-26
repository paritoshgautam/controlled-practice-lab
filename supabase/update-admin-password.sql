create extension if not exists pgcrypto;

update public.app_users
set password_hash = extensions.crypt('CHANGE_THIS_ADMIN_PASSWORD', extensions.gen_salt('bf')),
    role = 'admin'
where username = 'admin';

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
