import type { PoolClient } from "pg";

import type { CrawlTarget, CrawlTargetInput } from "../../domain/models.js";

type CrawlTargetRow = {
  id: string;
  keyword: string;
  region_query: string;
  max_results: number;
  review_sample_limit: number;
  schedule_expr: string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: CrawlTargetRow): CrawlTarget {
  return {
    id: row.id,
    keyword: row.keyword,
    regionQuery: row.region_query,
    maxResults: row.max_results,
    reviewSampleLimit: row.review_sample_limit,
    scheduleExpr: row.schedule_expr,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export class CrawlTargetRepository {
  async ensure(client: PoolClient, input: CrawlTargetInput): Promise<CrawlTarget> {
    const result = await client.query<CrawlTargetRow>(
      `
        INSERT INTO crawl_targets (
          keyword,
          region_query,
          max_results,
          review_sample_limit,
          is_active
        )
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (keyword, region_query)
        DO UPDATE
        SET
          max_results = EXCLUDED.max_results,
          review_sample_limit = EXCLUDED.review_sample_limit,
          is_active = true,
          updated_at = now()
        RETURNING *
      `,
      [
        input.keyword,
        input.regionQuery,
        input.maxResults,
        input.reviewSampleLimit
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create or update crawl target");
    }

    return mapRow(row);
  }
}
