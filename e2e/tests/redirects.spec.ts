import { expect, test } from "@playwright/test";
import { admin, loginViaApi, loginViaUi } from "./helpers";

test.describe("redirects", () => {
  test("logged-out visitor to / is sent to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("logged-out visitor to /users is sent to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("logged-in visitor to /login is sent to /", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });

  test("session persists across reload", async ({ page }) => {
    await loginViaUi(page, admin);
    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome, Admin" })).toBeVisible();
  });

  test("session is shared by a new tab in the same context", async ({ page, context }) => {
    await loginViaUi(page, admin);
    const other = await context.newPage();
    await other.goto("/users");
    await expect(other).toHaveURL("/users");
    await expect(other.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("unknown route does not expose protected content to logged-out visitors", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toHaveCount(0);
  });
});
