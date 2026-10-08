import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { ADMIN_EMAIL, AGENT_EMAIL, BASE_URL } from "../env";
import { admin, agent, loginViaApi, loginViaUi, sessionCount } from "./helpers";

test.describe("users list (UI)", () => {
  test("admin sees the table with column headers", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    for (const name of ["Name", "Email", "Role", "Created"]) {
      await expect(page.getByRole("columnheader", { name })).toBeVisible();
    }
  });

  test("admin sees rows for the seeded admin and agent with role badges", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/users");

    const adminRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
    await expect(adminRow).toHaveCount(1);
    await expect(adminRow.getByRole("cell", { name: "admin", exact: true })).toBeVisible();

    const agentRow = page.getByRole("row").filter({ hasText: AGENT_EMAIL });
    await expect(agentRow).toHaveCount(1);
    await expect(agentRow.getByRole("cell", { name: "agent", exact: true })).toBeVisible();
  });

  test("agent is redirected from /users to / and sees no user data", async ({ page }) => {
    await loginViaApi(page, agent);
    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(ADMIN_EMAIL)).toHaveCount(0);
  });
});

test.describe("GET /api/users", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    expect((await request.get("/api/users")).status()).toBe(401);
  });

  test("returns 403 for an agent", async ({ page }) => {
    await loginViaApi(page, agent);
    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain(ADMIN_EMAIL);
  });

  test("returns 200 for admin with only safe fields", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.users)).toBe(true);

    const emails = body.users.map((u: { email: string }) => u.email);
    expect(emails).toEqual(expect.arrayContaining([ADMIN_EMAIL, AGENT_EMAIL]));

    for (const user of body.users) {
      expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "name", "role"]);
      expect(["admin", "agent"]).toContain(user.role);
    }
    expect(JSON.stringify(body)).not.toMatch(/password|account|token|hash/i);
  });
});

const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
const VALID_PASSWORD = "correct-horse-battery";

test.describe("create user (UI)", () => {
  test("admin creates a user, dialog closes and row appears", async ({ page }) => {
    const email = uniqueEmail("ui-new");
    await loginViaApi(page, admin);
    await page.goto("/users");
    await page.getByRole("button", { name: "New user" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Name").fill("UI Created User");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill(VALID_PASSWORD);
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell", { name: "agent", exact: true })).toBeVisible();
  });

  test("shows client-side validation errors for short name and password", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/users");
    await page.getByRole("button", { name: "New user" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("ab");
    await dialog.getByLabel("Email").fill(uniqueEmail("ui-invalid"));
    await dialog.getByLabel("Password").fill("short");
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByText("Name must be at least 3 characters")).toBeVisible();
    await expect(dialog.getByText("Password must be at least 12 characters")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("created user can sign in through the login form", async ({ page, context }) => {
    const email = uniqueEmail("ui-login");
    await loginViaApi(page, admin);
    const res = await page.request.post("/api/users", {
      data: { name: "Login Check", email, password: VALID_PASSWORD },
    });
    expect(res.status()).toBe(201);
    await context.clearCookies();
    await loginViaUi(page, { email, password: VALID_PASSWORD });
  });
});

test.describe("POST /api/users", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("/api/users", {
      data: { name: "Nobody", email: uniqueEmail("anon"), password: VALID_PASSWORD },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 403 for an agent and creates nothing", async ({ page }) => {
    const email = uniqueEmail("by-agent");
    await loginViaApi(page, agent);
    const res = await page.request.post("/api/users", {
      data: { name: "Forbidden", email, password: VALID_PASSWORD },
    });
    expect(res.status()).toBe(403);

    await page.context().clearCookies();
    await loginViaApi(page, admin);
    const list = await (await page.request.get("/api/users")).json();
    expect(list.users.map((u: { email: string }) => u.email)).not.toContain(email);
  });

  test("admin creates an agent with lowercased email and safe fields", async ({ page }) => {
    const email = uniqueEmail("API-Mixed");
    await loginViaApi(page, admin);
    const res = await page.request.post("/api/users", {
      data: { name: "API Created", email, password: VALID_PASSWORD, role: "admin" },
    });
    expect(res.status()).toBe(201);
    const { user } = await res.json();
    expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "name", "role"]);
    expect(user.email).toBe(email.toLowerCase());
    expect(user.role).toBe("agent");
    expect(JSON.stringify(user)).not.toContain(VALID_PASSWORD);
  });

  test("created user can sign in via the API and is not an admin", async ({ page, playwright }) => {
    const email = uniqueEmail("signin");
    await loginViaApi(page, admin);
    expect(
      (
        await page.request.post("/api/users", {
          data: { name: "Sign In User", email, password: VALID_PASSWORD },
        })
      ).status(),
    ).toBe(201);

    const fresh = await playwright.request.newContext({ baseURL: BASE_URL });
    const signIn = await fresh.post("/api/auth/sign-in/email", {
      data: { email, password: VALID_PASSWORD },
      headers: { Origin: BASE_URL },
    });
    expect(signIn.ok()).toBe(true);
    expect((await fresh.get("/api/users")).status()).toBe(403);
    await fresh.dispose();
  });

  test("returns 409 for a duplicate email (case-insensitive)", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.post("/api/users", {
      data: { name: "Duplicate", email: AGENT_EMAIL.toUpperCase(), password: VALID_PASSWORD },
    });
    expect(res.status()).toBe(409);
  });

  test("returns 400 for invalid payloads", async ({ page }) => {
    await loginViaApi(page, admin);
    const valid = { name: "Valid Name", email: uniqueEmail("bad"), password: VALID_PASSWORD };
    const cases = [
      { ...valid, name: "ab" },
      { ...valid, email: "not-an-email" },
      { ...valid, password: "short" },
      { name: "Only Name" },
    ];
    for (const data of cases) {
      const res = await page.request.post("/api/users", { data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
    }
  });
});

type ApiUser = { id: string; name: string; email: string; role: string };

async function createUser(page: Page, prefix: string, name = "Throwaway User") {
  const email = uniqueEmail(prefix);
  const res = await page.request.post("/api/users", {
    data: { name, email, password: VALID_PASSWORD },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).user as ApiUser;
}

async function signInStatus(playwright: PlaywrightWorkerArgs["playwright"], email: string, password: string) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/sign-in/email", {
    data: { email, password },
    headers: { Origin: BASE_URL },
  });
  const status = res.status();
  await ctx.dispose();
  return status;
}

const uniqueName = (base: string) => `${base} ${Math.random().toString(36).slice(2, 8)}`;
const MISSING_ID = "does-not-exist-id";

test.describe("edit user (UI)", () => {
  test("admin edits a user and the row updates", async ({ page }) => {
    await loginViaApi(page, admin);
    const name = uniqueName("Before Edit");
    const user = await createUser(page, "ui-edit", name);
    const newEmail = uniqueEmail("ui-edited");

    await page.goto("/users");
    await page.getByRole("button", { name: `Edit ${name}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name")).toHaveValue(name);
    await expect(dialog.getByLabel("Email")).toHaveValue(user.email);
    await expect(dialog.getByLabel("Password")).toHaveAttribute("placeholder", "Unchanged");

    await dialog.getByLabel("Name").fill(`After ${name}`);
    await dialog.getByLabel("Email").fill(newEmail);
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: newEmail });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell", { name: `After ${name}`, exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: user.email })).toHaveCount(0);
  });

  test("shows validation errors and keeps the dialog open", async ({ page }) => {
    await loginViaApi(page, admin);
    const name = uniqueName("Invalid Edit");
    await createUser(page, "ui-edit-invalid", name);
    await page.goto("/users");
    await page.getByRole("button", { name: `Edit ${name}` }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("ab");
    await dialog.getByLabel("Password").fill("short");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog.getByText("Name must be at least 3 characters")).toBeVisible();
    await expect(dialog.getByText("Password must be at least 12 characters")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("shows an error when the email belongs to another user", async ({ page }) => {
    await loginViaApi(page, admin);
    const name = uniqueName("Dup Edit");
    await createUser(page, "ui-edit-dup", name);
    await page.goto("/users");
    await page.getByRole("button", { name: `Edit ${name}` }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill(AGENT_EMAIL);
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog.getByText("A user with this email already exists")).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});

test.describe("delete user (UI)", () => {
  test("confirming removes the row", async ({ page }) => {
    await loginViaApi(page, admin);
    const name = uniqueName("Delete Me");
    const user = await createUser(page, "ui-del", name);
    await page.goto("/users");
    await expect(page.getByRole("row").filter({ hasText: user.email })).toHaveCount(1);

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(user.email)).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: user.email })).toHaveCount(0);
  });

  test("cancelling keeps the row", async ({ page }) => {
    await loginViaApi(page, admin);
    const name = uniqueName("Keep Me");
    const user = await createUser(page, "ui-del-cancel", name);
    await page.goto("/users");

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: user.email })).toHaveCount(1);
  });
});

test.describe("PATCH /api/users/:id", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.patch(`/api/users/${MISSING_ID}`, {
      data: { name: "Nobody", email: uniqueEmail("anon-patch") },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 403 for an agent and changes nothing", async ({ page }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "patch-by-agent", "Untouched User");
    await page.context().clearCookies();
    await loginViaApi(page, agent);

    const res = await page.request.patch(`/api/users/${user.id}`, {
      data: { name: "Hacked Name", email: user.email },
    });
    expect(res.status()).toBe(403);

    await page.context().clearCookies();
    await loginViaApi(page, admin);
    const list = (await (await page.request.get("/api/users")).json()).users as ApiUser[];
    expect(list.find((u) => u.id === user.id)?.name).toBe("Untouched User");
  });

  test("admin updates name and email (lowercased) and keeps the password", async ({
    page,
    playwright,
  }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "patch-ok", "Patch Me");
    const email = uniqueEmail("Patched-Mixed");

    for (const body of [{ name: "Patched Name", email }, { name: "Patched Name", email, password: "" }]) {
      const res = await page.request.patch(`/api/users/${user.id}`, { data: body });
      expect(res.status()).toBe(200);
      const { user: updated } = await res.json();
      expect(updated.id).toBe(user.id);
      expect(updated.name).toBe("Patched Name");
      expect(updated.email).toBe(email.toLowerCase());
      expect(JSON.stringify(updated)).not.toMatch(/password/i);
    }
    expect(await signInStatus(playwright, email, VALID_PASSWORD)).toBe(200);
  });

  test("changing the password invalidates sessions and the new password works", async ({
    page,
    playwright,
  }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "patch-pw", "Credential Rotation");

    const victim = await playwright.request.newContext({ baseURL: BASE_URL });
    const signIn = await victim.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: VALID_PASSWORD },
      headers: { Origin: BASE_URL },
    });
    expect(signIn.ok()).toBe(true);
    expect(await sessionCount(victim)).toBe(1);

    const newPassword = "another-long-password-1";
    const res = await page.request.patch(`/api/users/${user.id}`, {
      data: { name: user.name, email: user.email, password: newPassword },
    });
    expect(res.status()).toBe(200);

    expect(await sessionCount(victim)).toBe(0);
    await victim.dispose();
    expect(await signInStatus(playwright, user.email, VALID_PASSWORD)).not.toBe(200);
    expect(await signInStatus(playwright, user.email, newPassword)).toBe(200);
  });

  test("returns 400 for invalid payloads", async ({ page }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "patch-bad", "Bad Payload");
    const valid = { name: "Valid Name", email: uniqueEmail("patch-bad-new") };
    const cases = [
      { ...valid, name: "ab" },
      { ...valid, email: "not-an-email" },
      { ...valid, password: "short" },
      { name: "Only Name" },
    ];
    for (const data of cases) {
      const res = await page.request.patch(`/api/users/${user.id}`, { data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
    }
  });

  test("returns 404 for an unknown id", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.patch(`/api/users/${MISSING_ID}`, {
      data: { name: "Ghost User", email: uniqueEmail("ghost") },
    });
    expect(res.status()).toBe(404);
  });

  test("returns 409 when the email belongs to another user", async ({ page }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "patch-409", "Conflict User");
    const res = await page.request.patch(`/api/users/${user.id}`, {
      data: { name: user.name, email: AGENT_EMAIL.toUpperCase() },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe("DELETE /api/users/:id", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    expect((await request.delete(`/api/users/${MISSING_ID}`)).status()).toBe(401);
  });

  test("returns 403 for an agent and deletes nothing", async ({ page }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "del-by-agent", "Survivor User");
    await page.context().clearCookies();
    await loginViaApi(page, agent);

    expect((await page.request.delete(`/api/users/${user.id}`)).status()).toBe(403);

    await page.context().clearCookies();
    await loginViaApi(page, admin);
    const list = (await (await page.request.get("/api/users")).json()).users as ApiUser[];
    expect(list.map((u) => u.id)).toContain(user.id);
  });

  test("admin deletes a user with 204 and they can no longer sign in", async ({
    page,
    playwright,
  }) => {
    await loginViaApi(page, admin);
    const user = await createUser(page, "del-ok", "Doomed User");
    expect(await signInStatus(playwright, user.email, VALID_PASSWORD)).toBe(200);

    expect((await page.request.delete(`/api/users/${user.id}`)).status()).toBe(204);

    expect(await signInStatus(playwright, user.email, VALID_PASSWORD)).not.toBe(200);
    const list = (await (await page.request.get("/api/users")).json()).users as ApiUser[];
    expect(list.map((u) => u.id)).not.toContain(user.id);
  });

  test("returns 404 for an unknown id", async ({ page }) => {
    await loginViaApi(page, admin);
    expect((await page.request.delete(`/api/users/${MISSING_ID}`)).status()).toBe(404);
  });

  test("returns 400 when an admin deletes their own account", async ({ page }) => {
    await loginViaApi(page, admin);
    const list = (await (await page.request.get("/api/users")).json()).users as ApiUser[];
    const self = list.find((u) => u.email === ADMIN_EMAIL)!;
    expect((await page.request.delete(`/api/users/${self.id}`)).status()).toBe(400);

    const after = (await (await page.request.get("/api/users")).json()).users as ApiUser[];
    expect(after.map((u) => u.id)).toContain(self.id);
  });
});
