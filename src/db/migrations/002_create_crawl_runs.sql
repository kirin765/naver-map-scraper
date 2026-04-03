CREATE TABLE IF NOT EXISTS crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES crawl_targets(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  search_url text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  error_message text NULL,
  runner_version text NOT NULL
);
