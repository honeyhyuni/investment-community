ALTER TABLE guru_security_master
  ADD COLUMN IF NOT EXISTS current_price double precision,
  ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;
