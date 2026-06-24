create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  price_enabled boolean not null default false,
  earnings_enabled boolean not null default true,
  ipo_enabled boolean not null default true,
  community_enabled boolean not null default false,
  new_post_enabled boolean not null default false,
  market_briefing_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type varchar(32) not null,
  title varchar(240) not null,
  body text not null,
  url text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_notifications_user_created
  on app_notifications(user_id, created_at desc);
create index if not exists idx_app_notifications_user_unread
  on app_notifications(user_id, read_at);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  dedupe_key varchar(320) not null unique,
  kind varchar(32) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_deliveries_user_created
  on notification_deliveries(user_id, created_at desc);
