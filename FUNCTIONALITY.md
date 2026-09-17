# Copy Stack — Current Functionality

A Chrome Manifest V3 extension that keeps the 100 most recently copied text
snippets and lets the user restore, remove, or manually add entries from the
toolbar popup.

## Architecture

```
manifest.json          → MV3 manifest: permissions, background, popup, content script
src/
  types.d.ts            → Ambient types shared by all scripts (no imports needed)
  storage.ts            → Single source of truth for chrome.storage.local access
  background.ts         → Service worker: owns all storage mutations
  content.ts            → Captures "copy" events on web pages
  popup/
    main.tsx             → React root mount
    App.tsx               → Popup layout
    EntryButton.tsx        → One entry's copy + delete controls
    useClipboardEntries.ts → All popup state/actions (the hook App.tsx uses)
popup.html / popup.css → Popup shell and styling
```

Built with Vite + the CRXJS plugin (`npm run build` / `npm run dev`).
`background.ts`/`content.ts` are plain TypeScript (no React); only the popup
uses React 19.

## Data model (`src/types.d.ts`)

```ts
interface ClipboardEntry {
  id: string;        // crypto.randomUUID()
  text: string;
  copiedAt: number;  // Date.now()
}
```

Stored under `chrome.storage.local` key `"clipboardEntries"` (constant
`CLIPBOARD_STORAGE_KEY` in `src/storage.ts`), capped at `MAX_ENTRIES = 100`
and `MAX_TEXT_LENGTH = 20_000` characters (both defined in `background.ts`).

## How data gets in and out

Everything funnels through one `chrome.runtime.onMessage` listener in
`background.ts`, using an `ExtensionMessage` union:

| Message | Sent by | Effect |
|---|---|---|
| `ADD_CLIPBOARD_ENTRY { text }` | `content.ts` on page copy; popup's "Add from clipboard" button | Adds a new entry at the top. If `text` already exists verbatim, the old copy is removed and the entry moves to the top instead of duplicating. No-ops silently if `text` is empty/whitespace or longer than `MAX_TEXT_LENGTH`. |
| `ACTIVATE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry | Moves that entry to the top with a fresh `copiedAt`. |
| `REMOVE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry's delete button | Removes just that entry. |
| `CLEAR_CLIPBOARD_ENTRIES` | Popup, "Clear all" button | Empties the entire list. |

All four are serialized through an in-memory `enqueueStorageUpdate` queue in
`background.ts`, so concurrent messages (e.g. a page copy firing while the
popup is also mutating storage) can't race each other. Every handler
responds with `ExtensionResponse` (`{ok:true}` or `{ok:false,error}`).

The popup never mutates its own local state after sending a message — it
relies entirely on a `chrome.storage.onChanged` listener (in
`useClipboardEntries.ts`) to re-read storage and re-render whenever anything
changes it, regardless of source.

## Capturing copies from web pages (`content.ts`)

Runs on every page (`<all_urls>`, all frames, `document_start`). On a
`copy` event, it reads the copied text — from `event.clipboardData`, falling
back to the focused `<input>`/`<textarea>`'s selection, falling back to
`window.getSelection()` — and sends `ADD_CLIPBOARD_ENTRY` if non-empty.
Chrome blocks content scripts on `chrome://` pages and can't see clipboard
activity from outside the browser.

## The popup UI (`App.tsx`)

- **Header**: title, an "Add from clipboard" button, a count badge
  (`N / 100`), and a "Clear all" button (only shown once there's at least
  one entry).
- **Empty state**: shown when there are zero entries.
- **Current** section: the most recent entry (its own copy/delete controls).
- **Previous** section: every other entry, newest first (only shown when
  there is at least one).
- **Status line**: a transient message under the list (green for success,
  red for errors), auto-clearing after 1800ms.

Each `EntryButton` renders two controls: clicking the text copies it to the
system clipboard (`navigator.clipboard.writeText`) and sends
`ACTIVATE_CLIPBOARD_ENTRY`; the small "×" button sends
`REMOVE_CLIPBOARD_ENTRY` without copying anything.

### Actions and their status messages (`useClipboardEntries.ts`)

| Action | Success | Failure |
|---|---|---|
| Click an entry (copy) | "Copied to clipboard" | "Could not copy this item" (clipboard write failed — nothing sent to storage) or "Copied, but history was not updated" (clipboard write succeeded, but the activate message failed) |
| Click an entry's "×" (remove) | *(silent)* | "Could not remove this item" |
| "Clear all" | *(silent)* | "Could not clear clipboard history" |
| "Add from clipboard" | "Added from clipboard" | "Could not read clipboard" (read failed/denied), "Clipboard is empty" (blank/whitespace-only, checked client-side before sending anything), or "Could not add clipboard item" (storage-add failed) |
| Initial load / any storage refresh | *(silent)* | "Could not load clipboard history" |

"Add from clipboard" reads the OS clipboard via `navigator.clipboard.readText()`
called directly inside the button's click handler (no background polling or
listening) and sends it through the same `ADD_CLIPBOARD_ENTRY` message
`content.ts` uses — so it gets the same dedup/trim/limit behavior for free.

## Permissions (`manifest.json`)

`storage`, `clipboardWrite`, `clipboardRead` — no host permissions beyond the
content script's own `<all_urls>` match.

## Testing

Vitest + Testing Library, jsdom environment. Tests live next to their source
under `src/popup/` (`App.test.tsx`, `useClipboardEntries.test.ts`), using a
hand-rolled `chrome.*`/`navigator.clipboard` mock in `test-setup.ts`.
`background.ts`/`content.ts` have no automated tests — manual "Load
unpacked" verification is the acceptance path for those.

Commands: `npm run typecheck`, `npm run test`, `npm run build`, `npm run dev`.
