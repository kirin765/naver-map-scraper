CREATE INDEX IF NOT EXISTS crawl_runs_target_started_at_idx
  ON crawl_runs (target_id, started_at DESC);

CREATE INDEX IF NOT EXISTS crawl_runs_status_started_at_idx
  ON crawl_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS places_name_idx
  ON places (name);

CREATE INDEX IF NOT EXISTS places_primary_category_idx
  ON places (primary_category);

CREATE INDEX IF NOT EXISTS places_last_seen_at_idx
  ON places (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS place_search_observations_run_rank_idx
  ON place_search_observations (run_id, rank);

CREATE INDEX IF NOT EXISTS place_search_observations_place_seen_at_idx
  ON place_search_observations (place_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS place_search_observations_keyword_region_seen_at_idx
  ON place_search_observations (keyword, region_query, seen_at DESC);

CREATE INDEX IF NOT EXISTS place_review_samples_place_collected_at_idx
  ON place_review_samples (place_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS place_review_samples_run_sample_order_idx
  ON place_review_samples (run_id, sample_order);
