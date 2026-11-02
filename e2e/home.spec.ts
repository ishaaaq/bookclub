import { expect, test } from "@playwright/test";
import { deleteMembersNamed } from "./helpers";

const guest = `E2E Planner ${Date.now() % 100000}`;

test.afterAll(async () => {
  await deleteMembersNamed(guest);
});

test("the next meetup card shows the computed date, venue and host", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "Next meetup" });
  await expect(card).toContainText("Saturday 7 November");
  await expect(card).toContainText("4:00 pm");
  await expect(card).toContainText("Hosted by Amaka O.");
  await expect(page.getByRole("link", { name: "Share to WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
});

test("thinking of coming is one optional tap that toggles", async ({ page }) => {
  await page.goto("/");
  const count = page.getByText(/plans? to come/);
  const before = Number((await count.textContent())?.match(/\d+/)?.[0] ?? 0);

  await page.getByLabel(/Your first name/).fill(guest);
  await page.getByRole("button", { name: "I’m thinking of coming" }).click();
  await expect(page.getByRole("button", { name: /You’re thinking of coming/ })).toBeVisible();
  await expect(count).toContainText(String(before + 1));

  await page.getByRole("button", { name: /You’re thinking of coming/ }).click();
  await expect(page.getByRole("button", { name: "I’m thinking of coming" })).toBeVisible();
});

test("the host page asks for sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin\?next=(%2F|\/)admin/);
});
