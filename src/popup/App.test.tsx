import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  emitFolderStorageChange,
  emitStorageChange,
  getChromeMock,
  setStoredDefaultFolder,
  setStoredEntries,
  setStoredFolders,
} from "./test-setup";
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
const folderZeta: Folder = { id: "f2", name: "Zeta", createdAt: 2 };
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
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Copy this text" }));

    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
  });

  it("shows a clipboard-write error status", async () => {
    setStoredEntries([entryA]);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Copy this text" }));

    const status = await screen.findByText("Could not copy this item");
    expect(status).toHaveClass("status--error");
  });

  it("shows a history-update error when the copy succeeds but activation fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Copy this text" }));

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

  it("shows the filtered empty state when no entries in the current tab are favorited", async () => {
    setStoredEntries([entryA, entryB]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));

    expect(
      await screen.findByText("No entries match the selected folder and favorites filter."),
    ).toBeInTheDocument();
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
    await screen.findByText("This folder is empty.");
    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
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

  it("shows only Ungrouped entries by default, as the first and default-selected tab", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Ungrouped");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("gamma")).not.toBeInTheDocument();
  });

  it("lists folder tabs in their existing storage order, not alphabetically", async () => {
    setStoredEntries([]);
    setStoredFolders([folderZeta, folderWork]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    const tabNames = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabNames).toEqual(["Ungrouped", "Zeta", "Work"]);
  });

  it("switches visible entries when a folder tab is clicked", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");
    expect(screen.queryByText("gamma")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));

    expect(await screen.findByText("gamma")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Work" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ungrouped" })).toHaveAttribute("aria-selected", "false");
  });

  it("moves focus and selection between folder tabs with arrow keys", async () => {
    setStoredEntries([entryA, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    const ungroupedTab = screen.getByRole("tab", { name: "Ungrouped" });
    ungroupedTab.focus();
    fireEvent.keyDown(ungroupedTab, { key: "ArrowRight" });

    const workTab = screen.getByRole("tab", { name: "Work" });
    expect(workTab).toHaveAttribute("aria-selected", "true");
    expect(workTab).toHaveFocus();
    expect(await screen.findByText("gamma")).toBeInTheDocument();

    fireEvent.keyDown(workTab, { key: "ArrowLeft" });

    expect(ungroupedTab).toHaveAttribute("aria-selected", "true");
    expect(ungroupedTab).toHaveFocus();
  });

  it("adds a new tab when a folder is created", async () => {
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

    act(() => {
      emitFolderStorageChange([folderWork]);
    });

    expect(await screen.findByRole("tab", { name: "Work" })).toBeInTheDocument();
  });

  it("shows a folder-empty state when the selected folder has no entries", async () => {
    setStoredEntries([entryA]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));

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

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
    await screen.findByText("gamma");

    expect(screen.getByText("2 / 100")).toBeInTheDocument();
  });

  it("shows a generic no-matching-entries state when the folder and favorites filters combine to zero results", async () => {
    const favoriteEntry: ClipboardEntry = { ...entryA, isFavorite: true };
    setStoredEntries([favoriteEntry, entryInFolder]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
    await screen.findByText("gamma");
    fireEvent.click(screen.getByRole("button", { name: "Favorites only" }));

    expect(
      await screen.findByText("No entries match the selected folder and favorites filter."),
    ).toBeInTheDocument();
    expect(screen.queryByText("This folder is empty.")).not.toBeInTheDocument();
  });

  it("renders the item header with copy, favorite, folder, and delete controls in order", async () => {
    setStoredEntries([entryA]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("alpha");

    const header = document.querySelector(".entry__header");
    expect(header).not.toBeNull();

    const controlClasses = Array.from(header?.children ?? []).map((el) => el.className);
    expect(controlClasses).toEqual([
      "entry__copy",
      "entry__favorite",
      "entry__folder-select",
      "entry__delete",
    ]);
  });

  it("shows a keyboard-shortcut hint in the header", async () => {
    setStoredEntries([]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    expect(screen.getByText(/to open/)).toBeInTheDocument();
  });

  it("does not show an expand toggle for entry text that isn't clamped", async () => {
    setStoredEntries([entryA]);
    render(<App />);
    await screen.findByText("alpha");

    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("shows an expand toggle for clamped entry text and expands it on click", async () => {
    setStoredEntries([entryA]);
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(100);
    const clientHeightSpy = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(60);

    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
    expect(document.querySelector(".entry__text")).toHaveClass("entry__text--expanded");

    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });

  it("shows a top collapse control only while expanded, and it collapses the entry", async () => {
    setStoredEntries([entryA]);
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(100);
    const clientHeightSpy = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(60);

    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Collapse" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    const topCollapseButton = screen.getByRole("button", { name: "Collapse" });
    expect(topCollapseButton).toBeInTheDocument();
    expect(document.querySelector(".entry__text")).toHaveClass("entry__text--expanded");

    fireEvent.click(topCollapseButton);

    expect(screen.queryByRole("button", { name: "Collapse" })).not.toBeInTheDocument();
    expect(document.querySelector(".entry__text")).not.toHaveClass("entry__text--expanded");
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();

    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });

  it("shows a bottom scroll hint when the entries list overflows", async () => {
    setStoredEntries([entryA, entryB]);
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(200);
    const clientHeightSpy = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(100);

    render(<App />);
    await screen.findByText("alpha");

    const hint = document.querySelector(".scroll-hint");
    expect(hint).not.toBeNull();
    expect(hint).toHaveAttribute("aria-hidden", "true");

    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });

  it("does not show the scroll hint when there is nothing more to scroll to", async () => {
    setStoredEntries([entryA]);
    render(<App />);
    await screen.findByText("alpha");

    expect(document.querySelector(".scroll-hint")).toBeNull();
  });

  it("lists Ungrouped and every folder in the default-folder dropdown, defaulting to Ungrouped", async () => {
    setStoredEntries([]);
    setStoredFolders([folderWork, folderZeta]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    const select = screen.getByLabelText("New items go to") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.text);
    expect(optionLabels).toEqual(["Ungrouped", "Work", "Zeta"]);
    expect(select.value).toBe("");
  });

  it("reflects a persisted default folder in the dropdown", async () => {
    setStoredEntries([]);
    setStoredFolders([folderWork]);
    setStoredDefaultFolder("f1");
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    const select = screen.getByLabelText("New items go to") as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("f1"));
  });

  it("sends SET_DEFAULT_FOLDER when a folder is chosen as the default", async () => {
    setStoredEntries([]);
    setStoredFolders([folderWork]);
    render(<App />);
    await screen.findByText("Copy text on a web page and it will appear here.");

    fireEvent.change(screen.getByLabelText("New items go to"), {
      target: { value: "f1" },
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "SET_DEFAULT_FOLDER",
      folderId: "f1",
    });
  });

  it("sends SET_DEFAULT_FOLDER with null when Ungrouped is chosen as the default", async () => {
    setStoredEntries([]);
    setStoredFolders([folderWork]);
    setStoredDefaultFolder("f1");
    render(<App />);
    const select = await screen.findByLabelText("New items go to");
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe("f1"));

    fireEvent.change(select, { target: { value: "" } });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "SET_DEFAULT_FOLDER",
      folderId: null,
    });
  });
});
