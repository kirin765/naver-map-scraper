import type { PoolClient } from "pg";

import type { CrawlRun, CrawlRunStatus } from "../../domain/models.js";

type CrawlRunRow = {
  id: string;
  target_id: string;
  status: CrawlRunStatus;
  search_url: string;
  started_at: string | Date;
  completed_at: string | Date | null;
  result_count: number;
  error_message: string | null;
  runner_version: string;
};

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: CrawlRunRow): CrawlRun {
  return {
    id: row.id,
    targetId: row.target_id,
    status: row.status,
    searchUrl: row.search_url,
    startedAt: toIsoString(row.started_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : null,
    resultCount: row.result_count,
    errorMessage: row.error_message,
    runnerVersion: row.runner_version
  };
}

export class CrawlRunRepository {
  async create(
    client: PoolClient,
    input: { targetId: string; searchUrl: string; runnerVersion: string }
  ): Promise<CrawlRun> {
    const result = await client.query<CrawlRunRow>(
      `
        INSERT INTO crawl_runs (
          target_id,
          status,
          search_url,
          runner_version
        )
        VALUES ($1, 'running', $2, $3)
        RETURNING *
      `,
      [input.targetId, input.searchUrl, input.runnerVersion]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create crawl run");
    }

    return mapRow(row);
  }

  async complete(client: PoolClient, runId: string, resultCount: number): Promise<void> {
    await client.query(
      `
        UPDATE crawl_runs
        SET
          status = 'succeeded',
          result_count = $2,
          completed_at = now(),
          error_message = NULL
        WHERE id = $1
      `,
      [runId, resultCount]
    );
  }

  async fail(client: PoolClient, runId: string, errorMessage: string): Promise<void> {
    await client.query(
      `
        UPDATE crawl_runs
        SET
          status = 'failed',
          completed_at = now(),
          error_message = $2
        WHERE id = $1
      `,
      [runId, errorMessage]
    );
  }
}
