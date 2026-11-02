import { expect, test, type Page } from "@playwright/test";
import { deleteMembersNamed, deleteUserByEmail, magicLinkFor, setDevClock } from "./helpers";

// Phase 2: reasons to return. A guest checks in, shares (or not), saves a book, sees their
// passport, and keeps it all when they sign in.

const TOKEN = "dev-2026-11-07";
const OLD_SHELF = "/shelf/d0000000-0000-4000-8000-000000000001"; // 24 Oct, from the seed
const run = Date.now() % 100000;
const guest = `E2E Reader ${run}`;
const email = `e2e-reader-${run}@example.test`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await setDevClock("2026-11-07");
});

test.afterAll(async () => {
  await setDevClock(null);
  await deleteMembersNamed(guest);
  await deleteUserByEmail(email);
});

async function checkInAsGuest(page: Page) {
  await page.goto(`/checkin/${TOKEN}`);
  await page.getByLabel(/Your name/).fill(guest);
  await page.getByLabel("What are you reading?").fill("Purple Hibiscus");
  await page.getByRole("button", { name: /Purple Hibiscus/ }).first().click();
  await expect(page).toHaveURL(/\/shelf\/.+\?checkedIn=1/, { timeout: 15_000 });
}

test("a dropped connection queues the check-in and sends it when back online", async ({ page, context }) => {
  await page.goto(`/checkin/${TOKEN}`);
  await page.getByLabel(/Your name/).fill(guest);
  await page.getByLabel("What are you reading?").fill("Purple Hibiscus");
  const book = page.getByRole("button", { name: /Purple Hibiscus/ }).first();
  await expect(book).toBeVisible();

  await context.setOffline(true);
  await book.click();
  await expect(page.getByText(/No signal right now/)).toBeVisible();

  await context.setOffline(false);
  await expect(page).toHaveURL(/\/shelf\/.+\?checkedIn=1/, { timeout: 15_000 });
  await expect(page.getByText(guest)).toBeVisible();
});

test("shares are optional, attached to your check-in, and deletable", async ({ page }) => {
  await checkInAsGuest(page);
  const mine = page.locator("li", { hasText: `${guest} (that’s you)` }).last();

  await mine.getByText("Add a thought (optional)").click();
  await mine.getByLabel("Your line or quote").fill("Kambili's silence says everything.");
  await mine.getByRole("button", { name: "Add" }).click();
  await expect(mine).toContainText("Kambili's silence says everything.");

  await mine.locator("details").evaluate((d: HTMLDetailsElement) => (d.open = true));
  await mine.getByRole("button", { name: "Rate 4 out of 5" }).click();
  await expect(mine.getByLabel("Rated 4 out of 5")).toBeVisible();

  await mine.getByRole("button", { name: "Delete this share" }).first().click();
  await expect(mine).not.toContainText("Kambili's silence says everything.");
});

test("want-to-read and the passport", async ({ page }) => {
  await checkInAsGuest(page);

  await page.goto(OLD_SHELF);
  const book = page.locator('li[id^="book-"]', { hasText: "Stay With Me" });
  await book.getByRole("button", { name: "Want to read" }).click();
  await expect(book.getByRole("button", { name: /On your want-to-read list/ })).toBeVisible();

  await page.goto("/passport");
  await expect(page.getByRole("heading", { name: `${guest}’s passport` })).toBeVisible();
  await expect(page.getByText("You’re a guest on this phone.")).toBeVisible();
  await expect(page.getByText("in a row").locator("..")).toContainText("1");
  await expect(page.getByText("Saturday 7 November")).toBeVisible();
  await expect(page.locator("section", { hasText: "Want to read" })).toContainText("Stay With Me");
});

test("hiding from the shelf keeps the passport", async ({ page }) => {
  await checkInAsGuest(page);
  const shelfUrl = page.url().replace(/\?.*$/, "");

  await page.goto("/passport");
  await page.getByLabel(/Hide me from the shelf/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(shelfUrl);
  // Still visible to yourself, marked as you; others can't see it (RLS, covered by the seed's hidden member).
  await expect(page.getByText(`${guest} (that’s you)`)).toBeVisible();

  await page.goto("/passport");
  await page.getByLabel(/Hide me from the shelf/).uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("signing in keeps a guest's history", async ({ page }) => {
  await checkInAsGuest(page);

  await page.goto("/signin?next=/passport");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/passport$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: `${guest}’s passport` })).toBeVisible();
  await expect(page.getByText("You’re a guest on this phone.")).toHaveCount(0);
  await expect(page.getByText("Saturday 7 November")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
