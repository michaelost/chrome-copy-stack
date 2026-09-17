import { getClipboardEntries, saveClipboardEntries } from "./storage";

(() => {
  const MAX_ENTRIES = 100;
  const MAX_TEXT_LENGTH = 20_000;
  let storageUpdateQueue: Promise<void> = Promise.resolve();

  function isExtensionMessage(value: unknown): value is ExtensionMessage {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const message = value as { type?: unknown; text?: unknown; id?: unknown };

    return (
      (message.type === "ADD_CLIPBOARD_ENTRY" && typeof message.text === "string") ||
      (message.type === "ACTIVATE_CLIPBOARD_ENTRY" && typeof message.id === "string") ||
      (message.type === "REMOVE_CLIPBOARD_ENTRY" && typeof message.id === "string") ||
      message.type === "CLEAR_CLIPBOARD_ENTRIES"
    );
  }

  async function addEntry(text: string): Promise<void> {
    if (text.trim().length === 0) {
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error("Clipboard text is too long to save");
    }

    const entries = await getClipboardEntries();
    const entry: ClipboardEntry = {
      id: crypto.randomUUID(),
      text,
      copiedAt: Date.now(),
    };
    const nextEntries = [
      entry,
      ...entries.filter((savedEntry) => savedEntry.text !== text),
    ].slice(0, MAX_ENTRIES);

    await saveClipboardEntries(nextEntries);
  }

  async function activateEntry(id: string): Promise<void> {
    const entries = await getClipboardEntries();
    const selectedEntry = entries.find((entry) => entry.id === id);

    if (!selectedEntry) {
      throw new Error("Clipboard entry not found");
    }

    const nextEntries = [
      { ...selectedEntry, copiedAt: Date.now() },
      ...entries.filter((entry) => entry.id !== id),
    ];

    await saveClipboardEntries(nextEntries);
  }

  async function removeEntry(id: string): Promise<void> {
    const entries = await getClipboardEntries();
    const nextEntries = entries.filter((entry) => entry.id !== id);

    await saveClipboardEntries(nextEntries);
  }

  async function clearEntries(): Promise<void> {
    await saveClipboardEntries([]);
  }

  function enqueueStorageUpdate(update: () => Promise<void>): Promise<void> {
    const queuedUpdate = storageUpdateQueue.then(update);
    storageUpdateQueue = queuedUpdate.then(
      () => undefined,
      () => undefined,
    );

    return queuedUpdate;
  }

  function handleMessage(message: ExtensionMessage): Promise<void> {
    return enqueueStorageUpdate(() => {
      switch (message.type) {
        case "ADD_CLIPBOARD_ENTRY":
          return addEntry(message.text);
        case "ACTIVATE_CLIPBOARD_ENTRY":
          return activateEntry(message.id);
        case "REMOVE_CLIPBOARD_ENTRY":
          return removeEntry(message.id);
        case "CLEAR_CLIPBOARD_ENTRIES":
          return clearEntries();
        default:
          return message satisfies never;
      }
    });
  }

  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (response: ExtensionResponse) => void) => {
      if (!isExtensionMessage(message)) {
        return false;
      }

      void handleMessage(message)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : "Unknown error";
          console.error("Failed to update clipboard history:", error);
          sendResponse({ ok: false, error: messageText });
        });

      return true;
    },
  );
})();
