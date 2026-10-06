import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, CLIENT_PORT, SERVER_PORT, serverEnv } from "./env";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "../server",
      env: serverEnv,
      url: `http://localhost:${SERVER_PORT}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: `bunx --bun vite --port ${CLIENT_PORT} --strictPort`,
      cwd: "../client",
      env: { API_PROXY_TARGET: `http://localhost:${SERVER_PORT}` },
      url: BASE_URL,
      reuseExistingServer: false,
    },
  ],
});
