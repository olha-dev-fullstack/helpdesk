import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { serverEnv } from "../env";
import { admin, agent, loginViaApi } from "./helpers";

const WEBHOOK = "/api/webhooks/inbound-email";
const secretHeader = { "x-webhook-secret": serverEnv.INBOUND_EMAIL_SECRET };
const unique = () => `${Date.now()}x${Math.random().toString(36).slice(2, 10)}`;

async function createTicket(request: APIRequestContext) {
  const id = unique();
  const data = {
    from: `updates-${id}@example.com`,
    fromName: "Uma Update",
    subject: `Updates spec ${id}`,
    text: "Please update me.",
    messageId: `<${id}@mail.example.com>`,
  };
  const res = await request.post(WEBHOOK, { data, headers: secretHeader });
  expect(res.status()).toBe(201);
  return { ...data, id: (await res.json()).id as string, token: id };
}

async function getTicket(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/tickets/${id}`);
  expect(res.status()).toBe(200);
  return (await res.json()).ticket;
}

// Searching by the unique token keeps the shared, growing DB from hiding the ticket
async function listIds(request: APIRequestContext, token: string, query: string) {
  const res = await request.get(`/api/tickets?search=${token}&pageSize=100&${query}`);
  expect(res.status()).toBe(200);
  return ((await res.json()).tickets as { id: string }[]).map((t) => t.id);
}

const statusBox = (page: Page) => page.getByRole("combobox", { name: "Ticket status" });
const categoryBox = (page: Page) => page.getByRole("combobox", { name: "Ticket category" });
const patch = (page: Page, id: string, data: unknown) => page.request.patch(`/api/tickets/${id}`, { data });

test.describe("update ticket API", () => {
  test("sets status to resolved, closed and open, visible via GET and the list filter", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);

    for (const status of ["resolved", "closed", "open"]) {
      const res = await patch(page, t.id, { status });
      expect(res.status()).toBe(200);
      expect((await res.json()).ticket).toMatchObject({ id: t.id, status, subject: t.subject, body: t.text });
      expect((await getTicket(page.request, t.id)).status).toBe(status);
      expect(await listIds(page.request, t.token, `status=${status}`)).toContain(t.id);
      for (const other of ["open", "resolved", "closed"].filter((s) => s !== status)) {
        expect(await listIds(page.request, t.token, `status=${other}`)).not.toContain(t.id);
      }
    }
  });

  test("sets each category and clears it with null, visible via the category filters", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    expect(await listIds(page.request, t.token, "category=none")).toContain(t.id);

    for (const category of ["general_question", "technical_question", "refund_request"]) {
      const res = await patch(page, t.id, { category });
      expect(res.status()).toBe(200);
      expect((await res.json()).ticket.category).toBe(category);
      expect((await getTicket(page.request, t.id)).category).toBe(category);
      expect(await listIds(page.request, t.token, `category=${category}`)).toContain(t.id);
      expect(await listIds(page.request, t.token, "category=none")).not.toContain(t.id);
    }

    const res = await patch(page, t.id, { category: null });
    expect(res.status()).toBe(200);
    expect((await res.json()).ticket.category).toBeNull();
    expect(await listIds(page.request, t.token, "category=none")).toContain(t.id);
    expect(await listIds(page.request, t.token, "category=refund_request")).not.toContain(t.id);
  });

  test("updates several fields in one PATCH and changes updatedAt", async ({ page }) => {
    const t = await createTicket(page.request);
    const agentSession = await (async () => {
      await loginViaApi(page, agent);
      return (await (await page.request.get("/api/auth/get-session")).json()).user as { id: string; name: string };
    })();
    const before = await getTicket(page.request, t.id);

    const res = await patch(page, t.id, {
      status: "resolved",
      category: "technical_question",
      assignedToId: agentSession.id,
      ignoredField: "whatever",
    });
    expect(res.status()).toBe(200);
    const { ticket } = await res.json();
    expect(ticket).toMatchObject({
      status: "resolved",
      category: "technical_question",
      assignedTo: { id: agentSession.id, name: agentSession.name },
    });
    expect(ticket.updatedAt).not.toBe(before.updatedAt);
    expect(await getTicket(page.request, t.id)).toMatchObject({
      status: "resolved",
      category: "technical_question",
      assignedTo: { id: agentSession.id },
    });
  });

  test("a body with only status leaves category and assignee untouched", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, agent);
    await patch(page, t.id, { category: "refund_request" });
    const res = await patch(page, t.id, { status: "closed" });
    expect(res.status()).toBe(200);
    expect((await res.json()).ticket).toMatchObject({ status: "closed", category: "refund_request", assignedTo: null });
  });

  test("rejects an empty body and bodies with only unknown fields", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    for (const data of [{}, { foo: "bar" }]) {
      const res = await patch(page, t.id, data);
      expect(res.status()).toBe(400);
      expect(await res.json()).toEqual({ error: "Provide status, category or assignedToId" });
    }
  });

  test("rejects invalid values and changes nothing", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    const cases: [unknown, string][] = [
      [{ status: "bogus" }, "Invalid status"],
      [{ status: "" }, "Invalid status"],
      [{ status: null }, "Invalid status"],
      [{ status: 1 }, "Invalid status"],
      [{ category: "bogus" }, "Invalid category"],
      [{ category: "none" }, "Invalid category"],
      [{ category: 3 }, "Invalid category"],
      [{ assignedToId: "" }, "Invalid assignedToId"],
      [{ assignedToId: 7 }, "Invalid assignedToId"],
      [{ status: "resolved", category: "bogus" }, "Invalid category"],
    ];
    for (const [data, error] of cases) {
      const res = await patch(page, t.id, data);
      expect(res.status(), JSON.stringify(data)).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    expect(await getTicket(page.request, t.id)).toMatchObject({ status: "open", category: null, assignedTo: null });
  });

  test("malformed JSON returns 400", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    const res = await page.request.patch(`/api/tickets/${t.id}`, {
      data: "{not json",
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  test("a body over 256kb returns 413", async ({ page }) => {
    const res = await page.request.post(WEBHOOK, {
      data: { from: "big@example.com", subject: "Big", text: "x".repeat(300 * 1024), messageId: `<${unique()}@mail.example.com>` },
      headers: secretHeader,
    });
    expect(res.status()).toBe(413);
    expect(await res.json()).toEqual({ error: "Request body too large" });
  });

  test("unknown ticket returns 404 and unauthenticated returns 401", async ({ page }) => {
    const t = await createTicket(page.request);
    const anon = await patch(page, t.id, { status: "closed" });
    expect(anon.status()).toBe(401);

    await loginViaApi(page, admin);
    const res = await patch(page, "does-not-exist", { status: "closed" });
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "Ticket not found" });
    expect((await getTicket(page.request, t.id)).status).toBe("open");
  });
});

test.describe("update ticket UI", () => {
  const isPatch = (id: string) => (req: { method(): string; url(): string }) =>
    req.method() === "PATCH" && req.url().endsWith(`/api/tickets/${id}`);

  test("shows the current status and category", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);
    await expect(statusBox(page)).toContainText("Open");
    await expect(categoryBox(page)).toContainText("Uncategorized");
  });

  test("changes status, updates the badge and persists after reload", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);
    const badge = page.getByRole("heading", { level: 1 }).locator("..").locator('[data-slot="badge"]').first();
    await expect(badge).toHaveText("Open");

    await statusBox(page).click();
    await expect(page.getByRole("option")).toHaveText(["Open", "Resolved", "Closed"]);
    const req = page.waitForRequest(isPatch(t.id));
    await page.getByRole("option", { name: "Resolved" }).click();
    expect((await req).postDataJSON()).toEqual({ status: "resolved" });
    await expect(statusBox(page)).toContainText("Resolved");
    await expect(badge).toHaveText("Resolved");

    await page.reload();
    await expect(statusBox(page)).toContainText("Resolved");
    await expect(badge).toHaveText("Resolved");
    expect((await getTicket(page.request, t.id)).status).toBe("resolved");
  });

  test("changes category, clears it with Uncategorized and persists", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, agent);
    await page.goto(`/tickets/${t.id}`);

    await categoryBox(page).click();
    await expect(page.getByRole("option")).toHaveText([
      "General Question",
      "Technical Question",
      "Refund Request",
      "Uncategorized",
    ]);
    const req = page.waitForRequest(isPatch(t.id));
    await page.getByRole("option", { name: "Refund Request" }).click();
    expect((await req).postDataJSON()).toEqual({ category: "refund_request" });
    await expect(categoryBox(page)).toContainText("Refund Request");

    await page.reload();
    await expect(categoryBox(page)).toContainText("Refund Request");

    await categoryBox(page).click();
    const clear = page.waitForRequest(isPatch(t.id));
    await page.getByRole("option", { name: "Uncategorized" }).click();
    expect((await clear).postDataJSON()).toEqual({ category: null });
    await expect(categoryBox(page)).toContainText("Uncategorized");
    await page.reload();
    await expect(categoryBox(page)).toContainText("Uncategorized");
    expect((await getTicket(page.request, t.id)).category).toBeNull();
  });

  test("shows the server message when an update fails", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);
    await page.route(`**/api/tickets/${t.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({ status: 400, json: { error: "Invalid status" } });
    });
    await statusBox(page).click();
    await page.getByRole("option", { name: "Closed" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid status" })).toBeVisible();
    await expect(statusBox(page)).toContainText("Open");
  });

  test("details page puts the dropdowns in the Manage ticket card, not the Message card", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);

    const manage = page.locator('[data-slot="card"]').filter({ has: page.getByText("Manage ticket", { exact: true }) });
    const message = page.locator('[data-slot="card"]').filter({ has: page.getByText("Message", { exact: true }) });
    for (const name of ["Ticket status", "Ticket category", "Assign ticket"]) {
      await expect(manage.getByRole("combobox", { name })).toBeVisible();
      await expect(message.getByRole("combobox", { name })).toHaveCount(0);
    }
    await expect(page.getByRole("combobox")).toHaveCount(3);
    await expect(message).toContainText(t.text);
  });

  test("badges show title-cased status and category on the details page and the list", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);
    const badges = page.getByRole("heading", { level: 1 }).locator("..").locator('[data-slot="badge"]');

    // Unclassified: only the status badge, category shown as a dash
    await expect(badges).toHaveText(["Open"]);
    await expect(badges.first().locator("..")).toHaveText("Open—");

    await categoryBox(page).click();
    await page.getByRole("option", { name: "Technical Question" }).click();
    await expect(badges).toHaveText(["Open", "Technical Question"]);
    await statusBox(page).click();
    await page.getByRole("option", { name: "Closed" }).click();
    await expect(badges).toHaveText(["Closed", "Technical Question"]);

    await page.goto("/tickets");
    await page.getByLabel("Search tickets").fill(t.token);
    const cells = page.getByRole("row").filter({ hasText: t.subject }).getByRole("cell");
    await expect(cells.nth(2)).toHaveText("Technical Question");
    await expect(cells.nth(3)).toHaveText("Closed");
    await expect(cells.nth(2).locator('[data-slot="badge"]')).toHaveCount(1);
    await expect(cells.nth(3).locator('[data-slot="badge"]')).toHaveCount(1);
  });

  test("an unclassified ticket shows a dash, not a badge, in the list category cell", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await page.getByLabel("Search tickets").fill(t.token);
    const cell = page.getByRole("row").filter({ hasText: t.subject }).getByRole("cell").nth(2);
    await expect(cell).toHaveText("—");
    await expect(cell).not.toContainText("Uncategorized");
    await expect(cell.locator('[data-slot="badge"]')).toHaveCount(0);
  });

  test("status dropdown renders the value and options as badges, Uncategorized as plain text", async ({ page }) => {
    const t = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${t.id}`);
    const badge = '[data-slot="badge"]';

    await expect(statusBox(page).locator(badge)).toHaveText("Open");
    await statusBox(page).click();
    for (const name of ["Open", "Resolved", "Closed"]) {
      await expect(page.getByRole("option", { name }).locator(badge)).toHaveCount(1);
    }
    await page.keyboard.press("Escape");

    await categoryBox(page).click();
    await expect(page.getByRole("option", { name: "Uncategorized" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Uncategorized" }).locator(badge)).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Refund Request" }).locator(badge)).toHaveCount(1);
  });
});
