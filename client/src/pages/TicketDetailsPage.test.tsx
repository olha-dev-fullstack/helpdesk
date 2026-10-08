import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText("Loading ticket")).toBeInTheDocument();
  });

  it("shows the ticket's subject, sender, status, category and message", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ticket } });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Cannot log in" })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/api/tickets/abc");
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("ann@example.com")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("Technical question")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText(/I reset my password twice\./)).toBeInTheDocument();
  });

  it("shows Unknown when the sender has no name", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { ticket: { ...ticket, fromName: null, category: null } },
    });
    renderPage();

    expect(await screen.findByText("Unknown")).toBeInTheDocument();
  });

  it("links back to the tickets list", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ticket } });
    renderPage();

    expect(screen.getByRole("link", { name: "Back to tickets" })).toHaveAttribute(
      "href",
      "/tickets",
    );
  });

  it("shows a not-found message for a 404", async () => {
    vi.mocked(axios.get).mockRejectedValue(httpError(404));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found.");
  });

  it("shows an error for other failures", async () => {
    vi.mocked(axios.get).mockRejectedValue(httpError(500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load ticket");
  });
});
