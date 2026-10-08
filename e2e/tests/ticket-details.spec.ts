import { expect, test, type APIRequestContext } from "@playwright/test";
import { serverEnv } from "../env";
import { admin, agent, loginViaApi } from "./helpers";

const WEBHOOK = "/api/webhooks/inbound-email";
const secretHeader = { "x-webhook-secret": serverEnv.INBOUND_EMAIL_SECRET };
const unique = () => `${Date.now()}x${Math.random().toString(36).slice(2, 10)}`;

async function createTicket(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const id = unique();
  const data = {
    from: `details-${id}@example.com`,
    fromName: "Dana Detail",
    subject: `Details spec ${id}`,
    text: "First line\nSecond line\n\nFourth line after blank",
    messageId: `<${id}@mail.example.com>`,
    ...overrides,
  };
  const res = await request.post(WEBHOOK, { data, headers: secretHeader });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { ...data, id: body.id as string, token: id };
}

test.describe("ticket details API", () => {
  test("returns the full ticket including body and null assignee", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);

    const res = await page.request.get(`/api/tickets/${created.id}`);
    expect(res.status()).toBe(200);
    const { ticket } = await res.json();
    expect(ticket).toMatchObject({
      id: created.id,
      subject: created.subject,
      fromEmail: created.from,
      fromName: "Dana Detail",
      status: "open",
      category: null,
      bodyHtml: created.text,
      assignedTo: null,
    });
    expect(Number.isNaN(Date.parse(ticket.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(ticket.updatedAt))).toBe(false);
  });

  test("returns the body exactly, with special characters unchanged", async ({ page }) => {
    const text = "Line 1\n  indented <script>alert(1)</script>\n& \"quotes\" 'single'\n\nend";
    const created = await createTicket(page.request, { text });
    await loginViaApi(page, admin);

    const { ticket } = await (await page.request.get(`/api/tickets/${created.id}`)).json();
    expect(ticket.bodyHtml).toBe(text);
  });

  test("an agent can read a ticket", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, agent);

    const res = await page.request.get(`/api/tickets/${created.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).ticket.id).toBe(created.id);
  });

  test("unknown id returns 404", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/tickets/does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "Ticket not found" });
  });

  test("unauthenticated request returns 401", async ({ page }) => {
    const created = await createTicket(page.request);
    const res = await page.request.get(`/api/tickets/${created.id}`);
    expect(res.status()).toBe(401);
  });
});

test.describe("ticket details page", () => {
  test("opens from the list and shows all details", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await page.getByLabel("Search tickets").fill(created.token);

    await page.getByRole("link", { name: created.subject }).click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${created.id}$`));

    await expect(page.getByRole("heading", { level: 1, name: created.subject })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).locator("..").getByText("Open", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Ticket status" })).toContainText("Open");
    await expect(page.getByText("Dana Detail")).toBeVisible();
    await expect(page.getByText(created.from)).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Assign ticket" })).toContainText("Unassigned");
    await expect(page.getByRole("combobox", { name: "Ticket category" })).toContainText("Uncategorized");
    await expect(page.getByText("Message", { exact: true })).toBeVisible();
    await expect(page.getByText("First line")).toBeVisible();
    await expect(page.getByText("Second line")).toBeVisible();
    await expect(page.getByText("Fourth line after blank")).toBeVisible();
  });

  test("preserves line breaks in the message", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${created.id}`);

    const message = page.getByText("First line");
    await expect(message).toBeVisible();
    await expect(message).toHaveCSS("white-space", "pre-wrap");
    expect(await message.evaluate((el) => (el as HTMLElement).innerText)).toBe(created.text);
  });

  test("back link returns to the tickets list", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${created.id}`);

    await page.getByRole("link", { name: "Back to tickets" }).click();
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
  });

  test("shows Unknown when the sender has no name", async ({ page }) => {
    const created = await createTicket(page.request, { fromName: undefined });
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${created.id}`);

    await expect(page.getByRole("heading", { level: 1, name: created.subject })).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true })).toBeVisible();
    await expect(page.getByText(created.from)).toBeVisible();
  });

  test("direct navigation and reload keep working", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, agent);
    await page.goto(`/tickets/${created.id}`);
    await expect(page.getByRole("heading", { level: 1, name: created.subject })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/tickets/${created.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: created.subject })).toBeVisible();
  });

  test("unknown ticket shows a not found message and the back link", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/tickets/does-not-exist");

    await expect(page.getByRole("alert").filter({ hasText: "Ticket not found." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to tickets" })).toHaveAttribute("href", "/tickets");
  });

  test("shows a loading skeleton while the ticket loads", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(`**/api/tickets/${created.id}`, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto(`/tickets/${created.id}`);
    await expect(page.getByLabel("Loading ticket")).toBeVisible();
    release();
    await expect(page.getByRole("heading", { level: 1, name: created.subject })).toBeVisible();
    await expect(page.getByLabel("Loading ticket")).toHaveCount(0);
  });

  test("unauthenticated visit redirects to login", async ({ page }) => {
    const created = await createTicket(page.request);
    await page.goto(`/tickets/${created.id}`);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("HTML in the body is shown literally", async ({ page }) => {
    const created = await createTicket(page.request, { text: "Hello <b>x</b> and <script>window.__xss=1</script>" });
    await loginViaApi(page, admin);
    await page.goto(`/tickets/${created.id}`);

    await expect(page.getByText("Hello <b>x</b> and <script>window.__xss=1</script>")).toBeVisible();
    await expect(page.locator("main b, p b")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});
