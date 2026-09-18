interface EntryButtonProps {
  entry: ClipboardEntry;
  variant: "current" | "history";
  onCopy: (entry: ClipboardEntry) => void;
  onRemove: (entry: ClipboardEntry) => void;
  onToggleFavorite: (entry: ClipboardEntry) => void;
}

export function EntryButton({
  entry,
  variant,
  onCopy,
  onRemove,
  onToggleFavorite,
}: EntryButtonProps) {
  const className = variant === "current" ? "entry entry--current" : "entry";
  const favoriteClassName = entry.isFavorite
    ? "entry__favorite entry__favorite--active"
    : "entry__favorite";
  const favoriteLabel = entry.isFavorite ? "Remove from favorites" : "Add to favorites";

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
        className={favoriteClassName}
        title={favoriteLabel}
        aria-label={favoriteLabel}
        aria-pressed={entry.isFavorite}
        onClick={() => onToggleFavorite(entry)}
      >
        <span aria-hidden="true">{entry.isFavorite ? "★" : "☆"}</span>
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
