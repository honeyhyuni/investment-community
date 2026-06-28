CREATE TABLE IF NOT EXISTS guru_sec_datasets (
  id varchar PRIMARY KEY,
  dataset_url varchar NOT NULL UNIQUE,
  dataset_label varchar NOT NULL,
  file_name varchar NOT NULL,
  file_path varchar NULL,
  sha256 varchar NULL,
  file_size integer NULL,
  status varchar NOT NULL DEFAULT 'discovered',
  downloaded_at timestamptz NULL,
  parsed_at timestamptz NULL,
  applied_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_sec_datasets_status ON guru_sec_datasets (status);
CREATE INDEX IF NOT EXISTS idx_guru_sec_datasets_label ON guru_sec_datasets (dataset_label);
