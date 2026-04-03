CREATE TABLE IF NOT EXISTS category_harvest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  region text NOT NULL,
  sample_count integer NOT NULL CHECK (sample_count > 0),
  max_results integer NOT NULL CHECK (max_results > 0),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  saved_count integer NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  error_message text NULL,
  runner_version text NOT NULL
);

CREATE TABLE IF NOT EXISTS category_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  category_text text NOT NULL,
  primary_category text NULL,
  category_path text[] NULL,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  first_harvest_run_id uuid NULL REFERENCES category_harvest_runs(id) ON DELETE SET NULL,
  last_harvest_run_id uuid NULL REFERENCES category_harvest_runs(id) ON DELETE SET NULL,
  sample_keyword text NULL,
  sample_region text NULL,
  CONSTRAINT category_terms_source_category_text_unique UNIQUE (source, category_text)
);
