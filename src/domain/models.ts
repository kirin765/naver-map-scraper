export type CrawlRunStatus = "pending" | "running" | "succeeded" | "failed";

export type CrawlTargetInput = {
  keyword: string;
  regionQuery: string;
  maxResults: number;
  reviewSampleLimit: number;
};

export type CrawlTarget = CrawlTargetInput & {
  id: string;
  scheduleExpr: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CrawlRun = {
  id: string;
  targetId: string;
  status: CrawlRunStatus;
  searchUrl: string;
  startedAt: string;
  completedAt: string | null;
  resultCount: number;
  errorMessage: string | null;
  runnerVersion: string;
};

export type PlaceRecord = {
  sourcePlaceId: string;
  name: string;
  primaryCategory?: string;
  categoryPath?: string[];
  roadAddress?: string;
  jibunAddress?: string;
  phone?: string;
  businessHoursText?: string;
  ratingAvg?: number;
  reviewCountTotal?: number;
  photoUrls: string[];
  lat?: number;
  lng?: number;
  placeUrl: string;
  rawListPayload?: unknown;
  firstSeenAt: string;
  lastSeenAt: string;
  lastCrawledAt: string;
};

export type SearchObservation = {
  keyword: string;
  regionQuery: string;
  rank: number;
  pageNo?: number;
  listPosition: number;
  seenAt: string;
};

export type PersistedSearchObservation = SearchObservation & {
  runId: string;
  placeId: string;
};

export type ReviewSample = {
  sampleOrder: number;
  rating?: number;
  reviewText?: string;
  reviewedAt?: string;
  collectedAt: string;
};
