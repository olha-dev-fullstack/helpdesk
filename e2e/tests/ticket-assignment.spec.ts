import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { AGENT_NAME, serverEnv } from "../env";
import { admin, agent, loginViaApi } from "./helpers";

const WEBHOOK = "/api/webhooks/inbound-email";
const secretHeader = { "x-webhook-secret": serverEnv.INBOUND_EMAIL_SECRET };
const unique = () => `${Date.now()}x${Math.random().toString(36).slice(2, 10)}`;

type Assignee = { id: string; name: string };

async function createTicket(request: APIRequestContext) {
  const id = unique();
  const data = {
    from: `assign-${id}@example.com`,
    fromName: "Alex Assign",
    subject: `Assignment spec ${id}`,
    text: "Please assign me.",
    messageId: `<${id}@mail.example.com>`,
  };
  const res = await request.post(WEBHOOK, { data, headers: secretHeader });
  expect(res.status()).toBe(201);
  return { ...data, id: (await res.json()).id as string };
}

async function getAssignees(request: APIRequestContext): Promise<Assignee[]> {
  const res = await request.get("/api/tickets/assignees");
  expect(res.status()).toBe(200);
  return (await res.json()).assignees;
}

async function findByEmail(page: Page, who: typeof admin | typeof agent) {
  await loginViaApi(page, who);
  const session = await (await page.request.get("/api/auth/get-session")).json();
  return session.user as { id: string; name: string };
}

async function getTicket(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/tickets/${id}`);
  expect(res.status()).toBe(200);
  return (await res.json()).ticket;
}

test.describe("assignees API", () => {
  test("lists only agents (not admins), sorted by name", async ({ page }) => {
    const adminUser = await findByEmail(page, admin);
    const agentUser = await findByEmail(page, agent);

    const assignees = await getAssignees(page.request);
    expect(assignees.map((a) => a.id)).not.toContain(adminUser.id);
    expect(assignees).toContainEqual({ id: agentUser.id, name: agentUser.name });
    for (const a of assignees) expect(Object.keys(a).sort()).toEqual(["id", "name"]);

    const names = assignees.map((a) => a.name);
    expect(names).toEqual([...names].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });

  test("is available to agents and is not treated as a ticket id", async ({ page }) => {
    await loginViaApi(page, agent);
    const res = await page.request.get("/api/tickets/assignees");
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).assignees)).toBe(true);
  });

  test("unauthenticated request returns 401", async ({ page }) => {
    expect((await page.request.get("/api/tickets/assignees")).status()).toBe(401);
  });
});

test.describe("assign ticket API", () => {
  test("assigns to the agent, unassigns, with persistence", async ({ page }) => {
    const ticket = await createTicket(page.request);
    const agentUser = await findByEmail(page, agent);
    await loginViaApi(page, admin);

    const before = await getTicket(page.request, ticket.id);
    expect(before.assignedTo).toBeNull();

    let res = await page.request.patch(`/api/tickets/${ticket.id}`, { data: { assignedToId: agentUser.id } });
    expect(res.status()).toBe(200);
    let body = (await res.json()).ticket;
    expect(body).toMatchObject({
      id: ticket.id,
      subject: ticket.subject,
      fromEmail: ticket.from,
      bodyHtml: ticket.text,
      assignedTo: { id: agentUser.id, name: agentUser.name },
    });
    expect(body.updatedAt).not.toBe(before.updatedAt);
    expect((await getTicket(page.request, ticket.id)).assignedTo).toEqual({
      id: agentUser.id,
      name: agentUser.name,
    });

    const assigned = body.updatedAt;
    res = await page.request.patch(`/api/tickets/${ticket.id}`, { data: { assignedToId: null } });
    expect(res.status()).toBe(200);
    body = (await res.json()).ticket;
    expect(body.assignedTo).toBeNull();
    expect(body.updatedAt).not.toBe(assigned);
    expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
  });

  test("an agent can assign a ticket", async ({ page }) => {
    const ticket = await createTicket(page.request);
    const agentUser = await findByEmail(page, agent);

    const res = await page.request.patch(`/api/tickets/${ticket.id}`, { data: { assignedToId: agentUser.id } });
    expect(res.status()).toBe(200);
    expect((await res.json()).ticket.assignedTo).toEqual({ id: agentUser.id, name: agentUser.name });
  });

  test("the ticket still appears in the list after assignment", async ({ page }) => {
    const ticket = await createTicket(page.request);
    const agentUser = await findByEmail(page, agent);
    await page.request.patch(`/api/tickets/${ticket.id}`, { data: { assignedToId: agentUser.id } });

    const res = await page.request.get("/api/tickets", { params: { search: ticket.subject } });
    expect(res.status()).toBe(200);
    const { tickets } = await res.json();
    expect(tickets.map((t: { id: string }) => t.id)).toContain(ticket.id);
  });

  test.describe("validation", () => {
    const cases: [string, unknown, string][] = [
      ["an empty body", {}, "Provide status, category or assignedToId"],
      ["assignedToId of wrong type (number)", { assignedToId: 5 }, "Invalid assignedToId"],
      ["assignedToId of wrong type (boolean)", { assignedToId: true }, "Invalid assignedToId"],
      ["empty string assignedToId", { assignedToId: "" }, "Invalid assignedToId"],
    ];

    for (const [name, data, message] of cases) {
      test(`rejects ${name}`, async ({ page }) => {
        const ticket = await createTicket(page.request);
        await loginViaApi(page, admin);
        const res = await page.request.patch(`/api/tickets/${ticket.id}`, { data });
        expect(res.status()).toBe(400);
        expect((await res.json()).error).toBe(message);
        expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
      });
    }

    test("rejects a non-object JSON body", async ({ page }) => {
      const ticket = await createTicket(page.request);
      await loginViaApi(page, admin);
      const res = await page.request.patch(`/api/tickets/${ticket.id}`, { data: [] });
      expect(res.status()).toBe(400);
    });

    test("rejects a missing body", async ({ page }) => {
      const ticket = await createTicket(page.request);
      await loginViaApi(page, admin);
      const res = await page.request.patch(`/api/tickets/${ticket.id}`);
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("Provide status, category or assignedToId");
    });

    test("rejects assigning to an admin", async ({ page }) => {
      const ticket = await createTicket(page.request);
      const adminUser = await findByEmail(page, admin);
      const res = await page.request.patch(`/api/tickets/${ticket.id}`, {
        data: { assignedToId: adminUser.id },
      });
      expect(res.status()).toBe(400);
      expect(await res.json()).toEqual({ error: "Tickets can only be assigned to agents" });
      expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
    });

    test("rejects an unknown assignee", async ({ page }) => {
      const ticket = await createTicket(page.request);
      await loginViaApi(page, admin);
      const res = await page.request.patch(`/api/tickets/${ticket.id}`, {
        data: { assignedToId: "no-such-user" },
      });
      expect(res.status()).toBe(400);
      expect(await res.json()).toEqual({ error: "Assignee not found" });
      expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
    });

    test("unknown ticket returns 404", async ({ page }) => {
      const agentUser = await findByEmail(page, agent);
      const res = await page.request.patch("/api/tickets/does-not-exist", {
        data: { assignedToId: agentUser.id },
      });
      expect(res.status()).toBe(404);
      expect(await res.json()).toEqual({ error: "Ticket not found" });
    });

    test("unauthenticated request returns 401 and changes nothing", async ({ page }) => {
      const ticket = await createTicket(page.request);
      const adminUser = await findByEmail(page, admin);
      await page.context().clearCookies();
      const res = await page.request.patch(`/api/tickets/${ticket.id}`, {
        data: { assignedToId: adminUser.id },
      });
      expect(res.status()).toBe(401);

      await loginViaApi(page, admin);
      expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
    });
  });
});

test.describe("assign ticket UI", () => {
  const trigger = (page: Page) => page.getByRole("combobox", { name: "Assign ticket" });
  const isAssignPatch = (id: string) => (req: { method(): string; url(): string }) =>
    req.method() === "PATCH" && req.url().endsWith(`/api/tickets/${id}`);

  test("assigns to the agent, persists after reload, then unassigns", async ({ page }) => {
    const ticket = await createTicket(page.request);
    const agentUser = await findByEmail(page, agent);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${ticket.id}`);

    await expect(trigger(page)).toContainText("Unassigned");
    await trigger(page).click();
    const options = page.getByRole("option");
    await expect(options.first()).toHaveText("Unassigned");
    await expect(options.filter({ hasText: AGENT_NAME })).toHaveCount(1);

    const requestPromise = page.waitForRequest(isAssignPatch(ticket.id));
    await options.filter({ hasText: AGENT_NAME }).click();
    expect((await requestPromise).postDataJSON()).toEqual({ assignedToId: agentUser.id });
    await expect(trigger(page)).toContainText(AGENT_NAME);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: ticket.subject })).toBeVisible();
    await expect(trigger(page)).toContainText(AGENT_NAME);

    await trigger(page).click();
    const unassignRequest = page.waitForRequest(isAssignPatch(ticket.id));
    await page.getByRole("option", { name: "Unassigned" }).click();
    expect((await unassignRequest).postDataJSON()).toEqual({ assignedToId: null });
    await expect(trigger(page)).toContainText("Unassigned");

    await page.reload();
    await expect(trigger(page)).toContainText("Unassigned");
    expect((await getTicket(page.request, ticket.id)).assignedTo).toBeNull();
  });

  test("an agent can assign a ticket", async ({ page }) => {
    const ticket = await createTicket(page.request);
    const agentUser = await findByEmail(page, agent);
    await page.goto(`/tickets/${ticket.id}`);

    await trigger(page).click();
    await page.getByRole("option", { name: AGENT_NAME }).click();
    await expect(trigger(page)).toContainText(AGENT_NAME);
    expect((await getTicket(page.request, ticket.id)).assignedTo.id).toBe(agentUser.id);
  });

  test("shows the server message when assignment fails", async ({ page }) => {
    const ticket = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${ticket.id}`);
    await page.route(`**/api/tickets/${ticket.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({ status: 400, json: { error: "Assignee not found" } });
    });

    await trigger(page).click();
    await page.getByRole("option", { name: AGENT_NAME }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Assignee not found" })).toBeVisible();
    await expect(trigger(page)).toContainText("Unassigned");
  });
});
