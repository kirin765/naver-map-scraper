import { chromium } from "playwright";

import { loadEnv } from "../config/env.js";
import { createPool, withTransaction } from "../db/client.js";
import { CategoryHarvestRepository } from "../db/repositories/category-harvest-repository.js";
import type { CrawlTargetInput } from "../domain/models.js";
import { logger } from "../observability/logger.js";
import { collectListItems, openListSession } from "../scrapers/naver-map/list/navigator.js";
import { parseListItem } from "../scrapers/naver-map/list/parser.js";

const SOURCE_RAW = "search-list-raw";
const SOURCE_TERM = "search-list-term";
const RUNNER_VERSION = "0.1.0";

const SEOUL_DISTRICTS = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구"
] as const;

const CATEGORY_SAMPLE_KEYWORDS = [
  "카페",
  "맛집",
  "병원",
  "약국",
  "편의점",
  "미용실",
  "헬스장",
  "학원",
  "치과",
  "스터디카페",
  "주차장",
  "꽃집"
];

export type CategoryHarvestResult = {
  region: string;
  sampleCount: number;
  targetResults: Array<{
    keyword: string;
    regionQuery: string;
    queryLabel: string;
    runId: string;
    resultCount: number;
    savedCount: number;
  }>;
  failedTargets: Array<{
    keyword: string;
    regionQuery: string;
    queryLabel: string;
    errorMessage: string;
  }>;
  insertedCategoryCount: number;
  primaryCategories: string[];
  categoryPaths: string[];
};

type CategoryHarvestTarget = CrawlTargetInput & {
  queryLabel: string;
};

type CategoryRecord = {
  source: string;
  categoryText: string;
  primaryCategory?: string;
  categoryPath?: string[];
};

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current as T;
  }
  return copy;
}

function buildSampleTargets(sampleCount: number, region: string, maxResults: number): CategoryHarvestTarget[] {
  const regionPrefix = region.trim();
  const candidates = shuffle(
    SEOUL_DISTRICTS.flatMap((district) =>
      CATEGORY_SAMPLE_KEYWORDS.map((keyword) => ({
        keyword,
        regionQuery: `${regionPrefix} ${district}`.trim(),
        maxResults,
        reviewSampleLimit: 0,
        queryLabel: `${keyword} ${regionPrefix} ${district}`.trim()
      }))
    )
  );

  return candidates.slice(0, Math.min(sampleCount, candidates.length));
}

function cleanText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function splitCategoryText(categoryText: string): string[] {
  return categoryText
    .split(/>|,|·|\//)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCategoryRecords(categoryText: string): CategoryRecord[] {
  const cleaned = cleanText(categoryText);
  if (!cleaned) {
    return [];
  }

  const paths = splitCategoryText(cleaned);
  const primaryCategory = paths[0];

  return [
    {
      source: SOURCE_RAW,
      categoryText: cleaned,
      primaryCategory,
      categoryPath: paths
    },
    ...paths.map((term) => ({
      source: SOURCE_TERM,
      categoryText: term,
      primaryCategory: term,
      categoryPath: [term]
    }))
  ];
}

export async function runCategoryHarvest(input: {
  region: string;
  sampleCount: number;
  maxResults: number;
}): Promise<CategoryHarvestResult> {
  const env = loadEnv();
  const pool = createPool(env);
  const browser = await chromium.launch({ headless: env.headless });
  const harvestRepository = new CategoryHarvestRepository();
  const sampledTargets = buildSampleTargets(input.sampleCount, input.region, input.maxResults);

  const primaryCategories = new Set<string>();
  const categoryPaths = new Set<string>();
  const targetResults: CategoryHarvestResult["targetResults"] = [];
  const failedTargets: CategoryHarvestResult["failedTargets"] = [];
  let insertedCategoryCount = 0;

  try {
    for (const target of sampledTargets) {
      logger.info("Harvesting categories", {
        keyword: target.keyword,
        regionQuery: target.regionQuery
      });

      const session = await openListSession(browser, target, env);
      let runId: string | undefined;

      try {
        const run = await withTransaction(pool, (client) =>
          harvestRepository.createRun(client, {
            source: SOURCE_RAW,
            region: input.region,
            sampleCount: input.sampleCount,
            maxResults: input.maxResults,
            runnerVersion: RUNNER_VERSION
          })
        );
        runId = run;

        const listItems = await collectListItems(session.searchFrame, target.maxResults, env);
        const categoryRecords: CategoryRecord[] = [];

        for (const listItem of listItems) {
          const rawItem = await parseListItem(listItem);
          if (!rawItem.categoryText) {
            continue;
          }

          categoryRecords.push(...buildCategoryRecords(rawItem.categoryText));
        }

        let savedCount = 0;
        await withTransaction(pool, async (client) => {
          for (const record of categoryRecords) {
            const upsertResult = await harvestRepository.upsertCategoryTerm(client, {
              source: record.source,
              categoryText: record.categoryText,
              primaryCategory: record.primaryCategory,
              categoryPath: record.categoryPath,
              seenAt: new Date().toISOString(),
              harvestRunId: runId as string,
              sampleKeyword: target.keyword,
              sampleRegion: target.regionQuery
            });

            savedCount += 1;
            if (upsertResult.inserted) {
              insertedCategoryCount += 1;
            }

            if (record.source === SOURCE_RAW) {
              primaryCategories.add(record.categoryText);
            }

            for (const term of record.categoryPath ?? []) {
              categoryPaths.add(term);
            }
          }

          await harvestRepository.completeRun(client, runId as string, savedCount);
        });

        targetResults.push({
          keyword: target.keyword,
          regionQuery: target.regionQuery,
          queryLabel: target.queryLabel,
          runId: runId as string,
          resultCount: listItems.length,
          savedCount
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn("Skipping category sample", {
          keyword: target.keyword,
          regionQuery: target.regionQuery,
          errorMessage
        });

        if (runId) {
          await withTransaction(pool, (client) => harvestRepository.failRun(client, runId as string, errorMessage));
        }

        failedTargets.push({
          keyword: target.keyword,
          regionQuery: target.regionQuery,
          queryLabel: target.queryLabel,
          errorMessage
        });
      } finally {
        await session.context.close();
      }
    }

    return {
      region: input.region,
      sampleCount: sampledTargets.length,
      targetResults,
      failedTargets,
      insertedCategoryCount,
      primaryCategories: [...primaryCategories].sort((a, b) => a.localeCompare(b, "ko")),
      categoryPaths: [...categoryPaths].sort((a, b) => a.localeCompare(b, "ko"))
    };
  } finally {
    await browser.close();
    await pool.end();
  }
}
