import { EntryButton } from "./EntryButton";
import { useClipboardEntries } from "./useClipboardEntries";
import { useStatusMessage } from "./useStatusMessage";

export function App() {
  const { status, showStatus } = useStatusMessage();
  const { entries, copyEntry, removeEntry, clearEntries, addFromClipboard } =
    useClipboardEntries(showStatus);
  // Folders/favorites will narrow this to the active filter before the
  // current/previous split; the count badge below stays bound to the
  // unfiltered `entries` since it reflects total storage usage (N / 100).
  const visibleEntries = entries;
  const [currentEntry, ...previousEntries] = visibleEntries;
  const statusClassName = status.isError ? "status status--error" : "status";

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
          <span className="count">{entries.length} / 100</span>
          {entries.length > 0 && (
            <button type="button" className="clear-all" onClick={clearEntries}>
              Clear all
            </button>
          )}
        </div>
      </header>

      <main>
        {entries.length === 0 && (
          <p className="empty-state">Copy text on a web page and it will appear here.</p>
        )}

        {currentEntry && (
          <section>
            <h2>Current</h2>
            <EntryButton
              entry={currentEntry}
              variant="current"
              onCopy={copyEntry}
              onRemove={removeEntry}
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
