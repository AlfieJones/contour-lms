import { test, expect, login, logout, showBookings } from "./fixtures";

test("student books a consultation, staff can see it, and student cancels it", async ({
  page,
  accounts,
}) => {
  const reason = "E2E student consultation";
  await login(page, accounts.student);
  await page.getByRole("button", { name: "New consultation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "30 minutes", exact: true }).click();
  await dialog.getByLabel("Teacher", { exact: true }).click();
  await page.getByRole("option", { name: accounts.teacher.email, exact: true }).click();
  await dialog
    .getByRole("group", { name: "Consultation time" })
    .getByRole("button")
    .first()
    .click();
  await dialog.getByRole("textbox", { name: "Discussion notes" }).fill(reason);
  await dialog.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Booking confirmed", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await showBookings(page);
  const booking = page.getByRole("row").filter({ hasText: reason });
  await expect(booking).toContainText("Scheduled");

  await logout(page);
  await login(page, accounts.teacher);
  await expect(booking).toContainText(accounts.student.name);
  await logout(page);
  await login(page, accounts.admin);
  await page.goto("/admin/consultations");
  await expect(booking).toContainText(accounts.teacher.email);

  await logout(page);
  await login(page, accounts.student);
  await booking.getByRole("button", { name: "Consultation actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancel booking", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel consultation", exact: true })
    .click();
  await expect(booking).toContainText("Cancelled");
  await page.reload();
  await showBookings(page);
  await expect(booking).toContainText("Cancelled");
});

test("teacher books a consultation for an enrolled student", async ({ page, accounts }) => {
  const reason = "E2E teacher consultation";
  await login(page, accounts.teacher);
  await page.getByRole("button", { name: "New consultation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "30 minutes", exact: true }).click();
  await dialog
    .getByRole("group", { name: "Consultation time" })
    .getByRole("button")
    .first()
    .click();
  await dialog.getByLabel("Student", { exact: true }).click();
  await page
    .getByRole("option", {
      name: `${accounts.student.name} · ${accounts.student.email}`,
      exact: true,
    })
    .click();
  await dialog.getByRole("textbox", { name: "Discussion notes" }).fill(reason);
  await dialog.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Booking confirmed", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await showBookings(page);
  await expect(page.getByRole("row").filter({ hasText: reason })).toContainText("Scheduled");
  await logout(page);
  await login(page, accounts.student);
  await expect(page.getByRole("row").filter({ hasText: reason })).toContainText(
    accounts.teacher.email,
  );
});
