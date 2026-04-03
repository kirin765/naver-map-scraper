import type { Frame, Page } from "playwright";

import type { ListItemContext } from "./types.js";
import type { RawListItem, RawReviewSample } from "./types.js";
import {
  ADDRESS_SELECTORS,
  BUSINESS_HOURS_SELECTORS,
  CATEGORY_SELECTORS,
  NAME_SELECTORS,
  REVIEW_COUNT_SELECTORS
} from "./selectors.js";

type DetailParseResult = RawListItem & {
  sourcePlaceId: string;
  placeUrl: string;
};

function cleanText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function extractPlaceId(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname
      .split("/")
      .filter(Boolean)
      .find((value) => /^\d+$/.test(value));

    return segment;
  } catch {
    const match = url.match(/\/(\d+)(?:\/|$)/);
    return match?.[1];
  }
}

function extractPhone(value: string | undefined): string | undefined {
  const match = cleanText(value)?.match(/전화번호\s*(\d[\d-]+)/);
  return match?.[1];
}

function extractVisitorReviewCount(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return undefined;
  }

  const match = cleaned.match(/방문자 리뷰\s*([\d,]+)/);
  return match?.[1];
}

function extractBusinessHours(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return undefined;
  }

  const match = cleaned.match(/영업시간(.*?)(전화번호|홈페이지|페이스북|인스타그램|편의|$)/);
  if (match?.[1]) {
    const hours = cleanText(match[1]);
    return hours ? `영업시간 ${hours}` : undefined;
  }

  const businessMatch = cleaned.match(/영업 중\s*(.*?)(전화번호|홈페이지|페이스북|인스타그램|편의|$)/);
  if (businessMatch?.[1]) {
    const hours = cleanText(businessMatch[1]);
    return hours ? `영업 중 ${hours}` : "영업 중";
  }

  return cleaned;
}

async function collectBusinessHours(entryFrame: Frame): Promise<string | undefined> {
  const hoursToggle = entryFrame.locator('div.PIbes a[role="button"].gKP9i').first();
  if ((await hoursToggle.count()) > 0) {
    const expanded = (await hoursToggle.getAttribute("aria-expanded")) === "true";
    if (!expanded) {
      await hoursToggle.click({ timeout: 30_000 });
      await hoursToggle.waitFor({ state: "visible", timeout: 30_000 });
    }

    const expandedText = await hoursToggle.evaluate((node) => {
      const element = node as HTMLElement;
      return element.innerText;
    });

    return extractBusinessHours(expandedText ?? undefined);
  }

  const hoursBlock = await firstText(entryFrame, BUSINESS_HOURS_SELECTORS);
  return extractBusinessHours(hoursBlock);
}

function extractCoordinates(html: string): { lat?: number; lng?: number } {
  const match = html.match(
    /"coordinate":\{"__typename":"Coordinate","x":"([\d.-]+)","y":"([\d.-]+)"/
  );
  if (!match) {
    return {};
  }

  const lng = Number.parseFloat(match[1] ?? "");
  const lat = Number.parseFloat(match[2] ?? "");

  return {
    lat: Number.isNaN(lat) ? undefined : lat,
    lng: Number.isNaN(lng) ? undefined : lng
  };
}

async function firstText(frame: Frame, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    const locator = frame.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    const text = await locator.textContent();
    const cleaned = cleanText(text ?? undefined);
    if (cleaned) {
      return cleaned;
    }
  }

  return undefined;
}

async function collectPhotoUrls(entryFrame: Frame): Promise<string[]> {
  const urls = new Set<string>();
  const images = entryFrame.locator('img[id^="business_"], img[alt="업체"]');
  const count = await images.count();

  for (let index = 0; index < count; index += 1) {
    const src = await images.nth(index).getAttribute("src");
    if (src && !src.includes("favicon")) {
      urls.add(src);
    }
  }

  return [...urls];
}

async function collectReviewSamples(_page: Page, _entryFrame: Frame): Promise<RawReviewSample[]> {
  return [];
}

export async function resolveEntryFrame(page: Page, timeoutMs: number): Promise<Frame> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const entryFrame = page.frames().find((frame) => frame.name() === "entryIframe");

    if (entryFrame) {
      return entryFrame;
    }

    const hintedFrame = page
      .frames()
      .find(
        (frame) =>
          frame !== page.mainFrame() &&
          /\/(?:place|restaurant)\/\d+\/(?:home|.+)/.test(frame.url())
      );

    if (hintedFrame) {
      return hintedFrame;
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Could not resolve place detail iframe");
}

export async function openAndParsePlaceDetail(
  page: Page,
  item: ListItemContext,
  timeoutMs: number
): Promise<DetailParseResult> {
  await item.titleButton.click({ timeout: timeoutMs });

  await page.waitForURL((url) => /\/(?:place|restaurant)\/\d+/.test(url.toString()), { timeout: timeoutMs }).catch(
    () => {}
  );

  const entryFrame = await resolveEntryFrame(page, timeoutMs);
  await entryFrame.locator("div#_title").first().waitFor({
    state: "attached",
    timeout: timeoutMs
  });
  return parsePlaceDetail(page, entryFrame);
}

export async function parsePlaceDetail(
  page: Page,
  entryFrame: Frame
): Promise<DetailParseResult> {
  const placeUrl = entryFrame.url() || page.url();
  const sourcePlaceId = extractPlaceId(placeUrl);
  if (!sourcePlaceId) {
    throw new Error(`Could not extract place id from url: ${placeUrl}`);
  }

  const title = await firstText(entryFrame, NAME_SELECTORS);
  const category = await firstText(entryFrame, CATEGORY_SELECTORS);
  const address = await firstText(entryFrame, ADDRESS_SELECTORS);
  const detailBlock = await firstText(entryFrame, ["div.PIbes"]);
  const visitorReviewText = await firstText(entryFrame, REVIEW_COUNT_SELECTORS);
  const blogReviewText = cleanText(
    (await entryFrame.locator('a[href*="/review/ugc"]').first().textContent()) ?? undefined
  );
  const coordinates = extractCoordinates(await entryFrame.content());

  return {
    sourcePlaceId,
    nameText: title ?? "",
    categoryText: category,
    addressText: address,
    phoneText: extractPhone(detailBlock),
    businessHoursText: (await collectBusinessHours(entryFrame)) ?? extractBusinessHours(detailBlock),
    ratingText: undefined,
    reviewCountText: extractVisitorReviewCount(visitorReviewText),
    photoUrls: await collectPhotoUrls(entryFrame),
    lat: coordinates.lat,
    lng: coordinates.lng,
    placeUrl,
    reviewSamples: await collectReviewSamples(page, entryFrame),
    rawPayload: {
      title,
      category,
      address,
      detailBlock,
      visitorReviewText,
      blogReviewText,
      coordinates
    }
  };
}
