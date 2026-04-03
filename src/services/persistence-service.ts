import type { Pool } from "pg";

import { withTransaction } from "../db/client.js";
import { PlaceRepository } from "../db/repositories/place-repository.js";
import type { NormalizedListItem } from "../scrapers/naver-map/list/types.js";

export class PersistenceService {
  constructor(
    private readonly pool: Pool,
    private readonly placeRepository: PlaceRepository
  ) {}

  async save(runId: string, normalizedItem: NormalizedListItem): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const placeId = await this.placeRepository.upsertPlace(client, normalizedItem.place);

      await this.placeRepository.recordObservation(client, {
        ...normalizedItem.observation,
        runId,
        placeId
      });

      await this.placeRepository.saveReviewSamples(
        client,
        placeId,
        runId,
        normalizedItem.reviewSamples
      );
    });
  }
}
