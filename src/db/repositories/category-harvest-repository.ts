import type { PoolClient } from "pg";

type CategoryHarvestRunRow = {
  id: string;
};

export type CategoryHarvestRunInput = {
  source: string;
  region: string;
  sampleCount: number;
  maxResults: number;
  runnerVersion: string;
};

export type UpsertCategoryTermInput = {
  source: string;
  categoryText: string;
  primaryCategory?: string;
  categoryPath?: string[];
  seenAt: string;
  harvestRunId: string;
  sampleKeyword?: string;
  sampleRegion?: string;
};

export type UpsertCategoryTermResult = {
  inserted: boolean;
};

export class CategoryHarvestRepository {
  async createRun(client: PoolClient, input: CategoryHarvestRunInput): Promise<string> {
    const result = await client.query<CategoryHarvestRunRow>(
      `
        INSERT INTO category_harvest_runs (
          source,
          region,
          sample_count,
          max_results,
          status,
          runner_version
        )
        VALUES ($1, $2, $3, $4, 'running', $5)
        RETURNING id
      `,
      [input.source, input.region, input.sampleCount, input.maxResults, input.runnerVersion]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create category harvest run");
    }

    return row.id;
  }

  async completeRun(client: PoolClient, runId: string, savedCount: number): Promise<void> {
    await client.query(
      `
        UPDATE category_harvest_runs
        SET
          status = 'succeeded',
          completed_at = now(),
          saved_count = $2,
          error_message = NULL
        WHERE id = $1
      `,
      [runId, savedCount]
    );
  }

  async failRun(client: PoolClient, runId: string, errorMessage: string): Promise<void> {
    await client.query(
      `
        UPDATE category_harvest_runs
        SET
          status = 'failed',
          completed_at = now(),
          error_message = $2
        WHERE id = $1
      `,
      [runId, errorMessage]
    );
  }

  async upsertCategoryTerm(
    client: PoolClient,
    input: UpsertCategoryTermInput
  ): Promise<UpsertCategoryTermResult> {
    const result = await client.query<{ inserted: boolean }>(
      `
        INSERT INTO category_terms (
          source,
          category_text,
          primary_category,
          category_path,
          first_seen_at,
          last_seen_at,
          first_harvest_run_id,
          last_harvest_run_id,
          sample_keyword,
          sample_region
        )
        VALUES ($1, $2, $3, $4, $5, $5, $6, $6, $7, $8)
        ON CONFLICT (source, category_text)
        DO UPDATE
        SET
          primary_category = COALESCE(EXCLUDED.primary_category, category_terms.primary_category),
          category_path = CASE
            WHEN EXCLUDED.category_path IS NOT NULL AND cardinality(EXCLUDED.category_path) > 0
              THEN EXCLUDED.category_path
            ELSE category_terms.category_path
          END,
          occurrence_count = category_terms.occurrence_count + 1,
          last_seen_at = EXCLUDED.last_seen_at,
          last_harvest_run_id = EXCLUDED.last_harvest_run_id,
          sample_keyword = EXCLUDED.sample_keyword,
          sample_region = EXCLUDED.sample_region
        RETURNING (xmax = 0) AS inserted
      `,
      [
        input.source,
        input.categoryText,
        input.primaryCategory ?? null,
        input.categoryPath ?? null,
        input.seenAt,
        input.harvestRunId,
        input.sampleKeyword ?? null,
        input.sampleRegion ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert category term");
    }

    return row;
  }
}
