import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getChromeMock, setStoredFolders } from "./test-setup";
import { CLIPBOARD_FOLDERS_STORAGE_KEY } from "../storage";
import { UNGROUPED_FOLDER_ID, useFolders } from "./useFolders";

const folderA: Folder = { id: "f1", name: "Work", createdAt: 1 };
const folderB: Folder = { id: "f2", name: "Personal", createdAt: 2 };

const entryInFolderA: ClipboardEntry = {
  id: "a",
  text: "alpha",
  copiedAt: 1,
  folderId: "f1",
  isFavorite: false,
};
const ungroupedEntry: ClipboardEntry = {
  id: "b",
  text: "beta",
  copiedAt: 2,
  folderId: null,
  isFavorite: false,
};

function emitFolderStorageChange(folders: Folder[]): void {
  setStoredFolders(folders);
  const calls = getChromeMock().storage.onChanged.addListener.mock.calls;
  const listener = calls[calls.length - 1]?.[0];
  listener?.({ [CLIPBOARD_FOLDERS_STORAGE_KEY]: { newValue: folders } }, "local");
}

describe("useFolders", () => {
  it("loads folders from storage on mount", async () => {
    setStoredFolders([folderA]);
    const showStatus = vi.fn();

    const { result } = renderHook(() => useFolders(showStatus));

    await waitFor(() => expect(result.current.folders).toEqual([folderA]));
  });

  it("re-renders when chrome.storage.onChanged fires for the folders key", async () => {
    setStoredFolders([]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));
    await waitFor(() => expect(result.current.folders).toEqual([]));

    act(() => {
      emitFolderStorageChange([folderA, folderB]);
    });

    await waitFor(() => expect(result.current.folders).toEqual([folderA, folderB]));
  });

  it("defaults selectedFolderId to null (no filter) and updates it via selectFolder", async () => {
    setStoredFolders([]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    expect(result.current.selectedFolderId).toBeNull();

    act(() => {
      result.current.selectFolder("f1");
    });

    expect(result.current.selectedFolderId).toBe("f1");
  });

  it("creates a folder by sending the CREATE_FOLDER message", async () => {
    setStoredFolders([]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.createFolder("Work");
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "CREATE_FOLDER",
      name: "Work",
    });
    expect(showStatus).toHaveBeenCalledWith("Folder created");
  });

  it("rejects a blank folder name without sending a message", async () => {
    setStoredFolders([]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.createFolder("   ");
    });

    expect(getChromeMock().runtime.sendMessage).not.toHaveBeenCalled();
    expect(showStatus).toHaveBeenCalledWith("Folder name is required", true);
  });

  it("shows an error status when creating a folder fails", async () => {
    setStoredFolders([]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.createFolder("Work");
    });

    expect(showStatus).toHaveBeenCalledWith("Could not create folder", true);
  });

  it("assigns an entry to a folder by sending the ASSIGN_ENTRY_TO_FOLDER message", async () => {
    setStoredFolders([folderA]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.assignEntryToFolder(ungroupedEntry, "f1");
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ASSIGN_ENTRY_TO_FOLDER",
      id: "b",
      folderId: "f1",
    });
  });

  it("returns an entry to Ungrouped by assigning a null folderId", async () => {
    setStoredFolders([folderA]);
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.assignEntryToFolder(entryInFolderA, null);
    });

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith({
      type: "ASSIGN_ENTRY_TO_FOLDER",
      id: "a",
      folderId: null,
    });
  });

  it("shows an error status when assigning a folder fails", async () => {
    setStoredFolders([folderA]);
    getChromeMock().runtime.sendMessage.mockResolvedValue({ ok: false, error: "boom" });
    const showStatus = vi.fn();
    const { result } = renderHook(() => useFolders(showStatus));

    await act(async () => {
      await result.current.assignEntryToFolder(ungroupedEntry, "f1");
    });

    expect(showStatus).toHaveBeenCalledWith("Could not move this item", true);
  });

  describe("matchesSelectedFolder", () => {
    it("matches every entry when no folder is selected (All)", async () => {
      setStoredFolders([folderA]);
      const showStatus = vi.fn();
      const { result } = renderHook(() => useFolders(showStatus));

      expect(result.current.matchesSelectedFolder(entryInFolderA)).toBe(true);
      expect(result.current.matchesSelectedFolder(ungroupedEntry)).toBe(true);
    });

    it("matches only entries with folderId null when Ungrouped is selected", async () => {
      setStoredFolders([folderA]);
      const showStatus = vi.fn();
      const { result } = renderHook(() => useFolders(showStatus));

      act(() => {
        result.current.selectFolder(UNGROUPED_FOLDER_ID);
      });

      expect(result.current.matchesSelectedFolder(entryInFolderA)).toBe(false);
      expect(result.current.matchesSelectedFolder(ungroupedEntry)).toBe(true);
    });

    it("matches only entries in the selected folder", async () => {
      setStoredFolders([folderA, folderB]);
      const showStatus = vi.fn();
      const { result } = renderHook(() => useFolders(showStatus));

      act(() => {
        result.current.selectFolder("f1");
      });

      expect(result.current.matchesSelectedFolder(entryInFolderA)).toBe(true);
      expect(result.current.matchesSelectedFolder(ungroupedEntry)).toBe(false);
    });
  });
});
