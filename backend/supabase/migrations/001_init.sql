create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  google_sub text not null unique,
  full_name text,
  avatar_url text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  plan_code text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  period_type text not null,
  period_key text not null,
  used_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_type, period_key)
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  period_key text not null,
  question text not null,
  created_at timestamptz not null default now()
);

create table if not exists plans (
  code text primary key,
  title text not null,
  max_agents int not null,
  period_type text not null,
  max_questions int not null
);

insert into plans (code, title, max_agents, period_type, max_questions)
values
  ('free', 'Free', 2, 'daily', 20),
  ('pro', 'Pro', 4, 'monthly', 500)
on conflict (code) do nothing;
