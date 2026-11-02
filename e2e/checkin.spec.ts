import { expect, test } from "@playwright/test";
import { deleteMembersNamed, setDevClock } from "./helpers";

// The core loop on a 360px phone: scan → name → search → tap → on the shelf.

const TOKEN = "dev-2026-11-07";
const guest = `E2E Guest ${Date.now() % 100000}`;

test.afterAll(async () => {
  await setDevClock(null);
  await deleteMembersNamed(guest);
});

test("an unknown code explains itself", async ({ page }) => {
  await page.goto("/checkin/not-a-real-token");
  await expect(page.getByRole("heading", { name: "That code doesn't work" })).toBeVisible();
});

test("check-in is closed before the meetup day", async ({ page }) => {
  await setDevClock(null);
  await page.goto(`/checkin/${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Check-in isn't open yet" })).toBeVisible();
  await expect(page.getByText("Saturday 7 November")).toBeVisible();
});

test("a first-timer checks in with a book and lands on the shelf", async ({ page }) => {
  await setDevClock("2026-11-07");
  // The budget is for the member, not for `pnpm dev` compiling pages: warm the shelf route first.
  await page.goto("/shelf/d0000000-0000-4000-8000-000000000001");
  await page.goto(`/checkin/${TOKEN}`);
  const started = Date.now();
  await page.getByLabel(/Your name/).fill(guest);
  await page.getByLabel("What are you reading?").fill("Americanah");
  // A club book from the seed, so the test doesn't depend on Open Library being up.
  await page.getByRole("button", { name: /Americanah/ }).first().click();

  // Generous wait: `pnpm dev` compiles the shelf page on first visit. The 15 s budget below is the real check.
  await expect(page).toHaveURL(/\/shelf\/.+\?checkedIn=1/, { timeout: 15_000 });
  await expect(page.getByRole("status")).toHaveText(/You’re on the shelf/);
  await expect(page.getByText(guest)).toBeVisible();
  expect(Date.now() - started).toBeLessThan(15_000);

  // Coming back recognises them and lets them change book by typing it in.
  await page.goto(`/checkin/${TOKEN}`);
  await expect(page.getByText(`Welcome back, ${guest}.`)).toBeVisible();
  await expect(page.getByLabel(/Your name/)).toHaveCount(0);
  await page.getByRole("button", { name: "Can’t find it? Type the title" }).click();
  await page.getByLabel("Title").fill("An E2E Hand-Typed Book");
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page).toHaveURL(/\/shelf\//);
  await expect(page.locator(`li[id^="book-"]`).filter({ hasText: guest })).toContainText("An E2E Hand-Typed Book");
});

test("the shelf hides members who opted out", async ({ page }) => {
  await page.goto("/shelf/d0000000-0000-4000-8000-000000000001");
  await expect(page.getByText("Hauwa S.")).toBeVisible();
  await expect(page.getByText("Sadiq L.")).toHaveCount(0);
});
