import { useState } from "react";
import { EntryButton } from "./EntryButton";
import { FolderSelector } from "./FolderSelector";
import { useClipboardEntries } from "./useClipboardEntries";
import { useFavoriteActions } from "./useFavoriteActions";
import { useFolders } from "./useFolders";
import { useStatusMessage } from "./useStatusMessage";

export function App() {
  const { status, showStatus } = useStatusMessage();
  const { entries, copyEntry, removeEntry, clearEntries, addFromClipboard } =
    useClipboardEntries(showStatus);
  const { toggleFavorite } = useFavoriteActions(showStatus);
  const {
    folders,
    selectedFolderId,
    selectFolder,
    createFolder,
    assignEntryToFolder,
    matchesSelectedFolder,
  } = useFolders(showStatus);
  // Favorites: local, not-persisted filter (resets every popup open) that
  // narrows `entries` before the current/previous split. The count badge
  // and Clear all below stay bound to the unfiltered `entries` since Clear
  // all always clears everything regardless of any active filter. Folder
  // and favorites filters compose with AND semantics.
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const visibleEntries = entries
    .filter(matchesSelectedFolder)
    .filter((entry) => !showFavoritesOnly || entry.isFavorite);
  const [currentEntry, ...previousEntries] = visibleEntries;
  const statusClassName = status.isError ? "status status--error" : "status";
  const isFolderFiltered = selectedFolderId !== null;
  const showFilteredEmptyState =
    entries.length > 0 && visibleEntries.length === 0 && (isFolderFiltered || showFavoritesOnly);
  const filteredEmptyStateMessage =
    isFolderFiltered && showFavoritesOnly
      ? "No entries match the selected folder and favorites filter."
      : isFolderFiltered
        ? "This folder is empty."
        : "No favorites yet.";
  const favoritesFilterLabel = showFavoritesOnly ? "Showing favorites" : "Favorites only";

  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">Clipboard history</p>
          <h1>Copy Stack</h1>
        </div>
        <div className="header__actions">
          <button type="button" className="add-from-clipboard" onClick={addFromClipboard}>
            Add from clipboard
          </button>
          <button
            type="button"
            className="favorites-filter"
            aria-pressed={showFavoritesOnly}
            onClick={() => setShowFavoritesOnly((value) => !value)}
          >
            {favoritesFilterLabel}
          </button>
          <span className="count">{entries.length} / 100</span>
          {entries.length > 0 && (
            <button type="button" className="clear-all" onClick={clearEntries}>
              Clear all
            </button>
          )}
        </div>
      </header>

      <FolderSelector
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={selectFolder}
        onCreateFolder={createFolder}
      />

      <main>
        {entries.length === 0 && (
          <p className="empty-state">Copy text on a web page and it will appear here.</p>
        )}

        {showFilteredEmptyState && <p className="empty-state">{filteredEmptyStateMessage}</p>}

        {currentEntry && (
          <section>
            <h2>Current</h2>
            <EntryButton
              entry={currentEntry}
              variant="current"
              onCopy={copyEntry}
              onRemove={removeEntry}
              onToggleFavorite={toggleFavorite}
              folders={folders}
              onAssignFolder={assignEntryToFolder}
            />
          </section>
        )}

        {previousEntries.length > 0 && (
          <section>
            <h2>Previous</h2>
            <div className="history-list">
              {previousEntries.map((entry) => (
                <EntryButton
                  key={entry.id}
                  entry={entry}
                  variant="history"
                  onCopy={copyEntry}
                  onRemove={removeEntry}
                  onToggleFavorite={toggleFavorite}
                  folders={folders}
                  onAssignFolder={assignEntryToFolder}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <p className={statusClassName} role="status" aria-live="polite">
        {status.message}
      </p>
    </>
  );
}
