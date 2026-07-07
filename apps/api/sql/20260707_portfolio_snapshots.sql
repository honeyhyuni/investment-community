alter table portfolio_positions add column if not exists started_at date;
update portfolio_positions set started_at = created_at::date where started_at is null;
create table if not exists portfolio_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  snapshot_date date not null,
  value_krw numeric(24,6) not null,
  cost_krw numeric(24,6) not null,
  usd_krw numeric(18,6),
  spy_close numeric(18,6),
  qqq_close numeric(18,6),
  kospi_close numeric(18,6),
  estimated boolean not null default false,
  created_at timestamptz not null default now(),
  unique(portfolio_id, snapshot_date)
);
create index if not exists idx_portfolio_snapshots_portfolio_date on portfolio_daily_snapshots(portfolio_id, snapshot_date);
alter table portfolio_daily_snapshots add column if not exists qqq_close numeric(18,6);
