# Parallel Feature Work: Shortcut, Folders, Favorites

This describes how the keyboard-shortcut, folders, and favorites features
are meant to be built concurrently in separate Git worktrees, on top of the
shared foundation added in this same slice (see `docs/FUNCTIONALITY.md` for
what that foundation actually contains).

## Shared contracts

These already exist on `main` before any worktree is created, and are the
only things all three features can rely on without coordinating further:

- `ClipboardEntry` has `folderId: string | null` and `isFavorite: boolean`,
  both normalized on every read (`getClipboardEntries()` in `src/storage.ts`)
  so old and new stored data are always fully-shaped.
- `Folder { id, name, createdAt }` exists as a type; `CLIPBOARD_FOLDERS_STORAGE_KEY`,
  `getFolders()`, `saveFolders()` exist in `src/storage.ts`.
- `sendExtensionMessage(message)` (`src/popup/extensionMessaging.ts`) is the
  one way the popup sends a message and turns `{ok:false}` into a thrown
  error — reuse it, don't re-implement send+check+throw.
- `useStatusMessage()` (`src/popup/useStatusMessage.ts`) is the one shared
  status line. `App.tsx` owns the single instance and passes `showStatus`
  into whatever hook needs to report success/failure. **Do not call
  `useStatusMessage()` a second time** — that would create a second,
  independent status line instead of sharing the one in the UI.
- `useClipboardEntries(showStatus)` takes `showStatus` as its first
  parameter; it no longer owns status internally.
- `App.tsx` derives `visibleEntries` from `entries` (currently an identity
  pass-through) before splitting into current/previous. **This is the one
  designated place to layer in filtering** — see "Filtering data flow" below.
- The `count` badge and `Clear all`'s visibility stay bound to the
  unfiltered `entries.length`, never to `visibleEntries` — per product
  decision, Clear all always clears everything regardless of any active
  filter, so its own visibility/count context must reflect the true total.

## Filtering data flow (folders + favorites)

Smallest coherent solution, no Context, no external store:

- Each feature owns exactly one piece of local `useState` in `App.tsx`'s
  composition: folders owns `selectedFolderId: string | null` (`null` =
  "All"); favorites owns `showFavoritesOnly: boolean`. Both default to the
  "no filter" state and are **not persisted** — they reset every time the
  popup re-opens.
- `visibleEntries` becomes the AND of both filters applied to `entries`,
  e.g. `entries.filter(matchesFolder).filter(matchesFavorite)`. Whichever
  feature merges second adds its own `.filter(...)` call next to the
  other's — a small, appended, easily-resolved diff on one line in `App.tsx`,
  not a restructure.
- Each feature is responsible for its **own empty-state messaging** when
  its filter yields zero visible entries while `entries.length > 0` (e.g.
  "This folder is empty" / "No favorites yet") — the existing generic
  empty-state paragraph is keyed to `entries.length === 0` (true global
  emptiness) and must not be repurposed for "filter matched nothing."

## Feature ownership

| | May modify | Must not modify |
|---|---|---|
| **Shortcut** | `manifest.json` (`commands` key) only | Anything under `src/` |
| **Folders** | `src/types.d.ts` (append its own `ExtensionMessage` variants only), `src/background.ts` (append its own switch cases), new `src/popup/useFolders.ts` + folder-selector component(s), `src/popup/App.tsx` (its own filter state + one import/JSX line), `src/popup/EntryButton.tsx` (its own per-entry "assign to folder" control — confirmed in scope), `popup.css` (append) | `src/popup/useClipboardEntries.ts`, `src/popup/useStatusMessage.ts`, `src/popup/extensionMessaging.ts`, `src/storage.ts`, `src/content.ts`, favorites' files |
| **Favorites** | `src/types.d.ts` (append its own message variant), `src/background.ts` (append its own case), new `src/popup/useFavoriteActions.ts` (or similar), `src/popup/App.tsx` (its own filter state + one import/JSX line), `src/popup/EntryButton.tsx` (its own star toggle button), `popup.css` (append) | Same shared files as folders, plus folders' own files |

All three: never edit the *existing* logic inside `copyEntry`/`removeEntry`/
`clearEntries`/`addFromClipboard`, never touch `src/content.ts`, never
rewrite an existing test's assertions (only add new tests).

## Likely shared-file conflicts

- **`src/types.d.ts`** — both folders and favorites append their own
  `ExtensionMessage` union members. Mechanical, low-risk; append at the
  end of the union, don't reorder existing members.
- **`src/background.ts`** — both append their own `case` to the same
  `switch` in `handleMessage`. Group each feature's cases together; don't
  interleave with existing cases or reformat the switch.
- **`src/popup/App.tsx`** — both add one filter `useState` + one
  `.filter()` call to the `visibleEntries` derivation, plus one new header
  control each (import + JSX line). Keep each feature's addition in its
  own clearly-delimited block.
- **`src/popup/EntryButton.tsx`** — both folders (assign-to-folder control)
  and favorites (star toggle) add a new sibling button. Confirmed,
  accepted, small diff — whoever merges second adds their button next to
  the other's, no restructuring needed.
- **`popup.css`** — both append new classes. Purely additive, essentially
  conflict-free.

**Not a conflict:** the shortcut feature touches none of the above.

## Worktree responsibilities

- `worktrees/shortcut` → branch `feature/keyboard-shortcut`
- `worktrees/folders` → branch `feature/folders`
- `worktrees/favorites` → branch `feature/favorites`

All three branch from `main` **after** this shared-foundation slice merges.

**Folders v1 scope:** create a folder, assign an entry to a folder, move an
entry between folders, return an entry to Ungrouped, view entries by
folder (including an "Ungrouped" view). Rename and delete are explicitly
out of scope for v1.

**Favorites v1 scope:** toggle favorite on/off per entry, persist the
state (already normalized by the shared foundation), view/filter by
favorites-only.

**Shortcut v1 scope:** bind a keyboard shortcut to open the existing popup
via the manifest's reserved `_execute_action` command — Chrome handles
this natively; no background listener or popup code change is needed.

## Validation requirements (each worktree, before opening a PR)

- `npm run typecheck`, `npm run test`, `npm run build` all green.
- All pre-existing tests still pass, **unmodified** (only new tests added).
- Manual "Load unpacked" verification of the new feature.
- `docs/FUNCTIONALITY.md` updated to describe the new feature's behavior.

## Integration order

1. **Shortcut** — trivial, zero shared-file overlap, mergeable immediately.
2. **Favorites** — smaller surface than folders (no new entity/storage key).
3. **Folders** — largest surface; rebase onto `main` after favorites lands
   (same pattern used earlier in this project when a squash-merge required
   a stacked branch to rebase before its own PR).

## Stop-the-line rule

**A feature worktree must stop and ask before proceeding if it discovers it
needs to change a shared contract** — meaning any of: the shape of
`ClipboardEntry` or `Folder`, the signature of `sendExtensionMessage`,
`useStatusMessage`, or `useClipboardEntries`, the `visibleEntries`
derivation point in `App.tsx`, or anything listed under "Shared contracts"
above. If a feature's design turns out to need one of these to change, that
is a cross-cutting decision affecting the other two worktrees and must be
resolved centrally, not decided unilaterally inside one branch.
