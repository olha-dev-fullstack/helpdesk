import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";

vi.mock("axios");
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Ann" } } }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe("HomePage dashboard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows the ticket statistics", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        totalTickets: 40,
        openTickets: 7,
        resolvedByAi: 10,
        resolvedByAiPercent: 25,
        averageResolutionSeconds: 3 * 3600 + 15 * 60,
        ticketsPerDay: [],
      },
    });
    renderPage();

    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("3h 15m")).toBeInTheDocument();
  });

  it("shows a dash when nothing is resolved yet", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        totalTickets: 0,
        openTickets: 0,
        resolvedByAi: 0,
        resolvedByAiPercent: 0,
        averageResolutionSeconds: null,
        ticketsPerDay: [],
      },
    });
    renderPage();

    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("shows the tickets per day chart", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        totalTickets: 1,
        openTickets: 1,
        resolvedByAi: 0,
        resolvedByAiPercent: 0,
        averageResolutionSeconds: null,
        ticketsPerDay: [{ date: "2026-10-09", count: 1 }],
      },
    });
    renderPage();

    expect(await screen.findByText("Tickets per day")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load statistics");
  });
});
