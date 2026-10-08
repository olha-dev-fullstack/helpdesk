import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReplyThread } from "./ReplyThread";

vi.mock("axios");

const reply = {
  id: "r1",
  body: "Try resetting again.",
  senderType: "agent",
  createdAt: "2026-03-02T10:00:00.000Z",
  author: { id: "u1", name: "Alex Agent", role: "agent" as const },
};

function renderThread() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReplyThread ticketId="abc" />
    </QueryClientProvider>,
  );
}

describe("ReplyThread", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows existing replies with their author", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { replies: [reply] } });
    renderThread();
    expect(await screen.findByText("Try resetting again.")).toBeInTheDocument();
    expect(screen.getByText("Alex Agent")).toBeInTheDocument();
  });

  it("labels customer replies", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { replies: [{ ...reply, id: "r2", senderType: "customer", author: null }] },
    });
    renderThread();
    expect(await screen.findByText("Customer", { selector: "[data-slot=badge]" })).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { replies: [] } });
    renderThread();
    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
  });

  it("rejects a blank reply without calling the API", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { replies: [] } });
    renderThread();
    await userEvent.click(await screen.findByRole("button", { name: "Send reply" }));
    expect(await screen.findByText("Reply is required")).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("posts a reply and clears the field", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { replies: [] } });
    vi.mocked(axios.post).mockResolvedValue({ data: { reply } });
    renderThread();
    const box = await screen.findByLabelText("Reply");
    await userEvent.type(box, "Hello there");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/abc/replies", { body: "Hello there" }),
    );
    await waitFor(() => expect(box).toHaveValue(""));
  });
});
