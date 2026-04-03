CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS crawl_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  region_query text NOT NULL,
  max_results integer NOT NULL DEFAULT 100 CHECK (max_results > 0),
  review_sample_limit integer NOT NULL DEFAULT 5 CHECK (review_sample_limit >= 0),
  schedule_expr text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crawl_targets_keyword_region_unique UNIQUE (keyword, region_query)
);
