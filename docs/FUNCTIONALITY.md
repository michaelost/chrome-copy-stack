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
    main.tsx               → React root mount
    App.tsx                 → Popup layout; composes the hooks below
    EntryButton.tsx          → One entry's copy + favorite + delete controls
    useClipboardEntries.ts   → Entry CRUD state/actions (takes showStatus as a param)
    useFavoriteActions.ts    → Favorite toggle action (takes showStatus as a param)
    useStatusMessage.ts      → The one shared transient status line
    extensionMessaging.ts    → sendExtensionMessage() (send + ok-check + throw)
popup.html / popup.css → Popup shell and styling
```

Built with Vite + the CRXJS plugin (`npm run build` / `npm run dev`).
`background.ts`/`content.ts` are plain TypeScript (no React); only the popup
uses React 19.

## Data model (`src/types.d.ts`)

```ts
interface ClipboardEntry {
  id: string;              // crypto.randomUUID()
  text: string;
  copiedAt: number;        // Date.now()
  folderId: string | null; // null = ungrouped. Not yet surfaced in the UI.
  isFavorite: boolean;     // Toggled per-entry from the popup; see "Favorites" below.
}

interface Folder {
  id: string;
  name: string;
  createdAt: number;
}
```

`folderId` and the `Folder` type are shared-foundation additions for the
upcoming folders feature (see `docs/PARALLEL_FEATURES.md`) — no UI reads or
writes `folderId` yet. `isFavorite` is now surfaced in the popup (see
"Favorites" below). `getClipboardEntries()` normalizes entries saved before
these fields existed (`folderId ?? null`, `isFavorite ?? false`) on every
read, so old and new data are always fully-shaped, with no version key or
one-time migration needed.

Stored under `chrome.storage.local` key `"clipboardEntries"` (constant
`CLIPBOARD_STORAGE_KEY` in `src/storage.ts`), capped at `MAX_ENTRIES = 100`
and `MAX_TEXT_LENGTH = 20_000` characters (both defined in `background.ts`).
Folders will use a separate key, `"clipboardFolders"` (`CLIPBOARD_FOLDERS_STORAGE_KEY`),
with matching `getFolders()`/`saveFolders()` accessors already in place.

## How data gets in and out

Everything funnels through one `chrome.runtime.onMessage` listener in
`background.ts`, using an `ExtensionMessage` union:

| Message | Sent by | Effect |
|---|---|---|
| `ADD_CLIPBOARD_ENTRY { text }` | `content.ts` on page copy; popup's "Add from clipboard" button | Adds a new entry at the top. If `text` already exists verbatim, the old copy is removed and the entry moves to the top instead of duplicating. No-ops silently if `text` is empty/whitespace; responds with `{ok:false}` (surfaced as an error status in the popup) if `text` is longer than `MAX_TEXT_LENGTH`. |
| `ACTIVATE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry | Moves that entry to the top with a fresh `copiedAt`. |
| `REMOVE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry's delete button | Removes just that entry. |
| `CLEAR_CLIPBOARD_ENTRIES` | Popup, "Clear all" button | Empties the entire list. |
| `TOGGLE_FAVORITE_ENTRY { id }` | Popup, an entry's star button | Flips that entry's `isFavorite`, in place (no reordering, no `copiedAt` change). |

All five are serialized through an in-memory `enqueueStorageUpdate` queue in
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

`App.tsx` derives `visibleEntries` from the hook's `entries` before splitting
into current/previous — today it's an identity pass-through, but it's the
designated insertion point for folder/favorites filtering (see
`docs/PARALLEL_FEATURES.md`). The count badge and "Clear all" visibility
stay bound to the unfiltered `entries` total, since "Clear all" always
clears everything regardless of any active filter.

The transient status line is now its own hook, `useStatusMessage()`,
composed once in `App.tsx` and passed into `useClipboardEntries(showStatus)`
as a parameter — this keeps a single shared status line even once other
hooks (folders, favorites) also need to report success/failure into it.

## The popup UI (`App.tsx`)

- **Header**: title, an "Add from clipboard" button, a "Favorites only"
  toggle, a count badge (`N / 100`), and a "Clear all" button (only shown
  once there's at least one entry).
- **Empty state**: shown when there are zero entries.
- **Favorites empty state**: shown instead when the favorites filter is
  active, there's at least one entry overall, but none are favorited
  ("No favorites yet.").
- **Current** section: the most recent *visible* entry (its own
  copy/favorite/delete controls).
- **Previous** section: every other visible entry, newest first (only shown
  when there is at least one).
- **Status line**: a transient message under the list (green for success,
  red for errors), auto-clearing after 1800ms.

Each `EntryButton` renders three controls: clicking the text copies it to the
system clipboard (`navigator.clipboard.writeText`) and sends
`ACTIVATE_CLIPBOARD_ENTRY`; the star button sends `TOGGLE_FAVORITE_ENTRY`
without copying anything; the small "×" button sends
`REMOVE_CLIPBOARD_ENTRY` without copying anything.

## Favorites

- Each entry can be marked/unmarked as a favorite via its star button in
  `EntryButton.tsx`. The button is an ARIA toggle (`aria-pressed` reflects
  `entry.isFavorite`) with an accessible label that flips between
  "Add to favorites" and "Remove from favorites".
- Toggling calls `useFavoriteActions().toggleFavorite`, which sends
  `TOGGLE_FAVORITE_ENTRY { id }` via `sendExtensionMessage` and reports
  "Could not update favorite" through the shared status line on failure
  (silent on success, same pattern as `removeEntry`). The popup never
  mutates local state directly — like every other action, it relies on the
  `chrome.storage.onChanged` listener in `useClipboardEntries.ts` to
  re-read storage and re-render.
- `App.tsx` owns one local `showFavoritesOnly` boolean (`useState`, not
  persisted — resets every time the popup re-opens), toggled by the header's
  "Favorites only" button (also an ARIA toggle; its label flips to
  "Showing favorites" while active).
- `visibleEntries` in `App.tsx` filters `entries` down to favorites only
  when `showFavoritesOnly` is true, **before** the Current/Previous split —
  this is the shared filtering insertion point described in
  `docs/PARALLEL_FEATURES.md`. The count badge and "Clear all" stay bound to
  the unfiltered `entries`, so "Clear all" always clears the complete
  history regardless of the active filter.

### Actions and their status messages (`useClipboardEntries.ts`, `useFavoriteActions.ts`)

| Action | Success | Failure |
|---|---|---|
| Click an entry (copy) | "Copied to clipboard" | "Could not copy this item" (clipboard write failed — nothing sent to storage) or "Copied, but history was not updated" (clipboard write succeeded, but the activate message failed) |
| Click an entry's "×" (remove) | *(silent)* | "Could not remove this item" |
| Click an entry's star (favorite toggle) | *(silent)* | "Could not update favorite" |
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

## Keyboard shortcut (`manifest.json`)

A `commands` entry binds Chrome's reserved `_execute_action` command to
`Ctrl+Shift+K` (`Command+Shift+K` on macOS), opening the toolbar popup exactly
as if the user clicked the extension icon. Chrome handles `_execute_action`
natively — there is no background listener or popup code involved. Users can
rebind or disable it at `chrome://extensions/shortcuts`.

## Testing

Vitest + Testing Library, jsdom environment. Tests live next to their source
under `src/popup/` (`App.test.tsx`, `useClipboardEntries.test.ts`,
`useFavoriteActions.test.ts`), using a hand-rolled `chrome.*`/
`navigator.clipboard` mock in `test-setup.ts`.
`background.ts`/`content.ts` have no automated tests — manual "Load
unpacked" verification is the acceptance path for those.

Commands: `npm run typecheck`, `npm run test`, `npm run build`, `npm run dev`.
