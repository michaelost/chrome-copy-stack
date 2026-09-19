# Copy Stack — Current Functionality

A Chrome Manifest V3 extension that keeps the 100 most recently copied text
snippets and lets the user restore, remove, favorite, foldered-organize, or
manually add entries from the toolbar popup — openable by click or by a
keyboard shortcut.

## Architecture

```
manifest.json          → MV3 manifest: permissions, background, popup, content script, commands
src/
  types.d.ts            → Ambient types shared by all scripts (no imports needed)
  storage.ts            → Single source of truth for chrome.storage.local access
  background.ts         → Service worker: owns all storage mutations
  content.ts            → Captures "copy" events on web pages
  popup/
    main.tsx               → React root mount
    App.tsx                 → Popup layout; composes the hooks below
    EntryButton.tsx          → One entry's header (copy/favorite/folder/delete) + text body
    FolderTabs.tsx            → Folder filter tab bar (Ungrouped + folders) + create-folder form
    useClipboardEntries.ts   → Entry CRUD state/actions (takes showStatus as a param)
    useFavoriteActions.ts    → Favorite toggle action (takes showStatus as a param)
    useFolders.ts            → Folder list/selection/create/assign state+actions (takes showStatus as a param)
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
  folderId: string | null; // null = ungrouped. Surfaced in the UI (folders v1).
  isFavorite: boolean;     // Toggled per-entry from the popup; see "Favorites" below.
}

interface Folder {
  id: string;
  name: string;
  createdAt: number;
}
```

`folderId`/`isFavorite` and the `Folder` type were shared-foundation
additions for the folders/favorites features (see
`docs/PARALLEL_FEATURES.md`); both are now fully surfaced in the popup UI.
`getClipboardEntries()` normalizes entries saved before these fields existed
(`folderId ?? null`, `isFavorite ?? false`) on every read, so old and new
data are always fully-shaped, with no version key or one-time migration
needed.

Stored under `chrome.storage.local` key `"clipboardEntries"` (constant
`CLIPBOARD_STORAGE_KEY` in `src/storage.ts`), capped at `MAX_ENTRIES = 100`
and `MAX_TEXT_LENGTH = 20_000` characters (both defined in `background.ts`).
Folders use a separate key, `"clipboardFolders"` (`CLIPBOARD_FOLDERS_STORAGE_KEY`),
with matching `getFolders()`/`saveFolders()` accessors in `src/storage.ts`.

## How data gets in and out

Everything funnels through one `chrome.runtime.onMessage` listener in
`background.ts`, using an `ExtensionMessage` union:

| Message | Sent by | Effect |
|---|---|---|
| `ADD_CLIPBOARD_ENTRY { text }` | `content.ts` on page copy; popup's "Add from clipboard" button | Adds a new entry at the top. If `text` already exists verbatim, the old copy is removed and the entry moves to the top instead of duplicating. No-ops silently if `text` is empty/whitespace; responds with `{ok:false}` (surfaced as an error status in the popup) if `text` is longer than `MAX_TEXT_LENGTH`. |
| `ACTIVATE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry | Moves that entry to the top with a fresh `copiedAt`. |
| `REMOVE_CLIPBOARD_ENTRY { id }` | Popup, clicking an entry's delete button | Removes just that entry. |
| `CLEAR_CLIPBOARD_ENTRIES` | Popup, "Clear all" button | Empties the entire list, regardless of any active folder or favorites filter. |
| `TOGGLE_FAVORITE_ENTRY { id }` | Popup, an entry's star button | Flips that entry's `isFavorite`, in place (no reordering, no `copiedAt` change). |
| `CREATE_FOLDER { name }` | Popup, folder controls' "Add folder" form | Appends a new `Folder` (`id`, trimmed `name`, `createdAt`). No-ops silently if `name` is empty/whitespace. |
| `ASSIGN_ENTRY_TO_FOLDER { id, folderId }` | Popup, an entry's per-entry folder select | Sets that entry's `folderId`. `folderId: null` returns the entry to Ungrouped. Throws if `id` doesn't match an entry, or if `folderId` doesn't match an existing folder. |

All seven are serialized through an in-memory `enqueueStorageUpdate` queue in
`background.ts`, so concurrent messages (e.g. a page copy firing while the
popup is also mutating storage) can't race each other. Every handler
responds with `ExtensionResponse` (`{ok:true}` or `{ok:false,error}`).

The popup never mutates its own local state after sending a message — it
relies entirely on a `chrome.storage.onChanged` listener (in
`useClipboardEntries.ts`, and separately in `useFolders.ts` for the folders
key) to re-read storage and re-render whenever anything changes it,
regardless of source.

## Capturing copies from web pages (`content.ts`)

Runs on every page (`<all_urls>`, all frames, `document_start`). On a
`copy` event, it reads the copied text — from `event.clipboardData`, falling
back to the focused `<input>`/`<textarea>`'s selection, falling back to
`window.getSelection()` — and sends `ADD_CLIPBOARD_ENTRY` if non-empty.
Chrome blocks content scripts on `chrome://` pages and can't see clipboard
activity from outside the browser.

## Filtering (`App.tsx`)

`App.tsx` derives `visibleEntries` from the hook's `entries` by composing
both filters with **AND** semantics, before splitting into current/previous:

```ts
const visibleEntries = entries
  .filter(matchesSelectedFolder)
  .filter((entry) => !showFavoritesOnly || entry.isFavorite);
```

An entry is visible only if it matches the selected folder **and** the
favorites mode. The count badge and "Clear all" visibility stay bound to
the unfiltered `entries` total, since "Clear all" always clears everything
regardless of any active filter.

A folder tab (Ungrouped or a named folder) is always selected — there is no
"All" state — so the filtered empty state can show as soon as
`entries.length > 0` but `visibleEntries.length === 0`:

- Favorites-only is off → "This folder is empty." (also used for an empty
  Ungrouped tab).
- Favorites-only is on → "No entries match the selected folder and
  favorites filter.", regardless of whether the current tab is truly empty
  or just has no favorited entries in it — both statements are still true,
  and distinguishing the two isn't worth a third message now that a tab is
  always active.

The transient status line is its own hook, `useStatusMessage()`, composed
once in `App.tsx` and passed into `useClipboardEntries(showStatus)` as a
parameter — this keeps a single shared status line across `useFolders` and
`useFavoriteActions` too.

## Folders (v1)

`useFolders.ts` owns the folder list (loaded from `getFolders()`, refreshed
on `chrome.storage.onChanged` for `CLIPBOARD_FOLDERS_STORAGE_KEY`) and a
local, unpersisted `selectedFolderId: string` — the sentinel
`UNGROUPED_FOLDER_ID` means "entries with no folder" and is also the
default. There is no "All" state; a folder is always selected. Selection
resets to Ungrouped every time the popup re-opens.

- **`FolderTabs`** (rendered between the header and the entry list): a
  `role="tablist"` of `role="tab"` buttons — Ungrouped is always the first
  tab, followed by each folder in its existing storage order (folders are
  never sorted or reordered) — plus a small form to create a new folder.
  Clicking a tab, or moving focus to it with `ArrowLeft`/`ArrowRight`/
  `Home`/`End` (roving `tabIndex`, automatic activation), selects that
  folder and filters `visibleEntries`. A new folder appears as a new tab as
  soon as `chrome.storage.onChanged` reports it. Folder rename and delete
  are out of scope for v1.
- **Per-entry assignment**: each `EntryButton` renders a compact
  `<select>` (`Ungrouped` + one option per folder) bound to that entry's
  `folderId`. Changing it sends `ASSIGN_ENTRY_TO_FOLDER`, which both moves
  an entry between folders and returns it to Ungrouped (by selecting
  `Ungrouped`, i.e. `folderId: null`).
- **Filtering**: contributes `matchesSelectedFolder` to the AND-composed
  `visibleEntries` derivation described above.

## Favorites

- Each entry can be marked/unmarked as a favorite via its star button in
  `EntryButton.tsx`. The button is an ARIA toggle (`aria-pressed` reflects
  `entry.isFavorite`) with an accessible label that flips between
  "Add to favorites" and "Remove from favorites".
- Toggling calls `useFavoriteActions().toggleFavorite`, which sends
  `TOGGLE_FAVORITE_ENTRY { id }` via `sendExtensionMessage` and reports
  "Could not update favorite" through the shared status line on failure
  (silent on success, same pattern as `removeEntry`).
- `App.tsx` owns one local `showFavoritesOnly` boolean (`useState`, not
  persisted — resets every time the popup re-opens), toggled by the header's
  "Favorites only" button (also an ARIA toggle; its label flips to
  "Showing favorites" while active).
- **Filtering**: contributes the favorites predicate to the AND-composed
  `visibleEntries` derivation described above.

## The popup UI (`App.tsx`)

- **Header**: title, an "Add from clipboard" button, a "Favorites only"
  toggle, a count badge (`N / 100`), and a "Clear all" button (only shown
  once there's at least one entry).
- **Folder tabs** (`FolderTabs`, below the header): a tab bar (Ungrouped
  first, then each folder in storage order) and a create-folder form.
- **Empty state**: shown when there are zero entries at all.
- **Filtered empty state**: shown instead — with the specific wording
  described under "Filtering" above — when there's at least one entry
  overall but the active filter combination matches none.
- **Current** section: the most recent *visible* entry (its own
  copy/favorite/folder-assign/delete controls).
- **Previous** section: every other visible entry, newest first (only shown
  when there is at least one).
- **Status line**: a transient message under the list (green for success,
  red for errors), auto-clearing after 1800ms.

Each `EntryButton` renders a header row of four controls above the entry
text, in this fixed order: a copy icon button copies the text to the system
clipboard (`navigator.clipboard.writeText`) and sends
`ACTIVATE_CLIPBOARD_ENTRY`; the star button sends `TOGGLE_FAVORITE_ENTRY`;
the folder `<select>` sends `ASSIGN_ENTRY_TO_FOLDER`; the small "×" button
sends `REMOVE_CLIPBOARD_ENTRY`. The entry text itself, rendered below the
header, is plain (non-interactive) content — only the header's copy button
triggers a copy.

### Actions and their status messages

(`useClipboardEntries.ts`, `useFavoriteActions.ts`, `useFolders.ts`)

| Action | Success | Failure |
|---|---|---|
| Click an entry's copy button | "Copied to clipboard" | "Could not copy this item" (clipboard write failed — nothing sent to storage) or "Copied, but history was not updated" (clipboard write succeeded, but the activate message failed) |
| Click an entry's "×" (remove) | *(silent)* | "Could not remove this item" |
| Click an entry's star (favorite toggle) | *(silent)* | "Could not update favorite" |
| Change an entry's folder select (assign) | *(silent)* | "Could not move this item" |
| Create a folder | "Folder created" | "Could not create folder" ("Folder name is required" if blank, checked client-side before sending anything) |
| "Clear all" | *(silent)* | "Could not clear clipboard history" |
| "Add from clipboard" | "Added from clipboard" | "Could not read clipboard" (read failed/denied), "Clipboard is empty" (blank/whitespace-only, checked client-side before sending anything), or "Could not add clipboard item" (storage-add failed) |
| Initial load / any storage refresh | *(silent)* | "Could not load clipboard history" / "Could not load folders" |

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
`useFavoriteActions.test.ts`, `useFolders.test.ts`), using a hand-rolled
`chrome.*`/`navigator.clipboard` mock in `test-setup.ts`. `background.ts`/
`content.ts` have no automated tests — manual "Load unpacked" verification
is the acceptance path for those.

Commands: `npm run typecheck`, `npm run test`, `npm run build`, `npm run dev`.
