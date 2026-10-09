import { expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  BASE_URL,
  SERVER_PORT,
} from "../env";

export const API_URL = `http://localhost:${SERVER_PORT}`;
export const admin = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
export const agent = { email: AGENT_EMAIL, password: AGENT_PASSWORD };

type Credentials = { email: string; password: string };

/** Signs in through the real login form. */
export async function loginViaUi(page: Page, { email, password }: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/** Signs in through the API (fast path for tests not about the login form). */
export async function loginViaApi(page: Page, { email, password }: Credentials) {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password },
    headers: { Origin: BASE_URL },
  });
  expect(res.ok()).toBe(true);
}

/** Hits the server directly (no cookies, no Vite proxy) with a fresh context. */
export async function sessionCount(request: APIRequestContext) {
  const res = await request.get("/api/auth/get-session");
  const body = await res.json();
  return body ? 1 : 0;
}

/**
 * Waits until the inbound-email job has moved tickets out of new/processing.
 * Uses its own admin session so the caller's cookies (e.g. a logged-out page) stay untouched.
 */
export async function waitForTicketsSettled(ids: string[]) {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const login = await ctx.post("/api/auth/sign-in/email", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { Origin: BASE_URL },
    });
    expect(login.ok()).toBe(true);
    for (const id of ids) {
      await expect
        .poll(async () => (await (await ctx.get(`/api/tickets/${id}`)).json()).ticket?.status, { timeout: 60_000 })
        .not.toMatch(/^(new|processing)$/);
    }
  } finally {
    await ctx.dispose();
  }
}

export const waitForTicketSettled = (id: string) => waitForTicketsSettled([id]);
