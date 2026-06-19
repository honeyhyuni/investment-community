CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_portfolios_user_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_created
  ON portfolios (user_id, created_at);

CREATE TABLE IF NOT EXISTS portfolio_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol varchar NOT NULL,
  market varchar NOT NULL,
  name varchar NULL,
  quantity numeric(20, 6) NOT NULL,
  average_price numeric(20, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_portfolio_positions_stock UNIQUE (portfolio_id, market, symbol)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_positions_stock
  ON portfolio_positions (portfolio_id, market, symbol);

ALTER TABLE portfolio_positions
  ADD COLUMN IF NOT EXISTS average_price numeric(20, 6) NOT NULL DEFAULT 0;
