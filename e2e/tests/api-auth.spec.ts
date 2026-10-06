import { expect, test } from "@playwright/test";
import { API_URL, admin, agent, loginViaApi } from "./helpers";

test.describe("API authorization", () => {
  test("unauthenticated /api/me returns 401", async ({ request }) => {
    const res = await request.get("/api/me");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("unauthenticated /api/users returns 401", async ({ request }) => {
    expect((await request.get("/api/users")).status()).toBe(401);
  });

  test("unauthenticated unknown /api route returns 401, not 404", async ({ request }) => {
    expect((await request.get("/api/anything-else")).status()).toBe(401);
  });

  test("a garbage session cookie is rejected", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: API_URL });
    const res = await ctx.get("/api/me", {
      headers: { Cookie: "better-auth.session_token=garbage.value" },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("agent gets 403 on /api/users but 200 on /api/me", async ({ page }) => {
    await loginViaApi(page, agent);
    expect((await page.request.get("/api/me")).status()).toBe(200);
    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    // Other methods are guarded too
    expect((await page.request.delete("/api/users/abc")).status()).toBe(403);
  });

  test("admin gets past requireAdmin on /api/users", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/users");
    expect([401, 403]).not.toContain(res.status());
  });

  test("/api/me returns the user without secrets", async ({ page }) => {
    await loginViaApi(page, admin);
    const body = await (await page.request.get("/api/me")).json();
    expect(body.user.email).toBe(admin.email);
    expect(body.user.role).toBe("admin");
    expect(JSON.stringify(body)).not.toMatch(/password/i);
  });

  test("health endpoint is public", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });
});
