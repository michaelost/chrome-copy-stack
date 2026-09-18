import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emitStorageChange, getChromeMock, setStoredEntries, setStoredFolders } from "./test-setup";
import { App } from "./App";

const entryA: ClipboardEntry = {
  id: "a",
  text: "alpha",
  copiedAt: 1,
  folderId: null,
  isFavorite: false,
};
const entryB: ClipboardEntry = {
  id: "b",
  text: "beta",
  copiedAt: 2,
  folderId: null,
  isFavorite: false,
};

const folderWork: Folder = { id: "f1", name: "Work", createdAt: 1 };
const entryInFolder: ClipboardEntry = {
  id: "c",
  text: "gamma",
  copiedAt: 3,
  folderId: "f1",
  isFavorite: false,
};

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

  it("does not show the clear-all control when there are no entries", async () => {
    setStoredEntries([]);
    render(<App />);

    await screen.findByText("Copy text on a web page and it will appear here.");
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("removes a single entry without copying it", async () => {
    setStoredEntries([entryA, entryB]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove this item" })[0]);

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "REMOVE_CLIPBOARD_ENTRY",
      id: "a",
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("shows an error status when removing an entry fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Remove this item" }));

    const status = await screen.findByText("Could not remove this item");
    expect(status).toHaveClass("status--error");
  });

  it("clears every entry when clear all is clicked", async () => {
    setStoredEntries([entryA, entryB]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CLEAR_CLIPBOARD_ENTRIES",
    });
  });

  it("shows an error status when clear all fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    const status = await screen.findByText("Could not clear clipboard history");
    expect(status).toHaveClass("status--error");
  });

  it("shows the add-from-clipboard button even when there are no entries", async () => {
    setStoredEntries([]);
    render(<App />);

    await screen.findByText("Copy text on a web page and it will appear here.");
    expect(screen.getByRole("button", { name: "Add from clipboard" })).toBeInTheDocument();
  });

  it("adds an entry from the clipboard on click", async () => {
    setStoredEntries([]);
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("some text");
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    fireEvent.click(screen.getByRole("button", { name: "Add from clipboard" }));

    expect(await screen.findByText("Added from clipboard")).toBeInTheDocument();
    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ADD_CLIPBOARD_ENTRY",
      text: "some text",
    });
  });

  it("shows a read error when the clipboard can't be read", async () => {
    setStoredEntries([]);
    vi.mocked(navigator.clipboard.readText).mockRejectedValue(new Error("denied"));
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    fireEvent.click(screen.getByRole("button", { name: "Add from clipboard" }));

    const status = await screen.findByText("Could not read clipboard");
    expect(status).toHaveClass("status--error");
  });

  it("shows an empty-clipboard status when the clipboard is blank", async () => {
    setStoredEntries([]);
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("   ");
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    fireEvent.click(screen.getByRole("button", { name: "Add from clipboard" }));

    const status = await screen.findByText("Clipboard is empty");
    expect(status).toHaveClass("status--error");
  });

  it("renders a favorite toggle for each entry, reflecting its current state", async () => {
    const favoriteEntry: ClipboardEntry = { ...entryB, isFavorite: true };
    setStoredEntries([entryA, favoriteEntry]);
    render(<App />);
    await screen.findByText("alpha");

    expect(
      screen.getByRole("button", { name: "Add to favorites" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Remove from favorites" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles favorite state for an entry", async () => {
    setStoredEntries([entryA]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "TOGGLE_FAVORITE_ENTRY",
      id: "a",
    });
  });

  it("shows an error status when toggling favorite fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));

    const status = await screen.findByText("Could not update favorite");
    expect(status).toHaveClass("status--error");
  });

  it("filters to favorites only when the favorites toggle is active", async () => {
    const favoriteEntry: ClipboardEntry = { ...entryB, isFavorite: true };
    setStoredEntries([entryA, favoriteEntry]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));

    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Showing favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a favorites-specific empty state when no entries are favorited", async () => {
    setStoredEntries([entryA, entryB]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));

    expect(await screen.findByText("No favorites yet.")).toBeInTheDocument();
    expect(
      screen.queryByText("Copy text on a web page and it will appear here."),
    ).not.toBeInTheDocument();
  });

  it("clears every entry via clear all even while the favorites filter hides them", async () => {
    const favoriteEntry: ClipboardEntry = { ...entryA, isFavorite: true };
    setStoredEntries([favoriteEntry, entryB]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CLEAR_CLIPBOARD_ENTRIES",
    });
  });

  it("creates a folder from the folder controls", async () => {
    setStoredEntries([]);
    setStoredFolders([]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    fireEvent.change(screen.getByLabelText("New folder name"), {
      target: { value: "Work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add folder" }));

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CREATE_FOLDER",
      name: "Work",
    });
  });

  it("assigns an entry to a folder via the per-entry folder select", async () => {
    setStoredEntries([entryA]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.change(screen.getByLabelText("Assign to folder"), {
      target: { value: "f1" },
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ASSIGN_ENTRY_TO_FOLDER",
      id: "a",
      folderId: "f1",
    });
  });

  it("returns an entry to Ungrouped via the per-entry folder select", async () => {
    setStoredEntries([entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("gamma");

    fireEvent.change(screen.getByLabelText("Assign to folder"), {
      target: { value: "" },
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ASSIGN_ENTRY_TO_FOLDER",
      id: "c",
      folderId: null,
    });
  });

  it("filters visible entries to the selected folder", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");
    expect(screen.getByText("gamma")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by folder"), {
      target: { value: "f1" },
    });

    expect(await screen.findByText("gamma")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });

  it("shows a folder-empty state when the selected folder has no entries", async () => {
    setStoredEntries([entryA]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.change(screen.getByLabelText("Filter by folder"), {
      target: { value: "f1" },
    });

    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
    expect(
      screen.queryByText("Copy text on a web page and it will appear here."),
    ).not.toBeInTheDocument();
  });

  it("still clears every entry via Clear all while a folder filter is active", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.change(screen.getByLabelText("Filter by folder"), {
      target: { value: "f1" },
    });
    await screen.findByText("gamma");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CLEAR_CLIPBOARD_ENTRIES",
    });
  });

  it("keeps the count badge bound to total entries regardless of the folder filter", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");
    expect(screen.getByText("2 / 100")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by folder"), {
      target: { value: "f1" },
    });
    await screen.findByText("gamma");

    expect(screen.getByText("2 / 100")).toBeInTheDocument();
  });

  it("shows a generic no-matching-entries state when the folder and favorites filters combine to zero results", async () => {
    const favoriteEntry: ClipboardEntry = { ...entryA, isFavorite: true };
    setStoredEntries([favoriteEntry, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.change(screen.getByLabelText("Filter by folder"), {
      target: { value: "f1" },
    });
    await screen.findByText("gamma");
    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));

    expect(
      await screen.findByText("No entries match the selected folder and favorites filter."),
    ).toBeInTheDocument();
    expect(screen.queryByText("This folder is empty.")).not.toBeInTheDocument();
    expect(screen.queryByText("No favorites yet.")).not.toBeInTheDocument();
  });
});
