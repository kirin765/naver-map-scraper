CREATE TABLE IF NOT EXISTS place_review_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  sample_order integer NOT NULL CHECK (sample_order > 0),
  rating numeric(3,2) NULL CHECK (rating >= 0 AND rating <= 5),
  review_text text NULL,
  reviewed_at timestamptz NULL,
  collected_at timestamptz NOT NULL,
  CONSTRAINT place_review_samples_unique UNIQUE (place_id, run_id, sample_order)
);
