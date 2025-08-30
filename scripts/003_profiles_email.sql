-- Add email column to profiles and update trigger to store email from auth.users
alter table public.profiles
  add column if not exists email text unique;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (new.id, 'student', null, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
