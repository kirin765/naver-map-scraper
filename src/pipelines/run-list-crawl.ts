import { chromium, type Browser } from "playwright";

import { loadEnv } from "../config/env.js";
import { createPool, withTransaction } from "../db/client.js";
import { CrawlRunRepository } from "../db/repositories/crawl-run-repository.js";
import { CrawlTargetRepository } from "../db/repositories/crawl-target-repository.js";
import { PlaceRepository } from "../db/repositories/place-repository.js";
import type { CrawlTargetInput } from "../domain/models.js";
import { logger } from "../observability/logger.js";
import { collectListItems, openListSession } from "../scrapers/naver-map/list/navigator.js";
import { openAndParsePlaceDetail } from "../scrapers/naver-map/list/detail.js";
import { normalizeListItem } from "../scrapers/naver-map/list/normalizer.js";
import type { NormalizedListItem } from "../scrapers/naver-map/list/types.js";
import { PersistenceService } from "../services/persistence-service.js";

const RUNNER_VERSION = "0.1.0";

export type RunListCrawlResult = {
  targetId: string;
  runId: string;
  resultCount: number;
  skippedCount: number;
  searchUrl: string;
};

export type RunListCrawlOptions = {
  onNormalizedItem?: (item: NormalizedListItem) => void | Promise<void>;
};

type CrawlRuntime = {
  browser: Browser;
  pool: ReturnType<typeof createPool>;
  env: ReturnType<typeof loadEnv>;
};

async function executeListCrawl(
  input: CrawlTargetInput,
  runtime: CrawlRuntime,
  options: RunListCrawlOptions = {}
): Promise<RunListCrawlResult> {
  const { browser, pool, env } = runtime;
  const crawlTargetRepository = new CrawlTargetRepository();
  const crawlRunRepository = new CrawlRunRepository();
  const placeRepository = new PlaceRepository();
  const persistenceService = new PersistenceService(pool, placeRepository);

  let runId: string | undefined;

  try {
    const target = await withTransaction(pool, (client) =>
      crawlTargetRepository.ensure(client, input)
    );

    const session = await openListSession(browser, target, env);
    const run = await withTransaction(pool, (client) =>
      crawlRunRepository.create(client, {
        targetId: target.id,
        searchUrl: session.searchUrl,
        runnerVersion: RUNNER_VERSION
      })
    );
    runId = run.id;

    logger.info("Started crawl run", {
      runId,
      targetId: target.id,
      keyword: target.keyword,
      regionQuery: target.regionQuery
    });

    const listItems = await collectListItems(session.searchFrame, target.maxResults, env);
    let savedCount = 0;
    let skippedCount = 0;

    for (const listItem of listItems) {
      const rawItem = await (async () => {
        let lastError: unknown;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            return await openAndParsePlaceDetail(session.page, listItem, env.navigationTimeoutMs);
          } catch (err) {
            lastError = err;
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
        throw lastError;
      })();
      if (!rawItem.sourcePlaceId || !rawItem.nameText) {
        logger.warn("Skipping non-place list item", {
          runId: run.id,
          rank: listItem.rank,
          listPosition: listItem.listPosition
        });
        skippedCount += 1;
        continue;
      }

      const normalizedItem = normalizeListItem(rawItem, {
        keyword: target.keyword,
        regionQuery: target.regionQuery,
        rank: listItem.rank,
        pageNo: listItem.pageNo,
        listPosition: listItem.listPosition,
        reviewSampleLimit: target.reviewSampleLimit
      });

      await persistenceService.save(run.id, normalizedItem);
      await options.onNormalizedItem?.(normalizedItem);
      savedCount += 1;
    }

    await withTransaction(pool, (client) => crawlRunRepository.complete(client, run.id, savedCount));

    logger.info("Completed crawl run", {
      runId: run.id,
      targetId: target.id,
      resultCount: savedCount,
      skippedCount
    });

    return {
      targetId: target.id,
      runId: run.id,
      resultCount: savedCount,
      skippedCount,
      searchUrl: session.searchUrl
    };
  } catch (error) {
    if (runId) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failedRunId = runId;
      await withTransaction(pool, (client) =>
        crawlRunRepository.fail(client, failedRunId, errorMessage)
      );
    }

    throw error;
  }
}

export async function runListCrawl(
  input: CrawlTargetInput,
  options: RunListCrawlOptions = {}
): Promise<RunListCrawlResult> {
  const env = loadEnv();
  const pool = createPool(env);
  const browser = await chromium.launch({ headless: env.headless });

  try {
    return await executeListCrawl(input, { browser, pool, env }, options);
  } finally {
    await Promise.allSettled([browser.close(), pool.end()]);
  }
}

export async function runListCrawlWithResources(
  input: CrawlTargetInput,
  runtime: CrawlRuntime,
  options: RunListCrawlOptions = {}
): Promise<RunListCrawlResult> {
  return executeListCrawl(input, runtime, options);
}
