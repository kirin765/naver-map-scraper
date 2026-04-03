import { runMigrations } from "../db/migrate.js";
import type { CrawlTargetInput } from "../domain/models.js";
import { runCategoryHarvest } from "../pipelines/run-category-harvest.js";
import { runCategoryHarvestLoop } from "../pipelines/run-category-harvest-loop.js";
import { runListCrawl } from "../pipelines/run-list-crawl.js";

type ParsedFlags = Record<string, string | boolean>;

function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const nextToken = args[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      flags[token] = true;
      continue;
    }

    flags[token] = nextToken;
    index += 1;
  }

  return flags;
}

function readRequiredString(flags: ParsedFlags, name: string): string {
  const value = flags[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required flag: ${name}`);
  }

  return value.trim();
}

function readInt(flags: ParsedFlags, name: string, fallback: number): number {
  const value = flags[name];
  if (value === undefined || value === true) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new Error(`Flag ${name} must be an integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Flag ${name} must be an integer`);
  }

  return parsed;
}

function buildCrawlInput(flags: ParsedFlags): CrawlTargetInput {
  const maxResults = readInt(flags, "--max-results", 100);
  const reviewSampleLimit = readInt(flags, "--review-sample-limit", 5);

  if (maxResults <= 0) {
    throw new Error("--max-results must be greater than 0");
  }

  if (reviewSampleLimit < 0) {
    throw new Error("--review-sample-limit must be 0 or greater");
  }

  return {
    keyword: readRequiredString(flags, "--keyword"),
    regionQuery: readRequiredString(flags, "--region"),
    maxResults,
    reviewSampleLimit
  };
}

function buildCategoryHarvestInput(flags: ParsedFlags): {
  region: string;
  sampleCount: number;
  maxResults: number;
} {
  const sampleCount = readInt(flags, "--sample-count", 12);
  const maxResults = readInt(flags, "--max-results", 8);

  if (sampleCount <= 0) {
    throw new Error("--sample-count must be greater than 0");
  }

  if (maxResults <= 0) {
    throw new Error("--max-results must be greater than 0");
  }

  return {
    region: readRequiredString(flags, "--region"),
    sampleCount,
    maxResults
  };
}

function buildCategoryHarvestLoopInput(flags: ParsedFlags): {
  region: string;
  sampleCount: number;
  maxResults: number;
  intervalSeconds: number;
  maxIdleRuns: number;
} {
  const intervalSeconds = readInt(flags, "--interval-seconds", 3_600);
  const maxIdleRuns = readInt(flags, "--max-idle-runs", 2);
  const base = buildCategoryHarvestInput(flags);

  if (intervalSeconds <= 0) {
    throw new Error("--interval-seconds must be greater than 0");
  }

  if (maxIdleRuns <= 0) {
    throw new Error("--max-idle-runs must be greater than 0");
  }

  return {
    ...base,
    intervalSeconds,
    maxIdleRuns
  };
}

function printUsage(): void {
  console.log(`Usage:
  npm run migrate
  npm run crawl -- --keyword "<keyword>" --region "<region>" [--max-results 100] [--review-sample-limit 5]
  npm run categories -- --region "서울" [--sample-count 12] [--max-results 8]
  npm run categories-loop -- --region "서울" [--sample-count 12] [--max-results 8] [--interval-seconds 3600] [--max-idle-runs 2]
  npm run dev -- migrate
  npm run dev -- crawl --keyword "<keyword>" --region "<region>"
  npm run dev -- categories --region "서울"
  npm run dev -- categories-loop --region "서울"`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "migrate") {
    await runMigrations();
    return;
  }

  if (command === "crawl") {
    const flags = parseFlags(args);
    const result = await runListCrawl(buildCrawlInput(flags));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "categories") {
    const flags = parseFlags(args);
    const result = await runCategoryHarvest(buildCategoryHarvestInput(flags));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "categories-loop") {
    const flags = parseFlags(args);
    const result = await runCategoryHarvestLoop(buildCategoryHarvestLoopInput(flags));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
