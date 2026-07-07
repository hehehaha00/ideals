// 这个文件配置 Playwright，用于验证 MVP 的浏览器主流程。
import { defineConfig, devices } from "@playwright/test";

const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
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
