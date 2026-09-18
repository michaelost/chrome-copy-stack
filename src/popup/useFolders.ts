import { useCallback, useEffect, useState } from "react";
import { sendExtensionMessage } from "./extensionMessaging";
import { CLIPBOARD_FOLDERS_STORAGE_KEY, getFolders } from "../storage";

/** Sentinel `selectedFolderId` value for "entries with no folder", distinct
 * from `null` which means "no filter" (show every entry). */
export const UNGROUPED_FOLDER_ID = "ungrouped";

interface UseFoldersResult {
  folders: Folder[];
  selectedFolderId: string | null;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string) => Promise<void>;
  assignEntryToFolder: (entry: ClipboardEntry, folderId: string | null) => Promise<void>;
  matchesSelectedFolder: (entry: ClipboardEntry) => boolean;
}

export function useFolders(
  showStatus: (message: string, isError?: boolean) => void,
): UseFoldersResult {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setFolders(await getFolders());
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
      if (areaName === "local" && CLIPBOARD_FOLDERS_STORAGE_KEY in changes) {
        void refresh();
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refresh]);

  const selectFolder = useCallback((folderId: string | null) => {
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

  const matchesSelectedFolder = useCallback(
    (entry: ClipboardEntry) => {
      if (selectedFolderId === null) {
        return true;
      }

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
  };
}
