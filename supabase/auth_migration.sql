-- Ñam Ñam - migración de usuarios y roles
-- Ejecutar UNA VEZ en Supabase > SQL Editor, después del schema.sql original.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

-- Crea automáticamente el perfil cuando alguien se registra con email/contraseña.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email,''), 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

-- Crea perfiles para usuarios que ya existían antes de esta migración.
insert into public.profiles (id, email, role, created_at)
select id, coalesce(email,''), 'user', created_at
from auth.users
on conflict (id) do update set email = excluded.email;

-- Función segura para comprobar rol administrador desde políticas RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Los perfiles se crean mediante trigger. El cliente no puede cambiar su propio rol.
-- Para hacer administrador a una cuenta, usar SQL Editor:
-- update public.profiles set role='admin' where email='TU_EMAIL_ADMIN';
