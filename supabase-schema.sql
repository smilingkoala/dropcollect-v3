-- DropCollect — Supabase Schema
-- Run this in your Supabase project's SQL Editor

-- ────────────────────────────────────────────────
-- COLLECTORS table
-- One row per generated collector (unique ID)
-- ────────────────────────────────────────────────
create table if not exists public.collectors (
  id            text primary key,          -- 8-char random alphanum
  tier          text not null default 'free'
                  check (tier in ('free', 'pro', 'pro_plus')),
  widget_style  text not null default 'minimal'
                  check (widget_style in ('minimal', 'card')),
  headline      text,
  subheadline   text,
  button_label  text not null default 'Subscribe',
  button_color  text not null default '#4dffcc',
  email_cap     integer,                   -- NULL = unlimited (Pro / Pro Plus)
  created_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────
-- EMAILS table
-- One row per collected email address
-- ────────────────────────────────────────────────
create table if not exists public.emails (
  id             uuid primary key default gen_random_uuid(),
  collector_id   text not null references public.collectors(id) on delete cascade,
  email          text not null,
  collected_at   timestamptz not null default now(),
  ip             text                              -- for abuse detection, not shown in dashboard
);

-- Prevent duplicate emails per collector
create unique index if not exists emails_collector_email_uniq
  on public.emails (collector_id, email);

-- Fast lookup by collector (for dashboard and cap checks)
create index if not exists emails_collector_idx
  on public.emails (collector_id, collected_at desc);

-- ────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- The service key (used by API routes) bypasses RLS.
-- These policies prevent direct DB access from anon clients.
-- ────────────────────────────────────────────────
alter table public.collectors enable row level security;
alter table public.emails     enable row level security;

-- No public access — all access goes through API routes with the service key
create policy "collectors: service key only" on public.collectors
  for all using (false);

create policy "emails: service key only" on public.emails
  for all using (false);

-- ────────────────────────────────────────────────
-- HELPER: check cap before insert (optional trigger)
-- ────────────────────────────────────────────────
create or replace function check_email_cap()
returns trigger language plpgsql security definer as $$
declare
  cap_val  integer;
  cur_cnt  integer;
begin
  select email_cap into cap_val from public.collectors where id = NEW.collector_id;
  if cap_val is not null then
    select count(*) into cur_cnt from public.emails where collector_id = NEW.collector_id;
    if cur_cnt >= cap_val then
      raise exception 'capacity_reached' using hint = 'This collector is at its email cap.';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger enforce_email_cap
  before insert on public.emails
  for each row execute function check_email_cap();
