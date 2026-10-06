import { expect, test } from "@playwright/test";
import { API_URL, admin, loginViaUi } from "./helpers";

test.describe("sign-out", () => {
  test("Sign out button ends the session and redirects to /login", async ({ page }) => {
    await loginViaUi(page, admin);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("protected pages are inaccessible after sign-out", async ({ page }) => {
    await loginViaUi(page, admin);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    for (const path of ["/", "/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/login");
    }
  });

  test("the old session cookie is invalid after sign-out", async ({ page, playwright }) => {
    await loginViaUi(page, admin);
    const cookies = await page.context().cookies();
    const token = cookies.find((c) => c.name.includes("session_token"));
    expect(token).toBeTruthy();
    const cookieHeader = `${token!.name}=${token!.value}`;

    const stolen = await playwright.request.newContext({ baseURL: API_URL });
    // Sanity check: the cookie works before sign-out
    expect((await stolen.get("/api/me", { headers: { Cookie: cookieHeader } })).status()).toBe(200);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");

    const session = await stolen.get("/api/auth/get-session", { headers: { Cookie: cookieHeader } });
    expect(await session.json()).toBeNull();
    expect((await stolen.get("/api/me", { headers: { Cookie: cookieHeader } })).status()).toBe(401);
    expect((await stolen.get("/api/users", { headers: { Cookie: cookieHeader } })).status()).toBe(401);
    await stolen.dispose();
  });

  test("back button does not restore access after sign-out", async ({ page }) => {
    await loginViaUi(page, admin);
    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/users");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goBack();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL("/login");
  });

  test("signing out via API invalidates the session", async ({ page }) => {
    await loginViaUi(page, admin);
    const res = await page.request.post("/api/auth/sign-out", {
      data: {},
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(res.ok()).toBe(true);
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("signing out one session does not break another login of the same user", async ({ page, browser }) => {
    await loginViaUi(page, admin);
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await loginViaUi(other, admin);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await other.reload();
    await expect(other).toHaveURL("/");
    await ctx.close();
  });
});
