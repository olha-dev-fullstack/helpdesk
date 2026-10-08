import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import axios from "axios";
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
    createdAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "2",
    subject: "Refund please",
    fromEmail: "bob@example.com",
    fromName: null,
    status: "resolved",
    createdAt: "2026-02-01T10:00:00.000Z",
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TicketsPage />
    </QueryClientProvider>,
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
    vi.mocked(axios.get).mockResolvedValue({ data: { tickets } });
    renderPage();

    const table = await screen.findByRole("table");
    expect(axios.get).toHaveBeenCalledWith("/api/tickets");

    const first = within(table).getByRole("row", { name: /Cannot log in/ });
    expect(within(first).getByText("Ann <ann@example.com>")).toBeInTheDocument();
    expect(within(first).getByText("open")).toBeInTheDocument();

    const second = within(table).getByRole("row", { name: /Refund please/ });
    expect(within(second).getByText("bob@example.com")).toBeInTheDocument();
    expect(within(second).getByText("resolved")).toBeInTheDocument();
  });

  it("shows an empty message when there are no tickets", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { tickets: [] } });
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
});
