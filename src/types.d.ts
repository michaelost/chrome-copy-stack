interface ClipboardEntry {
  id: string;
  text: string;
  copiedAt: number;
  folderId: string | null;
  isFavorite: boolean;
}

interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

type ExtensionMessage =
  | { type: "ADD_CLIPBOARD_ENTRY"; text: string }
  | { type: "ACTIVATE_CLIPBOARD_ENTRY"; id: string }
  | { type: "REMOVE_CLIPBOARD_ENTRY"; id: string }
  | { type: "CLEAR_CLIPBOARD_ENTRIES" }
  | { type: "TOGGLE_FAVORITE_ENTRY"; id: string }
  | { type: "CREATE_FOLDER"; name: string }
  | { type: "ASSIGN_ENTRY_TO_FOLDER"; id: string; folderId: string | null };

type ExtensionResponse =
  | { ok: true }
  | { ok: false; error: string };
