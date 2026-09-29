-- V2 – Etappe 1: Grundschema, Sync-Spalten und Zugriffsregeln (RLS)
--
-- Grundsätze (siehe docs/V2-Konzept.md):
-- * Jede Person sieht und ändert ausschließlich ihre eigenen Daten.
-- * Zugriff nur mit Mitgliedschaft in einer Organisation (Konten legt nur der Betreiber an).
-- * Kein echtes Löschen durch Clients – nur der Löschmarker `deleted`.
-- * `version` (pro Datensatz) und `revision` (global) werden ausschließlich vom Server vergeben.
-- * Tabellen werden explizit nur für `authenticated` freigegeben (Data API: "expose new tables" aus).

-- ---------------------------------------------------------------------------
-- Organisation & Mitgliedschaft
-- ---------------------------------------------------------------------------

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Vorerst genau eine Organisation pro Person.
create table public.memberships (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  role            text not null default 'employee' check (role in ('employee', 'admin')),
  created_at      timestamptz not null default now()
);

-- Kontostatus, vom Betreiber gesetzt (Startpasswort muss beim ersten Login ersetzt werden).
create table public.account_status (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  must_change_password boolean not null default true,
  updated_at           timestamptz not null default now()
);

-- Organisation der angemeldeten Person (NULL = keine Freigabe → kein Datenzugriff).
create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid())
$$;

-- Nach erfolgreichem Passwortwechsel in der App: eigenes Flag zurücksetzen.
create function public.complete_password_change()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_status
     set must_change_password = false, updated_at = now()
   where user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Sync-Infrastruktur
-- ---------------------------------------------------------------------------

-- Globale, streng steigende Änderungsnummer für „Änderungen seit …“.
create sequence public.sync_revision_seq;

-- Vergibt Version, Revision und Zeitstempel; schützt Besitz-Spalten vor Änderungen.
create function public.sync_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version         := old.version + 1;
    new.id              := old.id;
    new.user_id         := old.user_id;
    new.organization_id := old.organization_id;
  end if;
  new.revision   := nextval('public.sync_revision_seq');
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nutzdaten (Spalten entsprechen src/domain/models)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                              uuid primary key,
  user_id                         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id                 uuid not null default public.current_org_id() references public.organizations (id),
  first_name                      text not null,
  last_name                       text not null,
  vacation_days_per_year          integer not null check (vacation_days_per_year >= 0),
  tracking_start_date             date not null,
  initial_balance_minutes         integer not null default 0,
  initial_vacation_as_of          date,
  initial_vacation_taken_days     integer not null default 0 check (initial_vacation_taken_days >= 0),
  initial_vacation_carryover_days integer not null default 0 check (initial_vacation_carryover_days >= 0),
  health_data_consent_at          timestamptz,
  version                         bigint not null default 1,
  revision                        bigint not null default 0,
  deleted                         boolean not null default false,
  updated_at                      timestamptz not null default now()
);
create unique index profiles_one_per_user on public.profiles (user_id) where not deleted;

create table public.schedule_versions (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  valid_from      date not null,
  schedule        jsonb not null,
  version         bigint not null default 1,
  revision        bigint not null default 0,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now()
);

create table public.work_days (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  date            date not null,
  status          text not null default 'work' check (status = 'work'),
  start_time      text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time        text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  break_minutes   integer not null check (break_minutes >= 0),
  planned_minutes integer not null check (planned_minutes >= 0),
  version         bigint not null default 1,
  revision        bigint not null default 0,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now()
);
-- Ein Arbeitstag pro Person und Datum (gelöschte Einträge ausgenommen).
create unique index work_days_one_per_date on public.work_days (user_id, date) where not deleted;

create table public.vacation_periods (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  start_date      date not null,
  end_date        date not null,
  kind            text check (kind is null or kind = 'overtime'),
  version         bigint not null default 1,
  revision        bigint not null default 0,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.sick_periods (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  start_date      date not null,
  end_date        date not null,
  version         bigint not null default 1,
  revision        bigint not null default 0,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.custom_holidays (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  date            date not null,
  version         bigint not null default 1,
  revision        bigint not null default 0,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now()
);
create unique index custom_holidays_one_per_date on public.custom_holidays (user_id, date) where not deleted;

-- Trigger und Indizes für alle Nutzdaten-Tabellen
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'schedule_versions', 'work_days', 'vacation_periods', 'sick_periods', 'custom_holidays']
  loop
    execute format(
      'create trigger %1$s_sync before insert or update on public.%1$I for each row execute function public.sync_before_write()',
      t);
    execute format('create index %1$s_user_revision on public.%1$I (user_id, revision)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

alter table public.organizations    enable row level security;
alter table public.memberships      enable row level security;
alter table public.account_status   enable row level security;
alter table public.profiles         enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.work_days        enable row level security;
alter table public.vacation_periods enable row level security;
alter table public.sick_periods     enable row level security;
alter table public.custom_holidays  enable row level security;

-- Verwaltungstabellen: nur eigene Zeilen lesen, Schreiben nur durch den Betreiber (Service-Schlüssel).
create policy "eigene Organisation lesen" on public.organizations
  for select to authenticated using (id = public.current_org_id());

create policy "eigene Mitgliedschaft lesen" on public.memberships
  for select to authenticated using (user_id = (select auth.uid()));

create policy "eigenen Kontostatus lesen" on public.account_status
  for select to authenticated using (user_id = (select auth.uid()));

-- Nutzdaten: nur eigene Zeilen, nur mit Mitgliedschaft; kein DELETE (Löschmarker).
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'schedule_versions', 'work_days', 'vacation_periods', 'sick_periods', 'custom_holidays']
  loop
    execute format(
      'create policy "eigene Daten lesen" on public.%I for select to authenticated
         using (user_id = (select auth.uid()) and public.current_org_id() is not null)', t);
    execute format(
      'create policy "eigene Daten anlegen" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()) and organization_id = public.current_org_id())', t);
    execute format(
      'create policy "eigene Daten ändern" on public.%I for update to authenticated
         using (user_id = (select auth.uid()) and public.current_org_id() is not null)
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Freigaben für die Data API (nur angemeldete Nutzer, nie anonym)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on function public.current_org_id() from public, anon;
revoke all on function public.complete_password_change() from public, anon;
revoke all on function public.sync_before_write() from public, anon, authenticated;

grant select on public.organizations, public.memberships, public.account_status to authenticated;
grant select, insert, update on
  public.profiles, public.schedule_versions, public.work_days,
  public.vacation_periods, public.sick_periods, public.custom_holidays
  to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.complete_password_change() to authenticated;

-- Betreiber (Service-Schlüssel, nur Admin-Skript): umgeht RLS, braucht aber Tabellenrechte.
grant all on all tables in schema public to service_role;
grant usage, select on sequence public.sync_revision_seq to service_role;
