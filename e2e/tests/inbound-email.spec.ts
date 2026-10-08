import { expect, test } from "@playwright/test";
import { serverEnv } from "../env";
import { admin, loginViaApi } from "./helpers";

const URL = "/api/webhooks/inbound-email";
const secretHeader = { "x-webhook-secret": serverEnv.INBOUND_EMAIL_SECRET };
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function payload(overrides: Record<string, unknown> = {}) {
  const id = unique();
  return {
    from: `customer-${id}@example.com`,
    fromName: "Casey Customer",
    subject: `Printer broken ${id}`,
    text: "Help, my printer is on fire.",
    messageId: `<${id}@mail.example.com>`,
    ...overrides,
  };
}

test.describe("inbound email webhook", () => {
  test("returns 401 without a secret", async ({ request }) => {
    const res = await request.post(URL, { data: payload() });
    expect(res.status()).toBe(401);
  });

  test("returns 401 with a wrong secret", async ({ request }) => {
    const res = await request.post(URL, {
      data: payload(),
      headers: { "x-webhook-secret": "wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("creates a ticket with the right secret (201)", async ({ request }) => {
    const res = await request.post(URL, { data: payload(), headers: secretHeader });
    expect(res.status()).toBe(201);
    expect(typeof (await res.json()).id).toBe("string");
  });

  test("repeated messageId returns the same id and creates one ticket", async ({ page }) => {
    const data = payload();
    const first = await page.request.post(URL, { data, headers: secretHeader });
    expect(first.status()).toBe(201);
    const { id } = await first.json();

    const second = await page.request.post(URL, { data, headers: secretHeader });
    expect(second.status()).toBe(200);
    expect((await second.json()).id).toBe(id);

    await loginViaApi(page, admin);
    const { tickets } = await (await page.request.get("/api/tickets")).json();
    expect(tickets.filter((t: { fromEmail: string }) => t.fromEmail === data.from)).toHaveLength(1);
  });

  test("invalid from returns 400", async ({ request }) => {
    const res = await request.post(URL, {
      data: payload({ from: "not-an-email" }),
      headers: secretHeader,
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("tickets", () => {
  test("GET /api/tickets returns 401 when unauthenticated", async ({ request }) => {
    expect((await request.get("/api/tickets")).status()).toBe(401);
  });

  test("a posted ticket appears on the Tickets page for admin", async ({ page }) => {
    const data = payload();
    const res = await page.request.post(URL, { data, headers: secretHeader });
    expect(res.status()).toBe(201);

    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
    for (const name of ["Subject", "Sender", "Category", "Status", "Created"]) {
      await expect(page.getByRole("columnheader", { name })).toBeVisible();
    }
    const row = page.getByRole("row").filter({ hasText: data.subject });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(data.fromName);
    await expect(row).toContainText(data.from);
    await expect(row).toContainText("Open");
  });

  test("Tickets link in the nav bar opens the page", async ({ page }) => {
    await loginViaApi(page, admin);
    await page.goto("/");
    await page.getByRole("link", { name: "Tickets" }).click();
    await expect(page).toHaveURL("/tickets");
  });
});
