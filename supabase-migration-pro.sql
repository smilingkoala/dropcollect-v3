-- DropCollect — Pro Migration (Lemon Squeezy version)
-- Run this in Supabase SQL Editor AFTER the original schema

alter table public.collectors
  add column if not exists notify_email        text,
  add column if not exists ls_customer_id      text,
  add column if not exists ls_subscription_id  text,
  add column if not exists upgraded_at         timestamptz;

-- Index for webhook lookups by Lemon Squeezy customer ID
create index if not exists collectors_ls_customer_idx
  on public.collectors (ls_customer_id);
