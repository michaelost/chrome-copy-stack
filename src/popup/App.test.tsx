import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emitStorageChange, getChromeMock, setStoredEntries } from "./test-setup";
import { App } from "./App";

const entryA: ClipboardEntry = { id: "a", text: "alpha", copiedAt: 1 };
const entryB: ClipboardEntry = { id: "b", text: "beta", copiedAt: 2 };

describe("App", () => {
  it("renders the empty state when there are no entries", async () => {
    setStoredEntries([]);
    render(<App />);

    expect(
      await screen.findByText("Copy text on a web page and it will appear here."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 100")).toBeInTheDocument();
  });

  it("renders a current entry and previous list, with the count badge", async () => {
    setStoredEntries([entryA, entryB]);
    render(<App />);

    expect(await screen.findByText("2 / 100")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("copies an entry on click and shows a success status", async () => {
    setStoredEntries([entryA]);
    render(<App />);

    fireEvent.click(await screen.findByText("alpha"));

    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
  });

  it("shows a clipboard-write error status", async () => {
    setStoredEntries([entryA]);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    render(<App />);

    fireEvent.click(await screen.findByText("alpha"));

    const status = await screen.findByText("Could not copy this item");
    expect(status).toHaveClass("status--error");
  });

  it("shows a history-update error when the copy succeeds but activation fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    render(<App />);

    fireEvent.click(await screen.findByText("alpha"));

    const status = await screen.findByText("Copied, but history was not updated");
    expect(status).toHaveClass("status--error");
  });

  it("re-renders when chrome.storage.onChanged fires", async () => {
    setStoredEntries([]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    act(() => {
      emitStorageChange([entryA]);
    });

    expect(await screen.findByText("alpha")).toBeInTheDocument();
  });
});
