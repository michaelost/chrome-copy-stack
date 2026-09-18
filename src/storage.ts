export const CLIPBOARD_STORAGE_KEY = "clipboardEntries";
export const CLIPBOARD_FOLDERS_STORAGE_KEY = "clipboardFolders";

function normalizeClipboardEntry(entry: ClipboardEntry): ClipboardEntry {
  return {
    ...entry,
    folderId: entry.folderId ?? null,
    isFavorite: entry.isFavorite ?? false,
  };
}

export async function getClipboardEntries(): Promise<ClipboardEntry[]> {
  const result = await chrome.storage.local.get({
    [CLIPBOARD_STORAGE_KEY]: [] as ClipboardEntry[],
  });

  return (result[CLIPBOARD_STORAGE_KEY] as ClipboardEntry[]).map(normalizeClipboardEntry);
}

export async function saveClipboardEntries(entries: ClipboardEntry[]): Promise<void> {
  await chrome.storage.local.set({ [CLIPBOARD_STORAGE_KEY]: entries });
}

export async function getFolders(): Promise<Folder[]> {
  const result = await chrome.storage.local.get({
    [CLIPBOARD_FOLDERS_STORAGE_KEY]: [] as Folder[],
  });

  return result[CLIPBOARD_FOLDERS_STORAGE_KEY] as Folder[];
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  await chrome.storage.local.set({ [CLIPBOARD_FOLDERS_STORAGE_KEY]: folders });
}
