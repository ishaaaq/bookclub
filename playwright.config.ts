import { defineConfig, devices } from "@playwright/test";

// e2e runs against the local Supabase stack (`supabase start && supabase db reset`).

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false, // tests share the dev clock and seed data
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 740 }, // CLAUDE.md: designed at 360px
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
