export const CLIPBOARD_STORAGE_KEY = "clipboardEntries";

export async function getClipboardEntries(): Promise<ClipboardEntry[]> {
  const result = await chrome.storage.local.get({
    [CLIPBOARD_STORAGE_KEY]: [] as ClipboardEntry[],
  });

  return result[CLIPBOARD_STORAGE_KEY] as ClipboardEntry[];
}

export async function saveClipboardEntries(entries: ClipboardEntry[]): Promise<void> {
  await chrome.storage.local.set({ [CLIPBOARD_STORAGE_KEY]: entries });
}
