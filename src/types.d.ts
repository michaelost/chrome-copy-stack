interface ClipboardEntry {
  id: string;
  text: string;
  copiedAt: number;
}

type ExtensionMessage =
  | { type: "ADD_CLIPBOARD_ENTRY"; text: string }
  | { type: "ACTIVATE_CLIPBOARD_ENTRY"; id: string }
  | { type: "REMOVE_CLIPBOARD_ENTRY"; id: string }
  | { type: "CLEAR_CLIPBOARD_ENTRIES" };

type ExtensionResponse =
  | { ok: true }
  | { ok: false; error: string };
