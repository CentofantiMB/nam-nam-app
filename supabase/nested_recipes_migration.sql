-- Ñam Ñam v6 · permitir recetas como ingredientes de otras recetas
-- Ejecutar UNA VEZ en Supabase > SQL Editor antes de publicar el código v6.

-- 1) Extender recipe_ingredients sin perder los registros actuales.
alter table public.recipe_ingredients
  add column if not exists item_type text;

alter table public.recipe_ingredients
  add column if not exists child_recipe_id text;

alter table public.recipe_ingredients
  alter column food_id drop not null;

update public.recipe_ingredients
set item_type = case when child_recipe_id is not null then 'recipe' else 'food' end
where item_type is null;

alter table public.recipe_ingredients
  alter column item_type set default 'food';

alter table public.recipe_ingredients
  alter column item_type set not null;

-- 2) Clave foránea hacia la receta utilizada como ingrediente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_ingredients_child_recipe_id_fkey'
      and conrelid = 'public.recipe_ingredients'::regclass
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_child_recipe_id_fkey
      foreign key (child_recipe_id) references public.recipes(id) on delete restrict;
  end if;
end $$;

-- 3) Validaciones: cada fila apunta a alimento O receta, nunca a ambos.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_ingredients_item_type_check'
      and conrelid = 'public.recipe_ingredients'::regclass
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_item_type_check
      check (item_type in ('food','recipe'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_ingredients_target_check'
      and conrelid = 'public.recipe_ingredients'::regclass
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_target_check
      check (
        (item_type='food' and food_id is not null and child_recipe_id is null)
        or
        (item_type='recipe' and child_recipe_id is not null and food_id is null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_ingredients_no_self_reference'
      and conrelid = 'public.recipe_ingredients'::regclass
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_no_self_reference
      check (child_recipe_id is null or child_recipe_id <> recipe_id);
  end if;
end $$;

create index if not exists recipe_ingredients_child_recipe_idx
  on public.recipe_ingredients(child_recipe_id)
  where child_recipe_id is not null;

-- Realtime ya estaba habilitado para recipe_ingredients en v5, por lo que no hace falta tocarlo.
