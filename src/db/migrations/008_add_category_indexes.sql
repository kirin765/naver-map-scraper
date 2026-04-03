CREATE INDEX IF NOT EXISTS category_harvest_runs_started_at_idx
  ON category_harvest_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS category_terms_source_last_seen_at_idx
  ON category_terms (source, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS category_terms_primary_category_idx
  ON category_terms (primary_category);

CREATE INDEX IF NOT EXISTS category_terms_last_seen_at_idx
  ON category_terms (last_seen_at DESC);
