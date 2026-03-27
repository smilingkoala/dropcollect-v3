-- DropCollect — Pro Migration (v7)
-- Run this in Supabase SQL Editor AFTER the original schema

-- Add owner email (platform sees this, used to contact/recover access)
alter table public.collectors
  add column if not exists owner_email          text,
  add column if not exists notify_email         text,
  add column if not exists ls_customer_id       text,
  add column if not exists ls_subscription_id   text,
  add column if not exists upgraded_at          timestamptz;

-- Index for webhook lookups
create index if not exists collectors_ls_customer_idx
  on public.collectors (ls_customer_id);

-- Index for owner email lookups (account recovery)
create index if not exists collectors_owner_email_idx
  on public.collectors (owner_email);
