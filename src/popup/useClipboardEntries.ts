import { useCallback, useEffect, useRef, useState } from "react";
import { CLIPBOARD_STORAGE_KEY, getClipboardEntries } from "../storage";

const STATUS_TIMEOUT_MS = 1800;

interface StatusState {
  message: string;
  isError: boolean;
}

async function sendExtensionMessage(message: ExtensionMessage): Promise<void> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }
}

interface UseClipboardEntriesResult {
  entries: ClipboardEntry[];
  status: StatusState;
  copyEntry: (entry: ClipboardEntry) => Promise<void>;
  removeEntry: (entry: ClipboardEntry) => Promise<void>;
  clearEntries: () => Promise<void>;
  addFromClipboard: () => Promise<void>;
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
        await sendExtensionMessage({ type: "ACTIVATE_CLIPBOARD_ENTRY", id: entry.id });
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
        await sendExtensionMessage({ type: "REMOVE_CLIPBOARD_ENTRY", id: entry.id });
      } catch (error: unknown) {
        console.error("Failed to remove clipboard entry:", error);
        showStatus("Could not remove this item", true);
      }
    },
    [showStatus],
  );

  const clearEntries = useCallback(async () => {
    try {
      await sendExtensionMessage({ type: "CLEAR_CLIPBOARD_ENTRIES" });
    } catch (error: unknown) {
      console.error("Failed to clear clipboard history:", error);
      showStatus("Could not clear clipboard history", true);
    }
  }, [showStatus]);

  const addFromClipboard = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (error: unknown) {
      console.error("Failed to read clipboard:", error);
      showStatus("Could not read clipboard", true);
      return;
    }

    if (text.trim().length === 0) {
      showStatus("Clipboard is empty", true);
      return;
    }

    try {
      await sendExtensionMessage({ type: "ADD_CLIPBOARD_ENTRY", text });
      showStatus("Added from clipboard");
    } catch (error: unknown) {
      console.error("Failed to add clipboard entry:", error);
      showStatus("Could not add clipboard item", true);
    }
  }, [showStatus]);

  return { entries, status, copyEntry, removeEntry, clearEntries, addFromClipboard };
}
