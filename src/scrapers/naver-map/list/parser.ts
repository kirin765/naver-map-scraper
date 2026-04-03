import type { Locator } from "playwright";

import type { ListItemContext, RawListItem, RawReviewSample } from "./types.js";
import {
  LIST_ADDRESS_SELECTORS,
  LIST_BUSINESS_HOURS_SELECTORS,
  LIST_CATEGORY_SELECTORS,
  LIST_NAME_SELECTORS,
  LIST_PHONE_SELECTORS,
  LIST_RATING_SELECTORS,
  LIST_REVIEW_COUNT_SELECTORS,
  REVIEW_SAMPLE_DATE_SELECTORS,
  REVIEW_SAMPLE_ITEM_SELECTORS,
  REVIEW_SAMPLE_RATING_SELECTORS,
  REVIEW_SAMPLE_TEXT_SELECTORS
} from "./selectors.js";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function firstText(root: Locator, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    const locator = root.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    const text = await locator.textContent();
    if (text) {
      return normalizeWhitespace(text);
    }
  }

  return undefined;
}

async function resolveReviewSampleItems(root: Locator): Promise<Locator | undefined> {
  for (const selector of REVIEW_SAMPLE_ITEM_SELECTORS) {
    const locator = root.locator(selector);
    if ((await locator.count()) > 0) {
      return locator;
    }
  }

  return undefined;
}

async function parseReviewSamples(root: Locator): Promise<RawReviewSample[]> {
  const sampleItems = await resolveReviewSampleItems(root);
  if (!sampleItems) {
    return [];
  }

  const reviewSamples: RawReviewSample[] = [];
  const count = await sampleItems.count();

  for (let index = 0; index < count; index += 1) {
    const item = sampleItems.nth(index);
    reviewSamples.push({
      sampleOrder: index + 1,
      ratingText: await firstText(item, REVIEW_SAMPLE_RATING_SELECTORS),
      reviewText: await firstText(item, REVIEW_SAMPLE_TEXT_SELECTORS),
      reviewedAtText: await firstText(item, REVIEW_SAMPLE_DATE_SELECTORS)
    });
  }

  return reviewSamples;
}

export async function parseListItem(context: ListItemContext): Promise<RawListItem> {
  return {
    nameText: await firstText(context.root, LIST_NAME_SELECTORS),
    categoryText: await firstText(context.root, LIST_CATEGORY_SELECTORS),
    addressText: await firstText(context.root, LIST_ADDRESS_SELECTORS),
    phoneText: await firstText(context.root, LIST_PHONE_SELECTORS),
    businessHoursText: await firstText(context.root, LIST_BUSINESS_HOURS_SELECTORS),
    ratingText: await firstText(context.root, LIST_RATING_SELECTORS),
    reviewCountText: await firstText(context.root, LIST_REVIEW_COUNT_SELECTORS),
    photoUrls: [],
    reviewSamples: await parseReviewSamples(context.root),
    rawPayload: {
      rank: context.rank,
      listPosition: context.listPosition,
      scrapedAt: new Date().toISOString()
    }
  };
}
