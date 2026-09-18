import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emitStorageChange, getChromeMock, setStoredEntries } from "./test-setup";
import { useClipboardEntries } from "./useClipboardEntries";

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

describe("useClipboardEntries", () => {
  it("loads entries from storage on mount", async () => {
    setStoredEntries([entryA]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));

    await waitFor(() => expect(result.current.entries).toEqual([entryA]));
  });

  it("re-renders when chrome.storage.onChanged fires", async () => {
    setStoredEntries([]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([]));

    act(() => {
      emitStorageChange([entryB]);
    });

    await waitFor(() => expect(result.current.entries).toEqual([entryB]));
  });

  it("copies an entry, sends the activate message, and shows a success status", async () => {
    setStoredEntries([entryA]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ACTIVATE_CLIPBOARD_ENTRY",
      id: "a",
    });
    expect(showStatus).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("shows a clipboard-write error without sending the activate message", async () => {
    setStoredEntries([entryA]);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(getChromeMock().runtime.sendMessage).not.toHaveBeenCalled();
    expect(showStatus).toHaveBeenCalledWith("Could not copy this item", true);
  });

  it("shows a history-update error when the copy succeeds but activation fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(showStatus).toHaveBeenCalledWith("Copied, but history was not updated", true);
  });

  it("removes an entry by sending the remove message", async () => {
    setStoredEntries([entryA]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.removeEntry(entryA);
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "REMOVE_CLIPBOARD_ENTRY",
      id: "a",
    });
    expect(showStatus).not.toHaveBeenCalled();
  });

  it("shows an error status when removing an entry fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.removeEntry(entryA);
    });

    expect(showStatus).toHaveBeenCalledWith("Could not remove this item", true);
  });

  it("clears all entries by sending the clear message", async () => {
    setStoredEntries([entryA, entryB]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA, entryB]));

    await act(async () => {
      await result.current.clearEntries();
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CLEAR_CLIPBOARD_ENTRIES",
    });
    expect(showStatus).not.toHaveBeenCalled();
  });

  it("shows an error status when clearing entries fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.clearEntries();
    });

    expect(showStatus).toHaveBeenCalledWith("Could not clear clipboard history", true);
  });

  it("adds an entry from the clipboard, sending the existing add message", async () => {
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("some text");
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));
    await waitFor(() => expect(result.current.entries).toEqual([]));

    await act(async () => {
      await result.current.addFromClipboard();
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ADD_CLIPBOARD_ENTRY",
      text: "some text",
    });
    expect(showStatus).toHaveBeenCalledWith("Added from clipboard");
  });

  it("shows a read error without sending a message when the clipboard read fails", async () => {
    vi.mocked(navigator.clipboard.readText).mockRejectedValue(new Error("denied"));
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));

    await act(async () => {
      await result.current.addFromClipboard();
    });

    expect(getChromeMock().runtime.sendMessage).not.toHaveBeenCalled();
    expect(showStatus).toHaveBeenCalledWith("Could not read clipboard", true);
  });

  it("shows an empty-clipboard status without sending a message when the clipboard is blank", async () => {
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("   ");
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));

    await act(async () => {
      await result.current.addFromClipboard();
    });

    expect(getChromeMock().runtime.sendMessage).not.toHaveBeenCalled();
    expect(showStatus).toHaveBeenCalledWith("Clipboard is empty", true);
  });

  it("shows an error status when adding the clipboard text to storage fails", async () => {
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("some text");
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();

    const { result } = renderHook(() => useClipboardEntries(showStatus));

    await act(async () => {
      await result.current.addFromClipboard();
    });

    expect(showStatus).toHaveBeenCalledWith("Could not add clipboard item", true);
  });
});
