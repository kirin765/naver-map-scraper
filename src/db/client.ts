import { Pool, type PoolClient } from "pg";

import type { AppEnv } from "../config/env.js";

export function createPool(env: AppEnv): Pool {
  return new Pool({
    connectionString: env.databaseUrl
  });
}

export async function withTransaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
