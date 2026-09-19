interface EntryButtonProps {
  entry: ClipboardEntry;
  variant: "current" | "history";
  onCopy: (entry: ClipboardEntry) => void;
  onRemove: (entry: ClipboardEntry) => void;
  onToggleFavorite: (entry: ClipboardEntry) => void;
  folders: Folder[];
  onAssignFolder: (entry: ClipboardEntry, folderId: string | null) => void;
}

export function EntryButton({
  entry,
  variant,
  onCopy,
  onRemove,
  onToggleFavorite,
  folders,
  onAssignFolder,
}: EntryButtonProps) {
  const className = variant === "current" ? "entry entry--current" : "entry";
  const favoriteClassName = entry.isFavorite
    ? "entry__favorite entry__favorite--active"
    : "entry__favorite";
  const favoriteLabel = entry.isFavorite ? "Remove from favorites" : "Add to favorites";

  return (
    <div className={className}>
      <div className="entry__header">
        <button
          type="button"
          className="entry__copy"
          title="Copy this text"
          aria-label="Copy this text"
          onClick={() => onCopy(entry)}
        >
          <span aria-hidden="true">⧉</span>
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
        <select
          className="entry__folder-select"
          title="Assign to folder"
          aria-label="Assign to folder"
          value={entry.folderId ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onAssignFolder(entry, value === "" ? null : value);
          }}
        >
          <option value="">Ungrouped</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
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
      <p className="entry__text">{entry.text}</p>
    </div>
  );
}
