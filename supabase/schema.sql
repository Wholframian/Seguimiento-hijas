-- Esquema de la app "Seguimiento de las hijas".
-- Ejecutar una vez en el SQL Editor de un proyecto de Supabase NUEVO (separado de otros proyectos).

create extension if not exists pgcrypto;

-- Una "familia" agrupa a los adultos que comparten los datos.
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  birth_date date,
  color text not null default '#e07a5f',
  created_at timestamptz not null default now()
);

-- Cada registro: toma, sueño, pañal, baño, temperatura, medicina, salud, crecimiento o nota.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('feed','sleep','diaper','bath','temperature','medicine','health','growth','note')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entries_child_time on public.entries (child_id, started_at desc);
create index entries_household_time on public.entries (household_id, started_at desc);

-- ¿El usuario actual pertenece a esta familia?
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.entries enable row level security;

create policy "ver mi familia" on public.households for select using (is_member(id));
create policy "editar mi familia" on public.households for update using (is_member(id));

create policy "ver miembros" on public.household_members for select using (is_member(household_id));
create policy "editar mi nombre" on public.household_members for update using (user_id = auth.uid());

create policy "hijas: ver" on public.children for select using (is_member(household_id));
create policy "hijas: crear" on public.children for insert with check (is_member(household_id));
create policy "hijas: editar" on public.children for update using (is_member(household_id));
create policy "hijas: borrar" on public.children for delete using (is_member(household_id));

create policy "registros: ver" on public.entries for select using (is_member(household_id));
create policy "registros: crear" on public.entries for insert with check (
  is_member(household_id)
  and exists (select 1 from children c where c.id = child_id and c.household_id = entries.household_id)
);
create policy "registros: editar" on public.entries for update using (is_member(household_id));
create policy "registros: borrar" on public.entries for delete using (is_member(household_id));

-- Crear una familia nueva (la primera persona).
create or replace function public.create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into households (name) values (p_name) returning id into hid;
  insert into household_members (household_id, user_id, display_name) values (hid, auth.uid(), p_display_name);
  return hid;
end $$;

-- Unirse a una familia existente con el código de invitación (la pareja).
create or replace function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Código no válido'; end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name)
    on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return hid;
end $$;

revoke execute on function public.create_household(text, text) from anon;
revoke execute on function public.join_household(text, text) from anon;

-- Cambios en tiempo real: lo que registra uno aparece al momento en el móvil del otro.
alter publication supabase_realtime add table public.entries, public.children;
