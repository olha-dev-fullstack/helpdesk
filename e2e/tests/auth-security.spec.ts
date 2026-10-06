import { expect, test } from "@playwright/test";
import { BASE_URL } from "../env";
import { API_URL, admin, agent, loginViaApi } from "./helpers";

const origin = { Origin: BASE_URL };

test.describe("auth hardening", () => {
  test("public sign-up is disabled", async ({ request }) => {
    const email = `signup-${Date.now()}@e2e.test`;
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: "a-long-enough-password", name: "Mallory" },
      headers: origin,
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    // And the account cannot be used to sign in
    const login = await request.post("/api/auth/sign-in/email", {
      data: { email, password: "a-long-enough-password" },
      headers: origin,
    });
    expect(login.ok()).toBe(false);
  });

  test("sign-up cannot be used to self-assign admin", async ({ request }) => {
    const email = `evil-${Date.now()}@e2e.test`;
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: "a-long-enough-password", name: "Evil", role: "admin" },
      headers: origin,
    });
    expect(res.ok()).toBe(false);
  });

  test("role supplied at sign-up is never honored", async ({ request }) => {
    // Independent of whether sign-up is disabled: if it works, role must still be agent
    const email = `evil-role-${Date.now()}@e2e.test`;
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: "a-long-enough-password", name: "Evil", role: "admin" },
      headers: origin,
    });
    if (res.ok()) {
      const body = await res.json();
      expect(body.user.role).not.toBe("admin");
    }
  });

  test("role cannot be changed from client input via update-user", async ({ page }) => {
    await loginViaApi(page, agent);
    const res = await page.request.post("/api/auth/update-user", {
      data: { name: "Still Agent", role: "admin" },
      headers: origin,
    });
    // Either the field is rejected or silently ignored; it must never apply
    void res;
    const session = await (await page.request.get("/api/auth/get-session")).json();
    expect(session.user.role).toBe("agent");
    expect((await page.request.get("/api/users")).status()).toBe(403);
  });

  test("role cannot be changed through the user-update with only role", async ({ page }) => {
    await loginViaApi(page, agent);
    await page.request.post("/api/auth/update-user", { data: { role: "admin" }, headers: origin });
    const session = await (await page.request.get("/api/auth/get-session")).json();
    expect(session.user.role).toBe("agent");
  });

  test("password minimum length is enforced on password change", async ({ page }) => {
    await loginViaApi(page, agent);
    const res = await page.request.post("/api/auth/change-password", {
      data: { currentPassword: agent.password, newPassword: "short", revokeOtherSessions: false },
      headers: origin,
    });
    expect(res.status()).toBe(400);
    // Old password still works
    const again = await page.request.post("/api/auth/sign-in/email", {
      data: agent,
      headers: origin,
    });
    expect(again.ok()).toBe(true);
  });

  test("password of exactly 11 chars is rejected, 12 is accepted, by the length rule", async ({ page }) => {
    await loginViaApi(page, agent);
    const tooShort = await page.request.post("/api/auth/change-password", {
      data: { currentPassword: agent.password, newPassword: "x".repeat(11) },
      headers: origin,
    });
    expect(tooShort.status()).toBe(400);
    const okLen = "y".repeat(12);
    const ok = await page.request.post("/api/auth/change-password", {
      data: { currentPassword: agent.password, newPassword: okLen },
      headers: origin,
    });
    expect(ok.ok()).toBe(true);
    // Restore original password so other tests stay independent
    const restore = await page.request.post("/api/auth/change-password", {
      data: { currentPassword: okLen, newPassword: agent.password },
      headers: origin,
    });
    expect(restore.ok()).toBe(true);
  });

  test("CORS allows the trusted origin with credentials", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`, { headers: origin });
    expect(res.headers()["access-control-allow-origin"]).toBe(BASE_URL);
    expect(res.headers()["access-control-allow-credentials"]).toBe("true");
  });

  test("CORS does not allow an untrusted origin", async ({ request }) => {
    const evil = "https://evil.example";
    const res = await request.get(`${API_URL}/api/health`, { headers: { Origin: evil } });
    expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
    const pre = await request.fetch(`${API_URL}/api/me`, {
      method: "OPTIONS",
      headers: { Origin: evil, "Access-Control-Request-Method": "GET" },
    });
    expect(pre.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("sign-in from an untrusted origin is rejected", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: admin,
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBeTruthy();
    expect(h["strict-transport-security"]).toBeTruthy();
    expect(h["content-security-policy"]).toBeTruthy();
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("security headers are present on auth and 401 responses too", async ({ request }) => {
    for (const path of ["/api/me", "/api/auth/get-session"]) {
      const res = await request.get(`${API_URL}${path}`);
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    }
  });

  test("session cookie is HttpOnly with SameSite", async ({ page }) => {
    await loginViaApi(page, admin);
    const cookie = (await page.context().cookies()).find((c) => c.name.includes("session_token"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("sign-in response does not leak the password hash", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", { data: admin, headers: origin });
    expect(res.ok()).toBe(true);
    expect(await res.text()).not.toMatch(/"password"/);
  });
});
