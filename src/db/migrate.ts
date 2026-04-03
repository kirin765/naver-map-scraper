import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadEnv } from "../config/env.js";
import { createPool, withTransaction } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const env = loadEnv();
  const pool = createPool(env);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = (await readdir(migrationsDir))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    const appliedResult = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    for (const fileName of files) {
      if (applied.has(fileName)) {
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, fileName), "utf8");
      await withTransaction(pool, async (client) => {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [fileName]
        );
      });
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
