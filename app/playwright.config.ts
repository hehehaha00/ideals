// 这个文件配置 Playwright，用于验证 MVP 的浏览器主流程。
import { defineConfig, devices } from "@playwright/test";

const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const webPort = process.env.PLAYWRIGHT_PORT ?? "5173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev:e2e -- --port ${webPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: chromePath,
        },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        launchOptions: {
          executablePath: chromePath,
        },
      },
    },
  ],
});
