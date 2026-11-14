import { test, expect, login, logout } from "./fixtures";

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
});

for (const role of ["student", "teacher", "admin"] as const) {
  test(`${role} can log in, keep their session on reload and log out`, async ({
    page,
    accounts,
  }) => {
    await login(page, accounts[role]);
    await page.reload();
    const menu = page
      .getByRole("button", { name: `Account menu for ${accounts[role].name}` })
      .filter({ visible: true });
    await expect(menu).toContainText(`· ${role}`);
    const adminNav = page.getByRole("list", { name: "Admin navigation" });
    if (role === "admin") {
      await expect(adminNav.getByRole("link", { name: "Users", exact: true })).toBeVisible();
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();
    } else {
      await expect(adminNav).toHaveCount(0);
    }
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
}

test("invalid credentials show an error without signing in", async ({ page, accounts }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(accounts.student.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not log in" })).toBeVisible();
  await expect(page).toHaveURL("/login");
});
