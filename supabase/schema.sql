-- Poke Report database: run once in Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what is missing and replaces the policies.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  group_code   text,
  share_stats  boolean not null default true,
  prefs        jsonb   not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists public.decks (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id         text not null,
  name       text,
  cards      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.tournaments (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id         text not null,
  date       date,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists profiles_group_idx on public.profiles (group_code);

alter table public.profiles    enable row level security;
alter table public.decks       enable row level security;
alter table public.tournaments enable row level security;

-- The caller's group code, read without re-entering the profiles policy.
create or replace function public.my_group() returns text
language sql stable security definer set search_path = public as $$
  select group_code from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_group() from public;
grant execute on function public.my_group() to authenticated;

-- profiles: you see yourself and the members of your group; you change only yourself.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "profiles delete" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated
  using (id = auth.uid() or (group_code is not null and group_code = public.my_group()));
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles delete" on public.profiles for delete to authenticated using (id = auth.uid());

-- decks: private to their owner.
drop policy if exists "decks own" on public.decks;
create policy "decks own" on public.decks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tournaments: owner reads and writes; group members read them when the owner shares stats.
drop policy if exists "tournaments read"  on public.tournaments;
drop policy if exists "tournaments write" on public.tournaments;
drop policy if exists "tournaments insert" on public.tournaments;
drop policy if exists "tournaments update" on public.tournaments;
drop policy if exists "tournaments delete" on public.tournaments;
create policy "tournaments read" on public.tournaments for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = tournaments.user_id
        and p.share_stats
        and p.group_code is not null
        and p.group_code = public.my_group()
    )
  );
create policy "tournaments insert" on public.tournaments for insert to authenticated with check (user_id = auth.uid());
create policy "tournaments update" on public.tournaments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tournaments delete" on public.tournaments for delete to authenticated using (user_id = auth.uid());

-- Nobody without an account can read or write anything.
revoke all on public.profiles, public.decks, public.tournaments from anon;
grant select, insert, update, delete on public.profiles, public.decks, public.tournaments to authenticated;
