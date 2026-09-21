import { useCallback, useEffect, useState } from "react";
import { sendExtensionMessage } from "./extensionMessaging";
import {
  CLIPBOARD_FOLDERS_STORAGE_KEY,
  DEFAULT_FOLDER_STORAGE_KEY,
  getDefaultFolderId,
  getFolders,
} from "../storage";

/** Sentinel `selectedFolderId` value for "entries with no folder". This is
 * also the default selected tab — there is no "All" state. */
export const UNGROUPED_FOLDER_ID = "ungrouped";

interface UseFoldersResult {
  folders: Folder[];
  selectedFolderId: string;
  selectFolder: (folderId: string) => void;
  createFolder: (name: string) => Promise<void>;
  assignEntryToFolder: (entry: ClipboardEntry, folderId: string | null) => Promise<void>;
  matchesSelectedFolder: (entry: ClipboardEntry) => boolean;
  defaultFolderId: string | null;
  selectDefaultFolder: (folderId: string | null) => Promise<void>;
}

export function useFolders(
  showStatus: (message: string, isError?: boolean) => void,
): UseFoldersResult {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(UNGROUPED_FOLDER_ID);
  const [defaultFolderId, setDefaultFolderId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [loadedFolders, persistedDefaultFolderId] = await Promise.all([
        getFolders(),
        getDefaultFolderId(),
      ]);

      setFolders(loadedFolders);

      // A persisted default folder that no longer exists must never be kept
      // in UI state or reused for new entries: reset it to Ungrouped (null)
      // and persist that correction now, rather than waiting for the next
      // add to silently fall back on the background side.
      if (
        persistedDefaultFolderId !== null &&
        !loadedFolders.some((folder) => folder.id === persistedDefaultFolderId)
      ) {
        setDefaultFolderId(null);
        await sendExtensionMessage({ type: "SET_DEFAULT_FOLDER", folderId: null });
      } else {
        setDefaultFolderId(persistedDefaultFolderId);
      }
    } catch (error: unknown) {
      console.error("Failed to load folders:", error);
      showStatus("Could not load folders", true);
    }
  }, [showStatus]);

  useEffect(() => {
    void refresh();

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void {
      if (
        areaName === "local" &&
        (CLIPBOARD_FOLDERS_STORAGE_KEY in changes || DEFAULT_FOLDER_STORAGE_KEY in changes)
      ) {
        void refresh();
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refresh]);

  const selectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

  const createFolder = useCallback(
    async (name: string) => {
      if (name.trim().length === 0) {
        showStatus("Folder name is required", true);
        return;
      }

      try {
        await sendExtensionMessage({ type: "CREATE_FOLDER", name });
        showStatus("Folder created");
      } catch (error: unknown) {
        console.error("Failed to create folder:", error);
        showStatus("Could not create folder", true);
      }
    },
    [showStatus],
  );

  const assignEntryToFolder = useCallback(
    async (entry: ClipboardEntry, folderId: string | null) => {
      try {
        await sendExtensionMessage({ type: "ASSIGN_ENTRY_TO_FOLDER", id: entry.id, folderId });
      } catch (error: unknown) {
        console.error("Failed to move clipboard entry to folder:", error);
        showStatus("Could not move this item", true);
      }
    },
    [showStatus],
  );

  const selectDefaultFolder = useCallback(
    async (folderId: string | null) => {
      try {
        await sendExtensionMessage({ type: "SET_DEFAULT_FOLDER", folderId });
      } catch (error: unknown) {
        console.error("Failed to set default folder:", error);
        showStatus("Could not set default folder", true);
      }
    },
    [showStatus],
  );

  const matchesSelectedFolder = useCallback(
    (entry: ClipboardEntry) => {
      if (selectedFolderId === UNGROUPED_FOLDER_ID) {
        return entry.folderId === null;
      }

      return entry.folderId === selectedFolderId;
    },
    [selectedFolderId],
  );

  return {
    folders,
    selectedFolderId,
    selectFolder,
    createFolder,
    assignEntryToFolder,
    matchesSelectedFolder,
    defaultFolderId,
    selectDefaultFolder,
  };
}
