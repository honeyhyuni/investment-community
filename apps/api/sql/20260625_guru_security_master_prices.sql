CREATE TABLE IF NOT EXISTS guru_managers (
  id varchar PRIMARY KEY,
  slug varchar NOT NULL UNIQUE,
  person_name varchar NOT NULL,
  firm_name varchar NOT NULL,
  cik varchar NOT NULL UNIQUE,
  sort_order integer NOT NULL,
  report_date date,
  filing_date date,
  accession_number varchar,
  total_value double precision NOT NULL DEFAULT 0,
  position_count integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_managers_sort_order ON guru_managers (sort_order);

CREATE TABLE IF NOT EXISTS guru_security_master (
  cusip varchar PRIMARY KEY,
  ticker varchar,
  figi varchar,
  name varchar,
  sector varchar,
  industry varchar,
  current_price double precision,
  price_updated_at timestamptz,
  source varchar NOT NULL,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guru_security_master
  ADD COLUMN IF NOT EXISTS current_price double precision,
  ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS guru_holdings (
  id varchar PRIMARY KEY,
  manager_id varchar NOT NULL REFERENCES guru_managers(id) ON DELETE CASCADE,
  cusip varchar NOT NULL,
  figi varchar,
  ticker varchar,
  put_call varchar,
  issuer_name varchar NOT NULL,
  class_title varchar NOT NULL,
  value double precision NOT NULL,
  shares double precision NOT NULL,
  weight double precision NOT NULL,
  previous_value double precision NOT NULL DEFAULT 0,
  previous_shares double precision NOT NULL DEFAULT 0,
  previous_weight double precision NOT NULL DEFAULT 0,
  weight_change double precision NOT NULL DEFAULT 0,
  share_change double precision NOT NULL DEFAULT 0,
  return_percent double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_holdings_manager_weight ON guru_holdings (manager_id, weight);
CREATE INDEX IF NOT EXISTS idx_guru_holdings_manager_weight_change ON guru_holdings (manager_id, weight_change);
