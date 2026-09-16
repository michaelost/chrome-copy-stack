import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emitStorageChange, getChromeMock, setStoredEntries } from "./test-setup";
import { useClipboardEntries } from "./useClipboardEntries";

const entryA: ClipboardEntry = { id: "a", text: "alpha", copiedAt: 1 };
const entryB: ClipboardEntry = { id: "b", text: "beta", copiedAt: 2 };

describe("useClipboardEntries", () => {
  it("loads entries from storage on mount", async () => {
    setStoredEntries([entryA]);

    const { result } = renderHook(() => useClipboardEntries());

    await waitFor(() => expect(result.current.entries).toEqual([entryA]));
  });

  it("re-renders when chrome.storage.onChanged fires", async () => {
    setStoredEntries([]);
    const { result } = renderHook(() => useClipboardEntries());
    await waitFor(() => expect(result.current.entries).toEqual([]));

    act(() => {
      emitStorageChange([entryB]);
    });

    await waitFor(() => expect(result.current.entries).toEqual([entryB]));
  });

  it("copies an entry, sends the activate message, and shows a success status", async () => {
    setStoredEntries([entryA]);

    const { result } = renderHook(() => useClipboardEntries());
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ACTIVATE_CLIPBOARD_ENTRY",
      id: "a",
    });
    expect(result.current.status).toEqual({ message: "Copied to clipboard", isError: false });
  });

  it("shows a clipboard-write error without sending the activate message", async () => {
    setStoredEntries([entryA]);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));

    const { result } = renderHook(() => useClipboardEntries());
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(getChromeMock().runtime.sendMessage).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "Could not copy this item", isError: true });
  });

  it("shows a history-update error when the copy succeeds but activation fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });

    const { result } = renderHook(() => useClipboardEntries());
    await waitFor(() => expect(result.current.entries).toEqual([entryA]));

    await act(async () => {
      await result.current.copyEntry(entryA);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(result.current.status).toEqual({
      message: "Copied, but history was not updated",
      isError: true,
    });
  });
});
