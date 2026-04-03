export type AppEnv = {
  databaseUrl: string;
  headless: boolean;
  navigationTimeoutMs: number;
  scrollDelayMs: number;
  maxScrollSteps: number;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }

  return parsed;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Environment variable ${name} must be "true" or "false"`);
}

export function loadEnv(): AppEnv {
  return {
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    headless: readBoolEnv("HEADLESS", true),
    navigationTimeoutMs: readIntEnv("NAVIGATION_TIMEOUT_MS", 30_000),
    scrollDelayMs: readIntEnv("SCROLL_DELAY_MS", 1_200),
    maxScrollSteps: readIntEnv("MAX_SCROLL_STEPS", 40)
  };
}
