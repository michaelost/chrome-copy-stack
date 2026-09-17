import { EntryButton } from "./EntryButton";
import { useClipboardEntries } from "./useClipboardEntries";

export function App() {
  const { entries, status, copyEntry } = useClipboardEntries();
  const [currentEntry, ...previousEntries] = entries;
  const statusClassName = status.isError ? "status status--error" : "status";

  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">Clipboard history</p>
          <h1>Copy Stack</h1>
        </div>
        <span className="count">{entries.length} / 100</span>
      </header>

      <main>
        {entries.length === 0 && (
          <p className="empty-state">Copy text on a web page and it will appear here.</p>
        )}

        {currentEntry && (
          <section>
            <h2>Current</h2>
            <EntryButton entry={currentEntry} variant="current" onCopy={copyEntry} />
          </section>
        )}

        {previousEntries.length > 0 && (
          <section>
            <h2>Previous</h2>
            <div className="history-list">
              {previousEntries.map((entry) => (
                <EntryButton key={entry.id} entry={entry} variant="history" onCopy={copyEntry} />
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
