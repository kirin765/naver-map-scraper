import type { PoolClient } from "pg";

import type {
  PersistedSearchObservation,
  PlaceRecord,
  ReviewSample
} from "../../domain/models.js";

export class PlaceRepository {
  async upsertPlace(client: PoolClient, place: PlaceRecord): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO places (
          source_place_id,
          name,
          primary_category,
          category_path,
          road_address,
          jibun_address,
          phone,
          business_hours_text,
          rating_avg,
          review_count_total,
          photo_urls,
          lat,
          lng,
          place_url,
          raw_list_payload,
          first_seen_at,
          last_seen_at,
          last_crawled_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (source_place_id)
        DO UPDATE
        SET
          name = EXCLUDED.name,
          primary_category = COALESCE(EXCLUDED.primary_category, places.primary_category),
          category_path = CASE
            WHEN EXCLUDED.category_path IS NOT NULL AND cardinality(EXCLUDED.category_path) > 0
              THEN EXCLUDED.category_path
            ELSE places.category_path
          END,
          road_address = COALESCE(EXCLUDED.road_address, places.road_address),
          jibun_address = COALESCE(EXCLUDED.jibun_address, places.jibun_address),
          phone = COALESCE(EXCLUDED.phone, places.phone),
          business_hours_text = COALESCE(EXCLUDED.business_hours_text, places.business_hours_text),
          rating_avg = COALESCE(EXCLUDED.rating_avg, places.rating_avg),
          review_count_total = COALESCE(EXCLUDED.review_count_total, places.review_count_total),
          photo_urls = CASE
            WHEN cardinality(EXCLUDED.photo_urls) > 0
              THEN EXCLUDED.photo_urls
            ELSE places.photo_urls
          END,
          lat = COALESCE(EXCLUDED.lat, places.lat),
          lng = COALESCE(EXCLUDED.lng, places.lng),
          place_url = EXCLUDED.place_url,
          raw_list_payload = COALESCE(EXCLUDED.raw_list_payload, places.raw_list_payload),
          last_seen_at = EXCLUDED.last_seen_at,
          last_crawled_at = EXCLUDED.last_crawled_at
        RETURNING id
      `,
      [
        place.sourcePlaceId,
        place.name,
        place.primaryCategory ?? null,
        place.categoryPath ?? null,
        place.roadAddress ?? null,
        place.jibunAddress ?? null,
        place.phone ?? null,
        place.businessHoursText ?? null,
        place.ratingAvg ?? null,
        place.reviewCountTotal ?? null,
        place.photoUrls,
        place.lat ?? null,
        place.lng ?? null,
        place.placeUrl,
        place.rawListPayload ?? null,
        place.firstSeenAt,
        place.lastSeenAt,
        place.lastCrawledAt
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to upsert place ${place.sourcePlaceId}`);
    }

    return row.id;
  }

  async recordObservation(
    client: PoolClient,
    observation: PersistedSearchObservation
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO place_search_observations (
          run_id,
          place_id,
          keyword,
          region_query,
          rank,
          page_no,
          list_position,
          seen_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (run_id, place_id, list_position)
        DO UPDATE
        SET
          rank = EXCLUDED.rank,
          page_no = EXCLUDED.page_no,
          seen_at = EXCLUDED.seen_at
      `,
      [
        observation.runId,
        observation.placeId,
        observation.keyword,
        observation.regionQuery,
        observation.rank,
        observation.pageNo ?? null,
        observation.listPosition,
        observation.seenAt
      ]
    );
  }

  async saveReviewSamples(
    client: PoolClient,
    placeId: string,
    runId: string,
    reviewSamples: ReviewSample[]
  ): Promise<void> {
    if (reviewSamples.length === 0) {
      return;
    }

    const COLS_PER_ROW = 7;
    const values: unknown[] = [];
    const valueClauses: string[] = [];

    for (let i = 0; i < reviewSamples.length; i++) {
      const reviewSample = reviewSamples[i];
      const base = i * COLS_PER_ROW;
      valueClauses.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
      );
      values.push(
        placeId,
        runId,
        reviewSample.sampleOrder,
        reviewSample.rating ?? null,
        reviewSample.reviewText ?? null,
        reviewSample.reviewedAt ?? null,
        reviewSample.collectedAt
      );
    }

    await client.query(
      `
        INSERT INTO place_review_samples (
          place_id,
          run_id,
          sample_order,
          rating,
          review_text,
          reviewed_at,
          collected_at
        )
        VALUES ${valueClauses.join(", ")}
        ON CONFLICT (place_id, run_id, sample_order)
        DO UPDATE
        SET
          rating = EXCLUDED.rating,
          review_text = EXCLUDED.review_text,
          reviewed_at = EXCLUDED.reviewed_at,
          collected_at = EXCLUDED.collected_at
      `,
      values
    );
  }
}
