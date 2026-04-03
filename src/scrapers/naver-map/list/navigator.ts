import type { Browser, BrowserContext, Frame, Locator, Page } from "playwright";

import type { AppEnv } from "../../../config/env.js";
import type { CrawlTargetInput } from "../../../domain/models.js";
import type { ListItemContext, ListScope } from "./types.js";
import { createStealthContext } from "../../browser/playwright-factory.js";
import { LIST_ITEM_SELECTORS, SEARCH_FRAME_NAMES } from "./selectors.js";

export type OpenedListSession = {
  context: BrowserContext;
  page: Page;
  searchFrame: Frame;
  searchUrl: string;
  searchQuery: string;
};

function buildSearchQuery(target: CrawlTargetInput): string {
  return [target.keyword.trim(), target.regionQuery.trim()].filter(Boolean).join(" ");
}

export function buildSearchUrl(target: CrawlTargetInput): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(buildSearchQuery(target))}`;
}

async function resolveListLocator(scope: ListScope): Promise<Locator> {
  for (const selector of LIST_ITEM_SELECTORS) {
    const locator = scope.locator(selector);
    if ((await locator.count()) > 0) {
      return locator;
    }
  }

  const fallbackSelector = LIST_ITEM_SELECTORS[0];
  if (!fallbackSelector) {
    throw new Error("No list item selectors configured");
  }

  return scope.locator(fallbackSelector);
}

async function hasNoResultsMessage(scope: ListScope): Promise<boolean> {
  const messageLocator = scope.locator('text=검색 결과가 없습니다');
  return (await messageLocator.count()) > 0;
}

async function performSearch(page: Page, query: string, timeoutMs: number): Promise<void> {
  await page.goto("https://map.naver.com", {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs
  });

  await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
  const input = page.locator("input.input_search").first();
  await input.waitFor({ state: "visible", timeout: timeoutMs });
  await input.fill(query);
  await input.press("Enter");
}

export async function openListSession(
  browser: Browser,
  target: CrawlTargetInput,
  env: AppEnv
): Promise<OpenedListSession> {
  const context = await createStealthContext(browser, env);
  const page = await context.newPage();
  let searchQuery = buildSearchQuery(target);
  const searchUrl = buildSearchUrl(target);

  await performSearch(page, searchQuery, env.navigationTimeoutMs);

  let searchFrame: Frame | undefined;
  const startedAt = Date.now();
  while (Date.now() - startedAt < env.navigationTimeoutMs) {
    searchFrame = page.frames().find((frame) => SEARCH_FRAME_NAMES.includes(frame.name()));
    if (searchFrame) {
      break;
    }
    await page.waitForTimeout(500);
  }

  if (!searchFrame) {
    throw new Error("Could not resolve search iframe");
  }

  if (await hasNoResultsMessage(searchFrame)) {
    const fallbackQuery = target.keyword.trim();
    if (fallbackQuery && fallbackQuery !== searchQuery) {
      searchQuery = fallbackQuery;
      await performSearch(page, searchQuery, env.navigationTimeoutMs);
      searchFrame = undefined;
      const retryStartedAt = Date.now();
      while (Date.now() - retryStartedAt < env.navigationTimeoutMs) {
        searchFrame = page.frames().find((frame) => SEARCH_FRAME_NAMES.includes(frame.name()));
        if (searchFrame) {
          break;
        }
        await page.waitForTimeout(500);
      }
      if (!searchFrame) {
        throw new Error("Could not resolve search iframe after fallback query");
      }
    }
  }

  return { context, page, searchFrame, searchUrl, searchQuery };
}

export async function collectListItems(
  scope: ListScope,
  maxResults: number,
  env: AppEnv
): Promise<ListItemContext[]> {
  if (await hasNoResultsMessage(scope)) {
    return [];
  }

  const items = await resolveListLocator(scope);

  let previousCount = 0;
  let stagnantPasses = 0;

  for (let step = 0; step < env.maxScrollSteps; step += 1) {
    const count = await items.count();

    if (count >= maxResults) {
      break;
    }

    if (count === previousCount) {
      stagnantPasses += 1;
    } else {
      stagnantPasses = 0;
      previousCount = count;
    }

    if (count === 0 || stagnantPasses >= 3) {
      break;
    }

    await items.nth(count - 1).scrollIntoViewIfNeeded();
    const page = "page" in scope ? scope.page() : scope;
    await page.waitForTimeout(env.scrollDelayMs);
  }

  const finalCount = Math.min(await items.count(), maxResults);
  const contexts: ListItemContext[] = [];

  for (let index = 0; index < finalCount; index += 1) {
    const root = items.nth(index);
    contexts.push({
      root,
      titleButton: root.locator('a[role="button"]').first(),
      rank: index + 1,
      listPosition: index + 1
    });
  }

  return contexts;
}
