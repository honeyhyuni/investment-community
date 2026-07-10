CREATE TABLE IF NOT EXISTS economic_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  country varchar(10) NOT NULL DEFAULT 'US',
  observation_date date NOT NULL,
  actual numeric(20,6), previous numeric(20,6), expected numeric(20,6),
  unit varchar(32) NOT NULL, importance varchar(16) NOT NULL DEFAULT 'high',
  source_url varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_economic_indicators_series_date UNIQUE(series_id, observation_date)
);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_date ON economic_indicators(observation_date DESC);