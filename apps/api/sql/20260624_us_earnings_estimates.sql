ALTER TABLE us_earnings_calendar
  ADD COLUMN IF NOT EXISTS revenue_estimate double precision,
  ADD COLUMN IF NOT EXISTS eps_actual double precision,
  ADD COLUMN IF NOT EXISTS revenue_actual double precision,
  ADD COLUMN IF NOT EXISTS actual_checked_at timestamp,
  ADD COLUMN IF NOT EXISTS estimate_source varchar,
  ADD COLUMN IF NOT EXISTS actual_source varchar,
  ADD COLUMN IF NOT EXISTS finnhub_year integer,
  ADD COLUMN IF NOT EXISTS finnhub_quarter integer,
  ADD COLUMN IF NOT EXISTS sec_confirmed_at timestamp,
  ADD COLUMN IF NOT EXISTS sec_financial_id varchar;

CREATE INDEX IF NOT EXISTS idx_us_earnings_calendar_symbol_report
  ON us_earnings_calendar (symbol, report_date);

CREATE INDEX IF NOT EXISTS idx_us_earnings_calendar_finnhub_period
  ON us_earnings_calendar (symbol, finnhub_year, finnhub_quarter);
