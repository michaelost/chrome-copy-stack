import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getChromeMock, setStoredEntries } from "./test-setup";
import { useFavoriteActions } from "./useFavoriteActions";

const entryA: ClipboardEntry = {
  id: "a",
  text: "alpha",
  copiedAt: 1,
  folderId: null,
  isFavorite: false,
};

describe("useFavoriteActions", () => {
  it("toggles favorite by sending the toggle message", async () => {
    setStoredEntries([entryA]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useFavoriteActions(showStatus));

    await act(async () => {
      await result.current.toggleFavorite(entryA);
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "TOGGLE_FAVORITE_ENTRY",
      id: "a",
    });
    expect(showStatus).not.toHaveBeenCalled();
  });

  it("shows an error status when toggling favorite fails", async () => {
    setStoredEntries([entryA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();

    const { result } = renderHook(() => useFavoriteActions(showStatus));

    await act(async () => {
      await result.current.toggleFavorite(entryA);
    });

    expect(showStatus).toHaveBeenCalledWith("Could not update favorite", true);
  });
});
