create table if not exists us_stock_financials (
  id varchar primary key,
  symbol varchar not null,
  cik varchar not null,
  period_type varchar not null,
  fiscal_year integer not null,
  fiscal_quarter integer not null default 0,
  revenue double precision,
  operating_income double precision,
  net_income double precision,
  assets double precision,
  liabilities double precision,
  equity double precision,
  eps double precision,
  period_start date,
  period_end date not null,
  filed_at date,
  accession_number varchar,
  currency varchar not null default 'USD',
  source varchar not null default 'sec_companyfacts',
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, period_type, fiscal_year, fiscal_quarter)
);

create index if not exists idx_us_stock_financials_symbol_period
  on us_stock_financials(symbol, period_type, fiscal_year desc, fiscal_quarter desc);
