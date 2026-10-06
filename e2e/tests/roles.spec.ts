import { expect, test } from "@playwright/test";
import { AGENT_NAME } from "../env";
import { admin, agent, loginViaApi, loginViaUi } from "./helpers";

test.describe("admin-only access (UI)", () => {
  test("admin sees the Users link and can open /users", async ({ page }) => {
    await loginViaUi(page, admin);
    const link = page.getByRole("link", { name: "Users" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("admin can open /users directly and after reload", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("agent can sign in and does not see the Users link", async ({ page }) => {
    await loginViaUi(page, agent);
    await expect(page.getByRole("heading", { name: `Welcome, ${AGENT_NAME}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });

  test("agent is redirected from /users to /", async ({ page }) => {
    await loginViaApi(page, agent);
    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
  });

  test("agent session reports role agent", async ({ page }) => {
    await loginViaApi(page, agent);
    const session = await (await page.request.get("/api/auth/get-session")).json();
    expect(session.user.role).toBe("agent");
  });
});
