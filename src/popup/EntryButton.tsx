interface EntryButtonProps {
  entry: ClipboardEntry;
  variant: "current" | "history";
  onCopy: (entry: ClipboardEntry) => void;
  onRemove: (entry: ClipboardEntry) => void;
}

export function EntryButton({ entry, variant, onCopy, onRemove }: EntryButtonProps) {
  const className = variant === "current" ? "entry entry--current" : "entry";

  return (
    <div className={className}>
      <button
        type="button"
        className="entry__copy"
        title="Copy this text"
        onClick={() => onCopy(entry)}
      >
        <span className="entry__text">{entry.text}</span>
      </button>
      <button
        type="button"
        className="entry__delete"
        title="Remove this item"
        aria-label="Remove this item"
        onClick={() => onRemove(entry)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
