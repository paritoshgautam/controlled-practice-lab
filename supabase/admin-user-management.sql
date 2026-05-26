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

grant execute on function public.reset_student_password(uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_student_user(uuid, uuid) to anon, authenticated;
