(() => {
  const STORAGE_KEY = "clipboardEntries";
  const MAX_ENTRIES = 100;

  function isExtensionMessage(value: unknown): value is ExtensionMessage {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const message = value as { type?: unknown; text?: unknown; id?: unknown };

    return (
      (message.type === "ADD_CLIPBOARD_ENTRY" && typeof message.text === "string") ||
      (message.type === "ACTIVATE_CLIPBOARD_ENTRY" && typeof message.id === "string")
    );
  }

  async function getEntries(): Promise<ClipboardEntry[]> {
    const result = await chrome.storage.local.get({
      [STORAGE_KEY]: [] as ClipboardEntry[],
    });

    return result[STORAGE_KEY] as ClipboardEntry[];
  }

  async function saveEntries(entries: ClipboardEntry[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: entries });
  }

  async function addEntry(text: string): Promise<void> {
    if (text.length === 0) {
      return;
    }

    const entries = await getEntries();
    const entry: ClipboardEntry = {
      id: crypto.randomUUID(),
      text,
      copiedAt: Date.now(),
    };
    const nextEntries = [
      entry,
      ...entries.filter((savedEntry) => savedEntry.text !== text),
    ].slice(0, MAX_ENTRIES);

    await saveEntries(nextEntries);
  }

  async function activateEntry(id: string): Promise<void> {
    const entries = await getEntries();
    const selectedEntry = entries.find((entry) => entry.id === id);

    if (!selectedEntry) {
      throw new Error("Clipboard entry not found");
    }

    const nextEntries = [
      { ...selectedEntry, copiedAt: Date.now() },
      ...entries.filter((entry) => entry.id !== id),
    ];

    await saveEntries(nextEntries);
  }

  async function handleMessage(message: ExtensionMessage): Promise<void> {
    if (message.type === "ADD_CLIPBOARD_ENTRY") {
      await addEntry(message.text);
      return;
    }

    await activateEntry(message.id);
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
