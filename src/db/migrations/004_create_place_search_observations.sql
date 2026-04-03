CREATE TABLE IF NOT EXISTS place_search_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  region_query text NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  page_no integer NULL CHECK (page_no > 0),
  list_position integer NOT NULL CHECK (list_position > 0),
  seen_at timestamptz NOT NULL,
  CONSTRAINT place_search_observations_unique UNIQUE (run_id, place_id, list_position)
);
