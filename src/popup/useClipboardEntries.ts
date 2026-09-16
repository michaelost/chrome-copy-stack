import { useCallback, useEffect, useRef, useState } from "react";
import { CLIPBOARD_STORAGE_KEY, getClipboardEntries } from "../storage";

const STATUS_TIMEOUT_MS = 1800;

interface StatusState {
  message: string;
  isError: boolean;
}

interface UseClipboardEntriesResult {
  entries: ClipboardEntry[];
  status: StatusState;
  copyEntry: (entry: ClipboardEntry) => Promise<void>;
  removeEntry: (entry: ClipboardEntry) => Promise<void>;
  clearEntries: () => Promise<void>;
}

export function useClipboardEntries(): UseClipboardEntriesResult {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [status, setStatus] = useState<StatusState>({ message: "", isError: false });
  const statusTimer = useRef<number | undefined>(undefined);

  const showStatus = useCallback((message: string, isError = false) => {
    window.clearTimeout(statusTimer.current);
    setStatus({ message, isError });
    statusTimer.current = window.setTimeout(() => {
      setStatus({ message: "", isError: false });
    }, STATUS_TIMEOUT_MS);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setEntries(await getClipboardEntries());
    } catch (error: unknown) {
      console.error("Failed to load clipboard history:", error);
      showStatus("Could not load clipboard history", true);
    }
  }, [showStatus]);

  useEffect(() => {
    void refresh();

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void {
      if (areaName === "local" && CLIPBOARD_STORAGE_KEY in changes) {
        void refresh();
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.clearTimeout(statusTimer.current);
    };
  }, [refresh]);

  const copyEntry = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        await navigator.clipboard.writeText(entry.text);
      } catch (error: unknown) {
        console.error("Failed to copy saved text:", error);
        showStatus("Could not copy this item", true);
        return;
      }

      try {
        const response = (await chrome.runtime.sendMessage({
          type: "ACTIVATE_CLIPBOARD_ENTRY",
          id: entry.id,
        } satisfies ExtensionMessage)) as ExtensionResponse;

        if (!response.ok) {
          throw new Error(response.error);
        }

        showStatus("Copied to clipboard");
      } catch (error: unknown) {
        console.error("Copied text but failed to update clipboard history:", error);
        showStatus("Copied, but history was not updated", true);
      }
    },
    [showStatus],
  );

  const removeEntry = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: "REMOVE_CLIPBOARD_ENTRY",
          id: entry.id,
        } satisfies ExtensionMessage)) as ExtensionResponse;

        if (!response.ok) {
          throw new Error(response.error);
        }
      } catch (error: unknown) {
        console.error("Failed to remove clipboard entry:", error);
        showStatus("Could not remove this item", true);
      }
    },
    [showStatus],
  );

  const clearEntries = useCallback(async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "CLEAR_CLIPBOARD_ENTRIES",
      } satisfies ExtensionMessage)) as ExtensionResponse;

      if (!response.ok) {
        throw new Error(response.error);
      }
    } catch (error: unknown) {
      console.error("Failed to clear clipboard history:", error);
      showStatus("Could not clear clipboard history", true);
    }
  }, [showStatus]);

  return { entries, status, copyEntry, removeEntry, clearEntries };
}
