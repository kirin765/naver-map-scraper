import type { Frame, Locator, Page } from "playwright";

import type { PlaceRecord, ReviewSample, SearchObservation } from "../../../domain/models.js";

export type ListScope = Page | Frame;

export type ListItemContext = {
  root: Locator;
  titleButton: Locator;
  rank: number;
  pageNo?: number;
  listPosition: number;
};

export type RawReviewSample = {
  sampleOrder: number;
  ratingText?: string;
  reviewText?: string;
  reviewedAtText?: string;
};

export type RawListItem = {
  sourcePlaceId?: string;
  nameText?: string;
  categoryText?: string;
  addressText?: string;
  phoneText?: string;
  businessHoursText?: string;
  ratingText?: string;
  reviewCountText?: string;
  photoUrls: string[];
  lat?: number;
  lng?: number;
  placeUrl?: string;
  reviewSamples: RawReviewSample[];
  rawPayload: Record<string, unknown>;
};

export type NormalizedListItem = {
  place: PlaceRecord;
  observation: SearchObservation;
  reviewSamples: ReviewSample[];
};
