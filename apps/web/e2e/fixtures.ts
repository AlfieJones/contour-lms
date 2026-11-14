import { test as base, expect, type Page } from "@playwright/test";
import { createTestAccounts, type TestAccount, type TestAccounts } from "../testing/test-accounts";

export const test = base.extend<{ accounts: TestAccounts }>({
  // Playwright requires object destructuring even when no built-in fixtures are needed.
  // eslint-disable-next-line no-empty-pattern
  accounts: async ({}, use) => {
    const { accounts, cleanup } = await createTestAccounts();
    try {
      await use(accounts);
    } finally {
      // Deleting the fixture users cascades to their bookings, roles and enrolments.
      await cleanup();
    }
  },
});

export { expect };

export async function login(page: Page, account: TestAccount) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Consultations", exact: true })).toBeVisible();
  await showBookings(page);
}

export async function showBookings(page: Page) {
  await page.getByRole("tab", { name: "Table", exact: true }).click();
}

export async function logout(page: Page) {
  await page
    .getByRole("button", { name: /^Account menu for/ })
    .filter({ visible: true })
    .click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL("/login");
}
