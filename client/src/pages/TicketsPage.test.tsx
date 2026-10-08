import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketsPage from "./TicketsPage";

vi.mock("axios");

const tickets = [
  {
    id: "1",
    subject: "Cannot log in",
    fromEmail: "ann@example.com",
    fromName: "Ann",
    status: "open",
    category: "technical_question",
    createdAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "2",
    subject: "Refund please",
    fromEmail: "bob@example.com",
    fromName: null,
    status: "resolved",
    category: null,
    createdAt: "2026-02-01T10:00:00.000Z",
  },
];

function pageOf(items: typeof tickets, total = items.length, totalPages = 1) {
  return { data: { tickets: items, total, page: 1, pageSize: 20, totalPages } };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TicketsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("TicketsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the heading and a loading state while fetching", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading tickets")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row for each ticket with subject, sender and status", async () => {
    vi.mocked(axios.get).mockResolvedValue(pageOf(tickets));
    renderPage();

    const table = await screen.findByRole("table");
    expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", order: "desc", page: 1, pageSize: 20 },
    });

    const first = within(table).getByRole("row", { name: /Cannot log in/ });
    expect(within(first).getByText("Ann")).toBeInTheDocument();
    expect(within(first).getByText("ann@example.com")).toBeInTheDocument();
    expect(within(first).getByText("Technical question")).toBeInTheDocument();
    expect(within(first).getByText("open")).toBeInTheDocument();

    const second = within(table).getByRole("row", { name: /Refund please/ });
    expect(within(second).getByText("bob@example.com")).toBeInTheDocument();
    expect(within(second).getByText("resolved")).toBeInTheDocument();
    // No sender name or category yet
    expect(within(second).getByText("Unknown")).toBeInTheDocument();
    expect(within(second).getByText("—")).toBeInTheDocument();

    for (const header of [
      "Subject",
      "Sender",
      "Category",
      "Status",
      "Created",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
  });

  it("links each subject to its ticket details page", async () => {
    vi.mocked(axios.get).mockResolvedValue(pageOf(tickets));
    renderPage();

    expect(await screen.findByRole("link", { name: "Cannot log in" })).toHaveAttribute(
      "href",
      "/tickets/1",
    );
    expect(screen.getByRole("link", { name: "Refund please" })).toHaveAttribute(
      "href",
      "/tickets/2",
    );
  });

  it("shows an empty message when there are no tickets", async () => {
    vi.mocked(axios.get).mockResolvedValue(pageOf([]));
    renderPage();

    expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Request failed"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load tickets",
    );
  });

  describe("sorting", () => {
    const reversed = [...tickets].reverse();

    async function renderLoaded() {
      vi.mocked(axios.get).mockResolvedValue(pageOf(tickets));
      renderPage();
      return screen.findByRole("table");
    }

    it("marks Created as sorted descending by default", async () => {
      const table = await renderLoaded();

      expect(
        within(table).getByRole("columnheader", { name: "Created" }),
      ).toHaveAttribute("aria-sort", "descending");
      expect(
        within(table).getByRole("columnheader", { name: "Subject" }),
      ).toHaveAttribute("aria-sort", "none");
    });

    it("requests the server to sort when a header is clicked and shows its order", async () => {
      const table = await renderLoaded();
      vi.mocked(axios.get).mockResolvedValue(pageOf(reversed));

      fireEvent.click(within(table).getByRole("button", { name: "Subject" }));

      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "subject", order: "asc", page: 1, pageSize: 20 },
        }),
      );
      await waitFor(() =>
        expect(
          within(screen.getByRole("table")).getAllByRole("row")[1],
        ).toHaveTextContent("Refund please"),
      );
      expect(
        screen.getByRole("columnheader", { name: "Subject" }),
      ).toHaveAttribute("aria-sort", "ascending");
    });

    it("toggles to descending on a second click and keeps the table visible while loading", async () => {
      const table = await renderLoaded();

      fireEvent.click(within(table).getByRole("button", { name: "Sender" }));
      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "sender", order: "asc", page: 1, pageSize: 20 },
        }),
      );

      vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: "Sender" }));

      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "sender", order: "desc", page: 1, pageSize: 20 },
        }),
      );
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByLabelText("Loading tickets")).not.toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    const manyPages = (page: number) => ({
      data: { tickets, total: 45, page, pageSize: 20, totalPages: 3 },
    });

    it("shows the range, page count and disables Previous on the first page", async () => {
      vi.mocked(axios.get).mockResolvedValue(manyPages(1));
      renderPage();

      expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByText(/Showing 1–2 of 45/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("requests the next page from the server and goes back", async () => {
      vi.mocked(axios.get).mockResolvedValue(manyPages(1));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Next" }));

      vi.mocked(axios.get).mockResolvedValue(manyPages(2));
      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "createdAt", order: "desc", page: 2, pageSize: 20 },
        }),
      );
      expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
      expect(screen.getByText(/Showing 21–22 of 45/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "createdAt", order: "desc", page: 1, pageSize: 20 },
        }),
      );
    });

    it("disables Next on the last page", async () => {
      vi.mocked(axios.get).mockResolvedValue(manyPages(1));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Next" }));
      vi.mocked(axios.get).mockResolvedValue(manyPages(3));
      await screen.findByText("Page 2 of 3");
      // Next stays disabled while the new page is still loading
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      await screen.findByText("Page 3 of 3");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(),
      );
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("goes back to the first page when the sort changes", async () => {
      vi.mocked(axios.get).mockResolvedValue(manyPages(1));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Next" }));
      await screen.findByText("Page 2 of 3");

      fireEvent.click(screen.getByRole("button", { name: "Subject" }));

      await waitFor(() =>
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "subject", order: "asc", page: 1, pageSize: 20 },
        }),
      );
      expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("hides the pagination controls when there are no tickets", async () => {
      vi.mocked(axios.get).mockResolvedValue(pageOf([]));
      renderPage();

      await screen.findByText("No tickets yet.");
      expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    });
  });

  describe("search and filters", () => {
    beforeEach(() => {
      vi.mocked(axios.get).mockResolvedValue(pageOf(tickets));
    });

    const lastParams = () =>
      vi.mocked(axios.get).mock.lastCall?.[1]?.params as Record<string, unknown>;

    it("sends the search text to the server after typing pauses and resets to page 1", async () => {
      renderPage();
      await screen.findByRole("table");

      fireEvent.change(screen.getByLabelText("Search tickets"), {
        target: { value: "  refund " },
      });

      await waitFor(() => expect(lastParams()).toMatchObject({ search: "refund", page: 1 }));
    });

    it("does not send a request per keystroke", async () => {
      renderPage();
      await screen.findByRole("table");
      const calls = vi.mocked(axios.get).mock.calls.length;

      const input = screen.getByLabelText("Search tickets");
      for (const value of ["r", "re", "ref"]) {
        fireEvent.change(input, { target: { value } });
      }

      await waitFor(() => expect(lastParams()).toMatchObject({ search: "ref" }));
      expect(vi.mocked(axios.get).mock.calls.length).toBe(calls + 1);
    });

    it("filters by status and category through the selects", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByRole("table");

      await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
      await user.click(await screen.findByRole("option", { name: "Resolved" }));
      await waitFor(() => expect(lastParams()).toMatchObject({ status: "resolved" }));

      await user.click(screen.getByRole("combobox", { name: "Filter by category" }));
      await user.click(await screen.findByRole("option", { name: "Uncategorized" }));
      await waitFor(() =>
        expect(lastParams()).toMatchObject({ status: "resolved", category: "none" }),
      );
    });

    it("shows a no-match message and clears all filters", async () => {
      renderPage();
      await screen.findByRole("table");
      expect(
        screen.queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();

      vi.mocked(axios.get).mockResolvedValue(pageOf([]));
      fireEvent.change(screen.getByLabelText("Search tickets"), {
        target: { value: "nothing like this" },
      });
      expect(await screen.findByText("No tickets match your filters.")).toBeInTheDocument();
      // The controls stay mounted so the search can be corrected
      expect(screen.getByLabelText("Search tickets")).toHaveValue("nothing like this");

      vi.mocked(axios.get).mockResolvedValue(pageOf(tickets));
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(screen.getByLabelText("Search tickets")).toHaveValue("");
      await screen.findByRole("table");
      expect(lastParams()).not.toHaveProperty("search");
      expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    });
  });
});
