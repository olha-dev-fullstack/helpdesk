import { expect, test } from "@playwright/test";
import { admin, loginViaUi } from "./helpers";

async function submit(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectNoSession(page: import("@playwright/test").Page) {
  const res = await page.request.get("/api/auth/get-session");
  expect(await res.json()).toBeNull();
  expect((await page.context().cookies()).filter((c) => c.name.includes("session_token"))).toEqual([]);
  expect((await page.request.get("/api/me")).status()).toBe(401);
}

test.describe("login", () => {
  test("admin can sign in and lands on the home page", async ({ page }) => {
    await loginViaUi(page, admin);
    await expect(page.getByRole("heading", { name: "Welcome, Admin" })).toBeVisible();
    const session = await (await page.request.get("/api/auth/get-session")).json();
    expect(session.user.email).toBe(admin.email);
    expect(session.user.role).toBe("admin");
  });

  test("login page shows the form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  });

  test("wrong password shows an error and creates no session", async ({ page }) => {
    await submit(page, admin.email, "definitely-wrong-password");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expectNoSession(page);
  });

  test("unknown email shows the same generic error and creates no session", async ({ page }) => {
    await submit(page, "nobody@e2e.test", "some-password-123");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expectNoSession(page);
  });

  test("email is matched case-insensitively", async ({ page }) => {
    await submit(page, admin.email.toUpperCase(), admin.password);
    await expect(page).toHaveURL("/");
  });

  test("empty fields show validation errors and send no request", async ({ page }) => {
    let authCalls = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/sign-in")) authCalls++;
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await expect(page).toHaveURL("/login");
    expect(authCalls).toBe(0);
  });

  test("empty password only flags the password field", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toHaveCount(0);
  });

  for (const bad of ["not-an-email", "missing@tld", "@e2e.test", "a b@e2e.test"]) {
    test(`invalid email format "${bad}" is rejected client-side`, async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(bad);
      await page.getByLabel("Password").fill("whatever-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoSession(page);
    });
  }

  test("password is never exposed in the URL", async ({ page }) => {
    await submit(page, admin.email, "wrong-password-123");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    expect(page.url()).not.toContain("password");
    expect(page.url()).not.toContain("email=");
  });

  test("a failed attempt can be corrected and retried", async ({ page }) => {
    await submit(page, admin.email, "wrong-password-123");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await page.getByLabel("Password").fill(admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });
});
