import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./UsersPage";

vi.mock("axios");

const users = [
  {
    id: "1",
    name: "Ada Admin",
    email: "ada@example.com",
    role: "admin",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "2",
    name: "Alex Agent",
    email: "alex@example.com",
    role: "agent",
    createdAt: "2026-02-20T10:00:00.000Z",
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

describe("UsersPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the heading and a loading state while fetching", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading users")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row for each user with name, email and role", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { users } });
    renderPage();

    const table = await screen.findByRole("table");
    expect(axios.get).toHaveBeenCalledWith("/api/users");

    for (const header of ["Name", "Email", "Role", "Created"]) {
      expect(
        within(table).getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    const adminRow = within(table).getByRole("row", { name: /ada@example.com/ });
    expect(within(adminRow).getByText("Ada Admin")).toBeInTheDocument();
    expect(within(adminRow).getByText("admin")).toBeInTheDocument();

    const agentRow = within(table).getByRole("row", { name: /alex@example.com/ });
    expect(within(agentRow).getByText("Alex Agent")).toBeInTheDocument();
    expect(within(agentRow).getByText("agent")).toBeInTheDocument();
  });

  it("shows an empty message when there are no users", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { users: [] } });
    renderPage();

    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Request failed"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load users",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  describe("creating a user", () => {
    function fillForm(name: string, email: string, password: string) {
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: password },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    }

    async function openDialog() {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "New user" }));
      return screen.findByRole("dialog");
    }

    beforeEach(() => {
      vi.mocked(axios.get).mockResolvedValue({ data: { users } });
    });

    it("opens a modal with name, email and password fields", async () => {
      const dialog = await openDialog();

      expect(within(dialog).getByLabelText("Name")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Email")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Password")).toBeInTheDocument();
    });

    it("shows validation errors and does not submit invalid values", async () => {
      await openDialog();
      fillForm("Al", "not-an-email", "short");

      expect(
        await screen.findByText("Name must be at least 3 characters"),
      ).toBeInTheDocument();
      expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
      expect(
        screen.getByText("Password must be at least 12 characters"),
      ).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("posts the values, closes the modal and refetches users", async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: {} });
      await openDialog();
      fillForm("New Person", "new@example.com", "a-long-password");

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(axios.post).toHaveBeenCalledWith("/api/users", {
        name: "New Person",
        email: "new@example.com",
        password: "a-long-password",
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    it("keeps the modal open and shows an error when creation fails", async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error("boom"));
      await openDialog();
      fillForm("New Person", "new@example.com", "a-long-password");

      expect(await screen.findByText("Failed to create user")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("editing a user", () => {
    beforeEach(() => {
      vi.mocked(axios.get).mockResolvedValue({ data: { users } });
    });

    async function openEdit() {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Edit Alex Agent" }));
      return screen.findByRole("dialog");
    }

    it("prefills the form and patches without a password when left blank", async () => {
      vi.mocked(axios.patch).mockResolvedValue({ data: {} });
      const dialog = await openEdit();

      expect(within(dialog).getByLabelText("Name")).toHaveValue("Alex Agent");
      expect(within(dialog).getByLabelText("Email")).toHaveValue("alex@example.com");

      fireEvent.change(within(dialog).getByLabelText("Name"), {
        target: { value: "Alexander" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(axios.patch).toHaveBeenCalledWith("/api/users/2", {
        name: "Alexander",
        email: "alex@example.com",
        password: "",
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    it("rejects a too-short new password", async () => {
      const dialog = await openEdit();
      fireEvent.change(within(dialog).getByLabelText("Password"), {
        target: { value: "short" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(
        await screen.findByText("Password must be at least 12 characters"),
      ).toBeInTheDocument();
      expect(axios.patch).not.toHaveBeenCalled();
    });
  });

  describe("deleting a user", () => {
    beforeEach(() => {
      vi.mocked(axios.get).mockResolvedValue({ data: { users } });
    });

    async function openDelete() {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Delete Alex Agent" }));
      return screen.findByRole("dialog");
    }

    it("asks for confirmation, deletes, closes and refetches", async () => {
      vi.mocked(axios.delete).mockResolvedValue({});
      const dialog = await openDelete();
      expect(dialog).toHaveTextContent("alex@example.com");
      expect(axios.delete).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(axios.delete).toHaveBeenCalledWith("/api/users/2");
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    it("does nothing when cancelled", async () => {
      const dialog = await openDelete();
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it("shows the server error and keeps the dialog open on failure", async () => {
      vi.mocked(axios.delete).mockRejectedValue(new Error("boom"));
      const dialog = await openDelete();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Failed to delete user",
      );
    });
  });
});
