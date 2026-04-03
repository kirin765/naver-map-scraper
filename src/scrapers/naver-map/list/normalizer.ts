import type {
  CrawlTargetInput,
  PlaceRecord,
  ReviewSample,
  SearchObservation
} from "../../../domain/models.js";
import type { ListItemContext, NormalizedListItem, RawListItem, RawReviewSample } from "./types.js";

type NormalizeContext = Pick<CrawlTargetInput, "keyword" | "regionQuery"> &
  Pick<ListItemContext, "rank" | "pageNo" | "listPosition"> & {
    seenAt?: string;
    reviewSampleLimit: number;
  };

function cleanText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseReviewCount(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const matches = value.replace(/,/g, "").match(/\d+/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  const lastMatch = matches[matches.length - 1];
  if (!lastMatch) {
    return undefined;
  }

  const parsed = Number.parseInt(lastMatch, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function splitCategoryPath(categoryText: string | undefined): string[] | undefined {
  const cleaned = cleanText(categoryText);
  if (!cleaned) {
    return undefined;
  }

  const parts = cleaned
    .split(/>|,|·|\//)
    .map((value) => value.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : undefined;
}

function parseReviewedAt(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return undefined;
  }

  const dottedDate = cleaned.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (dottedDate) {
    const [, year, month, day] = dottedDate;
    if (!year || !month || !day) {
      return undefined;
    }

    return new Date(
      Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
    ).toISOString();
  }

  const isoDate = Date.parse(cleaned);
  if (!Number.isNaN(isoDate)) {
    return new Date(isoDate).toISOString();
  }

  return undefined;
}

function normalizeReviewSamples(
  samples: RawReviewSample[],
  seenAt: string,
  reviewSampleLimit: number
): ReviewSample[] {
  return samples.slice(0, reviewSampleLimit).map((sample, index) => ({
    sampleOrder: index + 1,
    rating: parseNumber(sample.ratingText),
    reviewText: cleanText(sample.reviewText),
    reviewedAt: parseReviewedAt(sample.reviewedAtText),
    collectedAt: seenAt
  }));
}

function buildPlaceRecord(rawItem: RawListItem, seenAt: string): PlaceRecord {
  const sourcePlaceId = cleanText(rawItem.sourcePlaceId);
  const name = cleanText(rawItem.nameText);

  if (!sourcePlaceId) {
    throw new Error("List item is missing sourcePlaceId");
  }

  if (!name) {
    throw new Error(`List item ${sourcePlaceId} is missing a place name`);
  }

  const categoryPath = splitCategoryPath(rawItem.categoryText);
  const placeUrl = cleanText(rawItem.placeUrl) ?? `https://map.naver.com/p/entry/place/${sourcePlaceId}`;

  return {
    sourcePlaceId,
    name,
    primaryCategory: categoryPath?.[0],
    categoryPath,
    roadAddress: cleanText(rawItem.addressText),
    phone: cleanText(rawItem.phoneText),
    businessHoursText: cleanText(rawItem.businessHoursText),
    ratingAvg: parseNumber(rawItem.ratingText),
    reviewCountTotal: parseReviewCount(rawItem.reviewCountText),
    photoUrls: uniqueValues(rawItem.photoUrls),
    lat: rawItem.lat,
    lng: rawItem.lng,
    placeUrl,
    rawListPayload: rawItem.rawPayload,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    lastCrawledAt: seenAt
  };
}

function buildObservation(context: NormalizeContext, seenAt: string): SearchObservation {
  return {
    keyword: context.keyword,
    regionQuery: context.regionQuery,
    rank: context.rank,
    pageNo: context.pageNo,
    listPosition: context.listPosition,
    seenAt
  };
}

export function normalizeListItem(
  rawItem: RawListItem,
  context: NormalizeContext
): NormalizedListItem {
  const seenAt = context.seenAt ?? new Date().toISOString();

  return {
    place: buildPlaceRecord(rawItem, seenAt),
    observation: buildObservation(context, seenAt),
    reviewSamples: normalizeReviewSamples(rawItem.reviewSamples, seenAt, context.reviewSampleLimit)
  };
}
