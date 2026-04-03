import { loadEnv } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { runCategoryHarvest } from "./run-category-harvest.js";

export type CategoryHarvestLoopInput = {
  region: string;
  sampleCount: number;
  maxResults: number;
  intervalSeconds: number;
  maxIdleRuns: number;
};

export type CategoryHarvestLoopResult = {
  completedRuns: number;
  stoppedBecauseIdle: boolean;
  lastInsertedCategoryCount: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runCategoryHarvestLoop(
  input: CategoryHarvestLoopInput
): Promise<CategoryHarvestLoopResult> {
  loadEnv();

  let completedRuns = 0;
  let idleRuns = 0;
  let lastInsertedCategoryCount = 0;

  while (idleRuns < input.maxIdleRuns) {
    const result = await runCategoryHarvest({
      region: input.region,
      sampleCount: input.sampleCount,
      maxResults: input.maxResults
    });

    completedRuns += 1;
    lastInsertedCategoryCount = result.insertedCategoryCount;

    logger.info("Category harvest cycle completed", {
      completedRuns,
      insertedCategoryCount: result.insertedCategoryCount,
      primaryCategoryCount: result.primaryCategories.length,
      categoryPathCount: result.categoryPaths.length
    });

    if (result.insertedCategoryCount === 0) {
      idleRuns += 1;
    } else {
      idleRuns = 0;
    }

    if (idleRuns >= input.maxIdleRuns) {
      break;
    }

    await sleep(input.intervalSeconds * 1_000);
  }

  return {
    completedRuns,
    stoppedBecauseIdle: idleRuns >= input.maxIdleRuns,
    lastInsertedCategoryCount
  };
}
