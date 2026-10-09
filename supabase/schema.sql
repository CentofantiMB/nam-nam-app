-- Ñam Ñam - esquema de persistencia
-- Ejecutar en Supabase > SQL Editor.

create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

create policy "users_select_own_state"
on public.app_states for select
to authenticated
using (auth.uid() = user_id);

create policy "users_insert_own_state"
on public.app_states for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users_update_own_state"
on public.app_states for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Estructura reservada para el futuro módulo de entrenamiento.
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  name text not null,
  duration_minutes numeric,
  estimated_kcal numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null,
  sets integer,
  reps text,
  duration_seconds numeric,
  sort_order integer not null default 0
);

alter table public.workout_sessions enable row level security;
alter table public.workout_entries enable row level security;

create policy "users_manage_own_workouts"
on public.workout_sessions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users_manage_own_workout_entries"
on public.workout_entries for all
to authenticated
using (
  exists (
    select 1 from public.workout_sessions s
    where s.id = workout_entries.session_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workout_sessions s
    where s.id = workout_entries.session_id and s.user_id = auth.uid()
  )
);
