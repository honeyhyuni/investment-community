CREATE TABLE IF NOT EXISTS guru_edgar_filings (
  id varchar PRIMARY KEY,
  cik varchar NOT NULL,
  accession_number varchar NOT NULL UNIQUE,
  form_type varchar NOT NULL,
  filing_date date NULL,
  report_date date NULL,
  filing_url varchar NOT NULL,
  info_table_url varchar NULL,
  status varchar NOT NULL DEFAULT 'discovered',
  holdings_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  downloaded_at timestamptz NULL,
  parsed_at timestamptz NULL,
  applied_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_edgar_filings_cik ON guru_edgar_filings (cik);
CREATE INDEX IF NOT EXISTS idx_guru_edgar_filings_status ON guru_edgar_filings (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_edgar_filings_accession ON guru_edgar_filings (accession_number);
