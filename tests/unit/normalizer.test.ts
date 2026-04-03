import test from "node:test";
import assert from "node:assert/strict";

import { normalizeListItem } from "../../src/scrapers/naver-map/list/normalizer.js";

test("normalizeListItem converts raw text into persisted fields", () => {
  const normalized = normalizeListItem(
    {
      sourcePlaceId: "12345",
      nameText: " 예시 카페 ",
      categoryText: "카페 > 디저트",
      addressText: "서울 성동구 ...",
      phoneText: "02-123-4567",
      businessHoursText: "매일 10:00 - 22:00",
      ratingText: "4.6",
      reviewCountText: "리뷰 128",
      photoUrls: ["https://img.example/1.jpg", "https://img.example/1.jpg"],
      placeUrl: undefined,
      reviewSamples: [
        {
          sampleOrder: 1,
          ratingText: "5.0",
          reviewText: " 좋아요 ",
          reviewedAtText: "2026.04.01"
        }
      ],
      rawPayload: { source: "test" }
    },
    {
      keyword: "카페",
      regionQuery: "성수동",
      rank: 1,
      listPosition: 1,
      reviewSampleLimit: 3,
      seenAt: "2026-04-02T00:00:00.000Z"
    }
  );

  assert.equal(normalized.place.sourcePlaceId, "12345");
  assert.equal(normalized.place.name, "예시 카페");
  assert.equal(normalized.place.primaryCategory, "카페");
  assert.deepEqual(normalized.place.categoryPath, ["카페", "디저트"]);
  assert.equal(normalized.place.reviewCountTotal, 128);
  assert.equal(normalized.place.ratingAvg, 4.6);
  assert.equal(normalized.place.placeUrl, "https://map.naver.com/p/entry/place/12345");
  assert.deepEqual(normalized.place.photoUrls, ["https://img.example/1.jpg"]);
  assert.equal(normalized.observation.rank, 1);
  assert.equal(normalized.reviewSamples[0]?.reviewText, "좋아요");
  assert.equal(normalized.reviewSamples[0]?.reviewedAt, "2026-04-01T00:00:00.000Z");
});
