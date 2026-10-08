import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { serverEnv } from "../env";
import { admin, agent, loginViaApi } from "./helpers";

const WEBHOOK = "/api/webhooks/inbound-email";
const secretHeader = { "x-webhook-secret": serverEnv.INBOUND_EMAIL_SECRET };
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type ApiTicket = {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  status: string;
  category: string | null;
  createdAt: string;
};

function payload(overrides: Record<string, unknown> = {}) {
  const id = unique();
  return {
    from: `tickets-${id}@example.com`,
    fromName: "Taylor Tester",
    subject: `Tickets spec ${id}`,
    text: "Secret body text that must not leak.",
    messageId: `<${id}@mail.example.com>`,
    ...overrides,
  };
}

async function createTicket(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const data = payload(overrides);
  const res = await request.post(WEBHOOK, { data, headers: secretHeader });
  expect(res.status()).toBe(201);
  const { id } = await res.json();
  return { ...data, id: id as string };
}

type TicketsResponse = {
  tickets: ApiTicket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function getPage(request: APIRequestContext, query = ""): Promise<TicketsResponse> {
  const res = await request.get(`/api/tickets${query}`);
  expect(res.status()).toBe(200);
  return res.json();
}

// Walks every page (pageSize=100) so the shared, growing test DB never hides own tickets
async function listTickets(request: APIRequestContext, query = "") {
  const all: ApiTicket[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    params.set("pageSize", "100");
    const body = await getPage(request, `?${params}`);
    all.push(...body.tickets);
    if (page >= body.totalPages) return all;
  }
}

// UI sort tests look for their own rows, which may fall outside any single page of the shared DB.
// The route merges every server page (same sort params) into one response, so the sort is still done by the server.
async function widenPageSize(page: Page) {
  await page.route("**/api/tickets?*", async (route) => {
    const tickets: ApiTicket[] = [];
    for (let n = 1; ; n++) {
      const url = new URL(route.request().url());
      url.searchParams.set("page", String(n));
      url.searchParams.set("pageSize", "100");
      const body = (await (await route.fetch({ url: url.toString() })).json()) as TicketsResponse;
      tickets.push(...body.tickets);
      if (n >= body.totalPages) {
        return route.fulfill({
          json: { tickets, total: tickets.length, page: 1, pageSize: 20, totalPages: 1 },
        });
      }
    }
  });
}

test.describe("tickets API", () => {
  test("lists tickets newest first", async ({ page }) => {
    const older = await createTicket(page.request);
    const newer = await createTicket(page.request);

    await loginViaApi(page, admin);
    const ids = (await listTickets(page.request)).map((t) => t.id);
    expect(ids).toContain(older.id);
    expect(ids).toContain(newer.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  test("returns the expected fields and never the body", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, admin);
    const ticket = (await listTickets(page.request)).find((t) => t.id === created.id);
    expect(ticket).toBeDefined();
    expect(Object.keys(ticket!).sort()).toEqual(
      ["category", "createdAt", "fromEmail", "fromName", "id", "status", "subject"],
    );
    expect(ticket).toMatchObject({
      subject: created.subject,
      fromEmail: created.from,
      fromName: created.fromName,
      status: "open",
      category: null,
    });
    expect(Number.isNaN(Date.parse(ticket!.createdAt))).toBe(false);
    expect(JSON.stringify(ticket)).not.toContain(created.text);
  });

  test("status=open includes new tickets, status=resolved and closed exclude them", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, admin);
    const open = await listTickets(page.request, "?status=open");
    expect(open.map((t) => t.id)).toContain(created.id);
    expect(open.every((t) => t.status === "open")).toBe(true);

    for (const status of ["resolved", "closed"]) {
      const others = await listTickets(page.request, `?status=${status}`);
      expect(others.map((t) => t.id)).not.toContain(created.id);
      expect(others.every((t) => t.status === status)).toBe(true);
    }
  });

  test("invalid status returns 400", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/tickets?status=bogus");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid status" });
  });

  test("an agent can list tickets", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, agent);
    const ids = (await listTickets(page.request)).map((t) => t.id);
    expect(ids).toContain(created.id);
  });
});

test.describe("tickets page", () => {
  test("shows the newest ticket above the older one", async ({ page }) => {
    const older = await createTicket(page.request);
    const newer = await createTicket(page.request);

    await loginViaApi(page, admin);
    await page.goto("/tickets");
    const rows = page.getByRole("row").filter({ hasText: /Tickets spec / });
    await expect(page.getByRole("row").filter({ hasText: newer.subject })).toHaveCount(1);
    await expect(page.getByRole("row").filter({ hasText: older.subject })).toHaveCount(1);

    const subjects = await rows.getByRole("cell").filter({ hasText: /^Tickets spec / }).allTextContents();
    expect(subjects.indexOf(newer.subject)).toBeGreaterThanOrEqual(0);
    expect(subjects.indexOf(newer.subject)).toBeLessThan(subjects.indexOf(older.subject));
  });

  test("sender cell shows name above email", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, admin);
    await page.goto("/tickets");
    const row = page.getByRole("row").filter({ hasText: created.subject });
    const sender = row.getByRole("cell").nth(1);
    await expect(sender).toContainText(created.fromName);
    await expect(sender).toContainText(created.from);
    const text = (await sender.innerText()).trim().split("\n").map((s) => s.trim()).filter(Boolean);
    expect(text).toEqual([created.fromName, created.from]);
  });

  test("sender shows Unknown when there is no name", async ({ page }) => {
    const created = await createTicket(page.request, { fromName: undefined });

    await loginViaApi(page, admin);
    await page.goto("/tickets");
    const sender = page.getByRole("row").filter({ hasText: created.subject }).getByRole("cell").nth(1);
    await expect(sender).toContainText("Unknown");
    await expect(sender).toContainText(created.from);
  });

  test("category shows a dash and created shows a date", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, admin);
    await page.goto("/tickets");
    const cells = page.getByRole("row").filter({ hasText: created.subject }).getByRole("cell");
    await expect(cells.nth(2)).toHaveText("—");
    await expect(cells.nth(3)).toHaveText("open");
    const createdText = (await cells.nth(4).innerText()).trim();
    expect(createdText).not.toBe("");
    expect(createdText).toMatch(/\d/);
    expect(createdText).not.toMatch(/invalid/i);
  });

  test("an agent can see the tickets page", async ({ page }) => {
    const created = await createTicket(page.request);

    await loginViaApi(page, agent);
    await page.goto("/tickets");
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: created.subject })).toHaveCount(1);
  });
});

async function createSortFixtures() {
  const prefix = `Sortspec${Date.now()}x${Math.random().toString(36).slice(2, 8)}`;
  return prefix;
}

async function seedSorted(request: APIRequestContext) {
  const prefix = await createSortFixtures();
  // Created out of alphabetical order on purpose
  const charlie = await createTicket(request, { subject: `${prefix} Charlie`, fromName: `${prefix} Zed` });
  const alpha = await createTicket(request, { subject: `${prefix} Alpha`, fromName: `${prefix} Alice` });
  const noName = await createTicket(request, { subject: `${prefix} Bravo`, fromName: undefined });
  return { prefix, alpha, charlie, noName };
}

function ownIds(tickets: ApiTicket[], prefix: string) {
  return tickets.filter((t) => t.subject.startsWith(prefix)).map((t) => t.id);
}

test.describe("tickets API sorting", () => {
  test("sortBy=subject sorts ascending and descending", async ({ page }) => {
    const { prefix, alpha, noName, charlie } = await seedSorted(page.request);
    await loginViaApi(page, admin);

    const asc = ownIds(await listTickets(page.request, "?sortBy=subject&order=asc"), prefix);
    expect(asc).toEqual([alpha.id, noName.id, charlie.id]);
    const desc = ownIds(await listTickets(page.request, "?sortBy=subject&order=desc"), prefix);
    expect(desc).toEqual([charlie.id, noName.id, alpha.id]);
  });

  test("sortBy=sender puts tickets without a name last in both directions", async ({ page }) => {
    const { prefix, alpha, noName, charlie } = await seedSorted(page.request);
    await loginViaApi(page, admin);

    const asc = ownIds(await listTickets(page.request, "?sortBy=sender&order=asc"), prefix);
    expect(asc).toEqual([alpha.id, charlie.id, noName.id]);
    const desc = ownIds(await listTickets(page.request, "?sortBy=sender&order=desc"), prefix);
    expect(desc).toEqual([charlie.id, alpha.id, noName.id]);
  });

  test("invalid sortBy returns 400", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/tickets?sortBy=bogus");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid sortBy" });
  });

  test("invalid order returns 400", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/tickets?sortBy=subject&order=sideways");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid order" });
  });

  test("default order is still newest first", async ({ page }) => {
    const { prefix, alpha, noName, charlie } = await seedSorted(page.request);
    await loginViaApi(page, admin);

    // Created order: charlie, alpha, noName -> newest first
    const ids = ownIds(await listTickets(page.request), prefix);
    expect(ids).toEqual([noName.id, alpha.id, charlie.id]);
    const explicit = ownIds(await listTickets(page.request, "?sortBy=createdAt&order=asc"), prefix);
    expect(explicit).toEqual([charlie.id, alpha.id, noName.id]);
  });

  test("unauthenticated requests with sort params get 401", async ({ request }) => {
    const res = await request.get("/api/tickets?sortBy=subject&order=asc");
    expect(res.status()).toBe(401);
  });
});

test.describe("tickets page sorting", () => {
  test("clicking Subject sorts ascending then descending via the server", async ({ page }) => {
    const { prefix, alpha, noName, charlie } = await seedSorted(page.request);
    await widenPageSize(page);
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    const header = (name: string) => page.getByRole("columnheader", { name });
    await expect(header("Created")).toHaveAttribute("aria-sort", "descending");
    await expect(header("Subject")).toHaveAttribute("aria-sort", "none");
    const rows = page.getByRole("row").filter({ hasText: prefix });
    await expect(rows).toHaveCount(3);

    const subjects = async () =>
      (await rows.getByRole("cell").filter({ hasText: /Alpha|Bravo|Charlie/ }).allTextContents()).map((s) => s.trim());

    const ascReq = page.waitForRequest(
      (r) => r.url().includes("/api/tickets") && r.url().includes("sortBy=subject&order=asc"),
    );
    await header("Subject").getByRole("button", { name: "Subject" }).click();
    await ascReq;
    await expect(header("Subject")).toHaveAttribute("aria-sort", "ascending");
    await expect(header("Created")).toHaveAttribute("aria-sort", "none");
    await expect(rows.first()).toContainText(alpha.subject);
    expect(await subjects()).toEqual([alpha.subject, noName.subject, charlie.subject]);

    const descReq = page.waitForRequest(
      (r) => r.url().includes("/api/tickets") && r.url().includes("sortBy=subject&order=desc"),
    );
    await header("Subject").getByRole("button", { name: "Subject" }).click();
    await descReq;
    await expect(header("Subject")).toHaveAttribute("aria-sort", "descending");
    await expect(rows.first()).toContainText(charlie.subject);
    expect(await subjects()).toEqual([charlie.subject, noName.subject, alpha.subject]);
  });

  test("clicking Created toggles from descending to ascending", async ({ page }) => {
    const { prefix, alpha, noName, charlie } = await seedSorted(page.request);
    await widenPageSize(page);
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    const created = page.getByRole("columnheader", { name: "Created" });
    await expect(created).toHaveAttribute("aria-sort", "descending");
    const rows = page.getByRole("row").filter({ hasText: prefix });
    await expect(rows.first()).toContainText(noName.subject);

    const req = page.waitForRequest(
      (r) => r.url().includes("/api/tickets") && r.url().includes("sortBy=createdAt&order=asc"),
    );
    await created.getByRole("button", { name: "Created" }).click();
    await req;
    await expect(created).toHaveAttribute("aria-sort", "ascending");
    await expect(rows.first()).toContainText(charlie.subject);
    await expect(rows.last()).toContainText(noName.subject);
    await expect(rows.nth(1)).toContainText(alpha.subject);
  });
});

async function seedMany(request: APIRequestContext, count: number) {
  const prefix = `Pagespec${Date.now()}x${Math.random().toString(36).slice(2, 8)}`;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push((await createTicket(request, { subject: `${prefix} #${i}` })).id);
  }
  return { prefix, ids };
}

test.describe("tickets API pagination", () => {
  test("default response has page 1, pageSize 20 and consistent totals", async ({ page }) => {
    await seedMany(page.request, 3);
    await loginViaApi(page, admin);
    const body = await getPage(page.request);
    expect(Object.keys(body).sort()).toEqual(["page", "pageSize", "total", "totalPages", "tickets"].sort());
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.tickets.length).toBeLessThanOrEqual(20);
    expect(body.totalPages).toBe(Math.max(1, Math.ceil(body.total / 20)));

    const all = await listTickets(page.request);
    expect(all).toHaveLength(body.total);
  });

  test("pageSize=5 returns at most 5 and page 2 does not overlap page 1", async ({ page }) => {
    await seedMany(page.request, 7);
    await loginViaApi(page, admin);
    const one = await getPage(page.request, "?pageSize=5&page=1");
    const two = await getPage(page.request, "?pageSize=5&page=2");
    expect(one.tickets).toHaveLength(5);
    expect(two.tickets.length).toBeGreaterThan(0);
    expect(two.tickets.length).toBeLessThanOrEqual(5);
    expect(two.page).toBe(2);
    expect(two.pageSize).toBe(5);
    const firstIds = new Set(one.tickets.map((t) => t.id));
    expect(two.tickets.some((t) => firstIds.has(t.id))).toBe(false);
  });

  test("walking all pages yields exactly total unique tickets", async ({ page }) => {
    await seedMany(page.request, 6);
    await loginViaApi(page, admin);
    const first = await getPage(page.request, "?pageSize=5");
    const ids: string[] = [];
    for (let p = 1; p <= first.totalPages; p++) {
      ids.push(...(await getPage(page.request, `?pageSize=5&page=${p}`)).tickets.map((t) => t.id));
    }
    expect(ids).toHaveLength(first.total);
    expect(new Set(ids).size).toBe(first.total);
  });

  test("walking pages with a non-unique sort key still never overlaps", async ({ page }) => {
    await seedMany(page.request, 6);
    await loginViaApi(page, admin);
    const first = await getPage(page.request, "?pageSize=5&sortBy=status&order=asc");
    const ids: string[] = [];
    for (let p = 1; p <= first.totalPages; p++) {
      ids.push(...(await getPage(page.request, `?pageSize=5&sortBy=status&order=asc&page=${p}`)).tickets.map((t) => t.id));
    }
    expect(new Set(ids).size).toBe(first.total);
    expect(ids).toHaveLength(first.total);
  });

  test("a page beyond the end is empty with the correct total", async ({ page }) => {
    await seedMany(page.request, 1);
    await loginViaApi(page, admin);
    const first = await getPage(page.request, "?pageSize=5");
    const beyond = await getPage(page.request, `?pageSize=5&page=${first.totalPages + 5}`);
    expect(beyond.tickets).toEqual([]);
    expect(beyond.total).toBe(first.total);
    expect(beyond.totalPages).toBe(first.totalPages);
  });

  test("total respects the status filter", async ({ page }) => {
    await seedMany(page.request, 1);
    await loginViaApi(page, admin);
    const open = await getPage(page.request, "?status=open&pageSize=5");
    const all = await getPage(page.request, "?pageSize=5");
    expect(open.total).toBeGreaterThan(0);
    expect(open.total).toBeLessThanOrEqual(all.total);
    expect(open.totalPages).toBe(Math.max(1, Math.ceil(open.total / 5)));
    expect(open.tickets.every((t) => t.status === "open")).toBe(true);

    const closed = await getPage(page.request, "?status=closed&pageSize=5");
    expect(closed.total).toBeLessThan(all.total);
    expect(closed.tickets.every((t) => t.status === "closed")).toBe(true);
  });

  for (const [query, error] of [
    ["page=0", "Invalid page"],
    ["page=-1", "Invalid page"],
    ["page=abc", "Invalid page"],
    ["page=1.5", "Invalid page"],
    ["pageSize=0", "Invalid pageSize"],
    ["pageSize=abc", "Invalid pageSize"],
    ["pageSize=101", "pageSize must be at most 100"],
  ] as const) {
    test(`${query} returns 400`, async ({ page }) => {
      await loginViaApi(page, admin);
      const res = await page.request.get(`/api/tickets?${query}`);
      expect(res.status()).toBe(400);
      expect(await res.json()).toEqual({ error });
    });
  }

  test("pageSize=100 is accepted", async ({ page }) => {
    await loginViaApi(page, admin);
    const body = await getPage(page.request, "?pageSize=100");
    expect(body.pageSize).toBe(100);
    expect(body.tickets.length).toBeLessThanOrEqual(100);
  });
});

test.describe("tickets page pagination", () => {
  const isTicketsRequest = (page: number) => (r: { url(): string }) => {
    const url = new URL(r.url());
    return url.pathname === "/api/tickets" && url.searchParams.get("page") === String(page);
  };

  test.beforeEach(async ({ page }) => {
    // Guarantees more than 20 tickets in total
    await seedMany(page.request, 25);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  });

  const pageLabel = (page: Page) => page.getByText(/^Page \d+ of \d+$/);
  const previous = (page: Page) => page.getByRole("button", { name: "Previous" });
  const next = (page: Page) => page.getByRole("button", { name: "Next" });
  const firstRowText = (page: Page) => page.getByRole("row").nth(1).innerText();

  test("footer shows page 1 of at least 2 with Previous disabled", async ({ page }) => {
    const [, total] = (await pageLabel(page).innerText()).match(/Page 1 of (\d+)/)!;
    expect(Number(total)).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(/^Showing 1–20 of \d+$/)).toBeVisible();
    await expect(previous(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await expect(page.getByRole("row")).toHaveCount(21); // header + 20
  });

  test("Next loads page 2 with different rows and Previous returns to page 1", async ({ page }) => {
    const firstRow = await firstRowText(page);
    const page1Rows = await page.getByRole("row").allInnerTexts();

    const req2 = page.waitForRequest(isTicketsRequest(2));
    await next(page).click();
    expect((await req2).url()).toContain("pageSize=20");
    await expect(pageLabel(page)).toHaveText(/^Page 2 of \d+$/);
    await expect(page.getByText(/^Showing 21–\d+ of \d+$/)).toBeVisible();
    await expect(previous(page)).toBeEnabled();
    await expect.poll(() => firstRowText(page)).not.toBe(firstRow);
    const page2Rows = await page.getByRole("row").allInnerTexts();
    expect(page2Rows.slice(1).filter((r) => page1Rows.includes(r))).toEqual([]);

    const req1 = page.waitForRequest(isTicketsRequest(1));
    await previous(page).click();
    await req1;
    await expect(pageLabel(page)).toHaveText(/^Page 1 of \d+$/);
    await expect(previous(page)).toBeDisabled();
    await expect.poll(() => firstRowText(page)).toBe(firstRow);
  });

  test("Next is disabled on the last page", async ({ page }) => {
    const [, total] = (await pageLabel(page).innerText()).match(/of (\d+)/)!;
    for (let p = 2; p <= Number(total); p++) {
      await next(page).click();
      await expect(pageLabel(page)).toHaveText(`Page ${p} of ${total}`);
    }
    await expect(next(page)).toBeDisabled();
    await expect(previous(page)).toBeEnabled();
  });

  test("changing the sort resets to page 1", async ({ page }) => {
    await next(page).click();
    await expect(pageLabel(page)).toHaveText(/^Page 2 of \d+$/);

    const req = page.waitForRequest(
      (r) => {
        const u = new URL(r.url());
        return u.pathname === "/api/tickets" && u.searchParams.get("sortBy") === "subject" && u.searchParams.get("page") === "1";
      },
    );
    await page.getByRole("columnheader", { name: "Subject" }).getByRole("button", { name: "Subject" }).click();
    await req;
    await expect(pageLabel(page)).toHaveText(/^Page 1 of \d+$/);
    await expect(previous(page)).toBeDisabled();
  });
});

const token = (label = "Srch") => `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const q = (params: Record<string, string | number>) => `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;

test.describe("tickets API search and category filter", () => {
  test("search by a unique subject token finds exactly that ticket", async ({ page }) => {
    const t = token();
    const target = await createTicket(page.request, { subject: `Subject ${t} here` });
    await createTicket(page.request);
    await loginViaApi(page, admin);

    const body = await getPage(page.request, q({ search: t }));
    expect(body.tickets.map((x) => x.id)).toEqual([target.id]);
    expect(body.total).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  test("search is case-insensitive", async ({ page }) => {
    const t = token("CaSeMiX");
    const target = await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);

    for (const term of [t.toLowerCase(), t.toUpperCase()]) {
      const body = await getPage(page.request, q({ search: term }));
      expect(body.tickets.map((x) => x.id)).toEqual([target.id]);
    }
  });

  test("search matches fromName, fromEmail and body", async ({ page }) => {
    const [nameT, mailT, bodyT] = [token("nm"), token("em").toLowerCase(), token("bd")];
    const byName = await createTicket(page.request, { fromName: `Name ${nameT}` });
    const byEmail = await createTicket(page.request, { from: `${mailT}@example.com` });
    const byBody = await createTicket(page.request, { text: `Please help with ${bodyT} thanks` });
    await loginViaApi(page, admin);

    for (const [term, expected] of [
      [nameT, byName],
      [mailT, byEmail],
      [bodyT, byBody],
    ] as const) {
      const body = await getPage(page.request, q({ search: term }));
      expect(body.tickets.map((x) => x.id)).toEqual([expected.id]);
    }
  });

  test("a body match never leaks the body in the response", async ({ page }) => {
    const t = token("bd");
    const created = await createTicket(page.request, { text: `Private ${t} content` });
    await loginViaApi(page, admin);
    const body = await getPage(page.request, q({ search: t }));
    expect(body.tickets).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(created.text);
  });

  test("percent in the search is matched literally", async ({ page }) => {
    const t = token();
    const literal = await createTicket(page.request, { subject: `${t}zz%zz` });
    await createTicket(page.request, { subject: `${t}zzAzz` });
    await loginViaApi(page, admin);

    const body = await getPage(page.request, q({ search: `${t}zz%zz` }));
    expect(body.tickets.map((x) => x.id)).toEqual([literal.id]);
    // A bare wildcard must not behave as "match everything with the token"
    const other = await getPage(page.request, q({ search: `${t}%` }));
    expect(other.total).toBe(0);
  });

  test("underscore in the search is matched literally", async ({ page }) => {
    const t = token();
    const literal = await createTicket(page.request, { subject: `${t}a_b` });
    await createTicket(page.request, { subject: `${t}aXb` });
    await loginViaApi(page, admin);

    const body = await getPage(page.request, q({ search: `${t}a_b` }));
    expect(body.tickets.map((x) => x.id)).toEqual([literal.id]);
  });

  test("backslash in the search is matched literally", async ({ page }) => {
    const t = token();
    const literal = await createTicket(page.request, { subject: `${t}zz\\zz` });
    await createTicket(page.request, { subject: `${t}zzzz` });
    await loginViaApi(page, admin);

    const body = await getPage(page.request, q({ search: `${t}zz\\zz` }));
    expect(body.tickets.map((x) => x.id)).toEqual([literal.id]);
  });

  test("empty and whitespace-only search do not filter", async ({ page }) => {
    await createTicket(page.request);
    await loginViaApi(page, admin);
    const unfiltered = await getPage(page.request);
    for (const search of ["", "   "]) {
      const body = await getPage(page.request, q({ search }));
      expect(body.total).toBe(unfiltered.total);
      expect(body.tickets.map((x) => x.id)).toEqual(unfiltered.tickets.map((x) => x.id));
    }
  });

  test("search is trimmed", async ({ page }) => {
    const t = token();
    const target = await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);
    const body = await getPage(page.request, q({ search: `  ${t}  ` }));
    expect(body.tickets.map((x) => x.id)).toEqual([target.id]);
  });

  test("search combines with status", async ({ page }) => {
    const t = token();
    const target = await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);

    const open = await getPage(page.request, q({ search: t, status: "open" }));
    expect(open.tickets.map((x) => x.id)).toEqual([target.id]);
    for (const status of ["resolved", "closed"]) {
      const none = await getPage(page.request, q({ search: t, status }));
      expect(none.tickets).toEqual([]);
      expect(none.total).toBe(0);
    }
  });

  test("search combines with pagination and sorting; total reflects the filtered set", async ({ page }) => {
    const t = token();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await createTicket(page.request, { subject: `${t} #${i}` })).id);
    await loginViaApi(page, admin);

    const p1 = await getPage(page.request, q({ search: t, pageSize: 2, page: 1 }));
    const p2 = await getPage(page.request, q({ search: t, pageSize: 2, page: 2 }));
    const p3 = await getPage(page.request, q({ search: t, pageSize: 2, page: 3 }));
    for (const p of [p1, p2, p3]) {
      expect(p.total).toBe(5);
      expect(p.totalPages).toBe(3);
    }
    expect([p1, p2, p3].map((p) => p.tickets.length)).toEqual([2, 2, 1]);
    // Newest first
    expect([...p1.tickets, ...p2.tickets, ...p3.tickets].map((x) => x.id)).toEqual([...ids].reverse());

    const asc = await getPage(page.request, q({ search: t, sortBy: "subject", order: "asc", pageSize: 5 }));
    expect(asc.tickets.map((x) => x.id)).toEqual(ids);
  });

  test("search with no results returns an empty list", async ({ page }) => {
    await loginViaApi(page, admin);
    const body = await getPage(page.request, q({ search: token("nomatch") }));
    expect(body).toMatchObject({ tickets: [], total: 0, totalPages: 1, page: 1 });
  });

  test("search of exactly 200 characters is accepted, 201 is rejected", async ({ page }) => {
    await loginViaApi(page, admin);
    const ok = await page.request.get(`/api/tickets${q({ search: "a".repeat(200) })}`);
    expect(ok.status()).toBe(200);
    const padded = await page.request.get(`/api/tickets${q({ search: ` ${"a".repeat(200)} ` })}`);
    expect(padded.status()).toBe(200);

    const tooLong = await page.request.get(`/api/tickets${q({ search: "a".repeat(201) })}`);
    expect(tooLong.status()).toBe(400);
    expect(await tooLong.json()).toEqual({ error: "search must be at most 200 characters" });
  });

  test("category=none includes new tickets", async ({ page }) => {
    const t = token();
    const target = await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);

    const none = await getPage(page.request, q({ category: "none", search: t }));
    expect(none.tickets.map((x) => x.id)).toEqual([target.id]);
    expect(none.tickets.every((x) => x.category === null)).toBe(true);
    const all = await listTickets(page.request, q({ category: "none" }));
    expect(all.map((x) => x.id)).toContain(target.id);
    expect(all.every((x) => x.category === null)).toBe(true);
  });

  test("real categories exclude unclassified tickets", async ({ page }) => {
    const t = token();
    await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);

    for (const category of ["general_question", "technical_question", "refund_request"]) {
      const body = await getPage(page.request, q({ category, search: t }));
      expect(body).toMatchObject({ tickets: [], total: 0, totalPages: 1 });
    }
  });

  test("invalid category returns 400", async ({ page }) => {
    await loginViaApi(page, admin);
    const res = await page.request.get("/api/tickets?category=bogus");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid category" });
  });

  test("unauthenticated search and category requests get 401", async ({ request }) => {
    expect((await request.get("/api/tickets?search=abc")).status()).toBe(401);
    expect((await request.get("/api/tickets?category=none")).status()).toBe(401);
  });
});

test.describe("tickets page search and filters", () => {
  const ticketsRequest = (match: (p: URLSearchParams) => boolean) => (r: { url(): string }) => {
    const u = new URL(r.url());
    return u.pathname === "/api/tickets" && match(u.searchParams);
  };
  const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search tickets" });
  const clear = (page: Page) => page.getByRole("button", { name: "Clear filters" });
  const noMatch = (page: Page) => page.getByText("No tickets match your filters.");

  async function choose(page: Page, combobox: string, option: string) {
    await page.getByRole("combobox", { name: combobox }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }

  test("typing a token filters the table with one debounced request", async ({ page }) => {
    const t = token();
    const target = await createTicket(page.request, { subject: `Subject ${t}` });
    await createTicket(page.request, { subject: `Other ${token()}` });
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(clear(page)).toBeHidden();

    const searches: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/tickets" && u.searchParams.has("search")) searches.push(u.searchParams.get("search")!);
    });
    const req = page.waitForRequest(ticketsRequest((p) => p.get("search") === t));
    await searchBox(page).pressSequentially(t, { delay: 30 });
    await req;

    await expect(page.getByRole("row")).toHaveCount(2); // header + the ticket
    await expect(page.getByRole("row").filter({ hasText: target.subject })).toHaveCount(1);
    await expect(clear(page)).toBeVisible();
    expect(searches).toEqual([t]);
  });

  test("the search request starts from page 1", async ({ page }) => {
    const t = token();
    await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    const req = page.waitForRequest(ticketsRequest((p) => p.get("search") === t));
    await searchBox(page).fill(t);
    expect(new URL((await req).url()).searchParams.get("page")).toBe("1");
  });

  test("a nonsense token shows the no-match message and Clear filters restores the list", async ({ page }) => {
    const anchor = await createTicket(page.request, { subject: `Subject ${token()}` });
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByRole("row").filter({ hasText: anchor.subject })).toHaveCount(1);

    await searchBox(page).fill(token("nomatch"));
    await expect(noMatch(page)).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await expect(searchBox(page)).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filter by status" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filter by category" })).toBeVisible();
    await expect(clear(page)).toBeVisible();

    await clear(page).click();
    await expect(searchBox(page)).toHaveValue("");
    await expect(clear(page)).toBeHidden();
    await expect(noMatch(page)).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: anchor.subject })).toHaveCount(1);
  });

  test("Clear filters also resets the select filters", async ({ page }) => {
    await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    await choose(page, "Filter by status", "Closed");
    await expect(noMatch(page)).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Filter by status" })).toContainText("Closed");

    await clear(page).click();
    await expect(page.getByRole("combobox", { name: "Filter by status" })).toContainText("All statuses");
    await expect(page.getByRole("combobox", { name: "Filter by category" })).toContainText("All categories");
    await expect(clear(page)).toBeHidden();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("selecting status Closed sends status=closed and shows no matches", async ({ page }) => {
    await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByRole("row").nth(1)).toBeVisible();

    const req = page.waitForRequest(ticketsRequest((p) => p.get("status") === "closed"));
    await choose(page, "Filter by status", "Closed");
    await req;
    await expect(noMatch(page)).toBeVisible();
    await expect(clear(page)).toBeVisible();
  });

  test("selecting category Uncategorized sends category=none and shows tickets", async ({ page }) => {
    const created = await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    const req = page.waitForRequest(ticketsRequest((p) => p.get("category") === "none"));
    await choose(page, "Filter by category", "Uncategorized");
    await req;
    await expect(page.getByRole("combobox", { name: "Filter by category" })).toContainText("Uncategorized");
    await expect(page.getByRole("row").filter({ hasText: created.subject })).toHaveCount(1);
    await expect(clear(page)).toBeVisible();
  });

  test("selecting a real category shows no matches for unclassified tickets", async ({ page }) => {
    await createTicket(page.request);
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    const req = page.waitForRequest(ticketsRequest((p) => p.get("category") === "refund_request"));
    await choose(page, "Filter by category", "Refund request");
    await req;
    await expect(noMatch(page)).toBeVisible();
  });

  test("search and status filters combine in one request", async ({ page }) => {
    const t = token();
    const created = await createTicket(page.request, { subject: `Subject ${t}` });
    await loginViaApi(page, admin);
    await page.goto("/tickets");

    await choose(page, "Filter by status", "Open");
    const req = page.waitForRequest(ticketsRequest((p) => p.get("search") === t && p.get("status") === "open"));
    await searchBox(page).fill(t);
    await req;
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: created.subject })).toHaveCount(1);
  });

  test("changing a filter from page 2 resets to page 1", async ({ page }) => {
    await seedMany(page.request, 25);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();

    const req = page.waitForRequest(ticketsRequest((p) => p.get("status") === "open" && p.get("page") === "1"));
    await choose(page, "Filter by status", "Open");
    await req;
    await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  test("changing the search from page 2 resets to page 1", async ({ page }) => {
    const { prefix } = await seedMany(page.request, 25);
    await loginViaApi(page, admin);
    await page.goto("/tickets");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();

    const req = page.waitForRequest(ticketsRequest((p) => p.get("search") === prefix && p.get("page") === "1"));
    await searchBox(page).fill(prefix);
    await req;
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByText(/^Showing 1–20 of 25$/)).toBeVisible();
  });
});
