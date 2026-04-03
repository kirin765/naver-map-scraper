import type { Browser, BrowserContext } from "playwright";

import type { AppEnv } from "../../config/env.js";

export async function createStealthContext(
  browser: Browser,
  _env: AppEnv
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1600 },
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["ko-KR", "ko"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });

  return context;
}
