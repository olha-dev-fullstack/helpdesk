import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios, { type AxiosError } from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketDetailsPage from "./TicketDetailsPage";

vi.mock("axios");

const ticket = {
  id: "abc",
  subject: "Cannot log in",
  body: "I reset my password twice.\nStill failing.",
  fromEmail: "ann@example.com",
  fromName: "Ann",
  status: "open",
  category: "technical_question",
  assignedTo: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};

const assignees = [
  { id: "u1", name: "Alex Agent" },
  { id: "u2", name: "Blair Agent" },
];

/** Routes GETs by URL so the assignee list and the ticket don't share one mock. */
function mockApi(ticketResult: unknown) {
  vi.mocked(axios.get).mockImplementation((url: string) =>
    url === "/api/tickets/assignees"
      ? Promise.resolve({ data: { assignees } })
      : ticketResult instanceof Error
        ? Promise.reject(ticketResult)
        : ticketResult instanceof Promise
          ? ticketResult
          : Promise.resolve({ data: { ticket: ticketResult } }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/tickets/abc"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data: {} },
  });
}

describe("TicketDetailsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The module is auto-mocked, so give the type guard the real behavior the hook relies on
    vi.mocked(axios.isAxiosError).mockImplementation(
      (err: unknown): err is AxiosError => !!err && typeof err === "object" && "isAxiosError" in err,
    );
  });

  it("shows a loading state while fetching", () => {
    mockApi(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading ticket")).toBeInTheDocument();
  });

  it("shows the ticket's subject, sender, status, category and message", async () => {
    mockApi(ticket);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Cannot log in" })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/api/tickets/abc");
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("ann@example.com")).toBeInTheDocument();
    // Each also appears in its dropdown in the "Manage ticket" column
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.getAllByText("Technical Question")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Assign ticket" })).toHaveTextContent(
      "Unassigned",
    );
    expect(screen.getByText(/I reset my password twice\./)).toBeInTheDocument();
  });

  it("shows Unknown when the sender has no name", async () => {
    mockApi({ ...ticket, fromName: null, category: null });
    renderPage();

    expect(await screen.findByText("Unknown")).toBeInTheDocument();
  });

  it("links back to the tickets list", async () => {
    mockApi(ticket);
    renderPage();

    expect(screen.getByRole("link", { name: "Back to tickets" })).toHaveAttribute(
      "href",
      "/tickets",
    );
  });

  it("shows a not-found message for a 404", async () => {
    mockApi(httpError(404));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found.");
  });

  it("shows an error for other failures", async () => {
    mockApi(httpError(500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load ticket");
  });

  describe("assigning", () => {
    async function openMenu() {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("combobox", { name: "Assign ticket" }));
      return user;
    }

    it("lists the staff and assigns the chosen person", async () => {
      mockApi(ticket);
      vi.mocked(axios.patch).mockResolvedValue({ data: { ticket } });
      const user = await openMenu();

      expect(await screen.findByRole("option", { name: "Blair Agent" })).toBeInTheDocument();
      await user.click(screen.getByRole("option", { name: "Alex Agent" }));

      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith("/api/tickets/abc", { assignedToId: "u1" }),
      );
    });

    it("shows the current assignee and can unassign", async () => {
      mockApi({ ...ticket, assignedTo: assignees[1] });
      vi.mocked(axios.patch).mockResolvedValue({ data: { ticket } });
      const user = await openMenu();

      expect(screen.getByRole("combobox", { name: "Assign ticket" })).toHaveTextContent(
        "Blair Agent",
      );
      await user.click(await screen.findByRole("option", { name: "Unassigned" }));

      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith("/api/tickets/abc", { assignedToId: null }),
      );
    });

    it("shows the server's error when assigning fails", async () => {
      mockApi(ticket);
      vi.mocked(axios.patch).mockRejectedValue(
        Object.assign(new Error("bad"), {
          isAxiosError: true,
          response: { status: 400, data: { error: "Assignee not found" } },
        }),
      );
      const user = await openMenu();
      await user.click(await screen.findByRole("option", { name: "Alex Agent" }));

      expect(await screen.findByText("Assignee not found")).toBeInTheDocument();
    });
  });

  describe("updating status and category", () => {
    it("changes the status", async () => {
      mockApi(ticket);
      vi.mocked(axios.patch).mockResolvedValue({ data: { ticket } });
      const user = userEvent.setup();
      renderPage();

      const select = await screen.findByRole("combobox", { name: "Ticket status" });
      expect(select).toHaveTextContent("Open");
      await user.click(select);
      await user.click(await screen.findByRole("option", { name: "Resolved" }));

      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith("/api/tickets/abc", { status: "resolved" }),
      );
    });

    it("changes the category and can clear it", async () => {
      mockApi(ticket);
      vi.mocked(axios.patch).mockResolvedValue({ data: { ticket } });
      const user = userEvent.setup();
      renderPage();

      const select = await screen.findByRole("combobox", { name: "Ticket category" });
      expect(select).toHaveTextContent("Technical Question");
      await user.click(select);
      await user.click(await screen.findByRole("option", { name: "Refund Request" }));
      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith("/api/tickets/abc", {
          category: "refund_request",
        }),
      );

      await user.click(select);
      await user.click(await screen.findByRole("option", { name: "Uncategorized" }));
      await waitFor(() =>
        expect(axios.patch).toHaveBeenLastCalledWith("/api/tickets/abc", { category: null }),
      );
    });

    it("shows the server's error when an update fails", async () => {
      mockApi(ticket);
      vi.mocked(axios.patch).mockRejectedValue(
        Object.assign(new Error("bad"), {
          isAxiosError: true,
          response: { status: 400, data: { error: "Invalid status" } },
        }),
      );
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("combobox", { name: "Ticket status" }));
      await user.click(await screen.findByRole("option", { name: "Closed" }));

      expect(await screen.findByText("Invalid status")).toBeInTheDocument();
    });
  });
});
