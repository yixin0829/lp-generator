import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.js",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4177", browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 4177 --strictPort", url: "http://127.0.0.1:4177", reuseExistingServer: false },
  reporter: "list",
});
