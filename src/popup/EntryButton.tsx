interface EntryButtonProps {
  entry: ClipboardEntry;
  variant: "current" | "history";
  onCopy: (entry: ClipboardEntry) => void;
}

export function EntryButton({ entry, variant, onCopy }: EntryButtonProps) {
  const className = variant === "current" ? "entry entry--current" : "entry";

  return (
    <button type="button" className={className} title="Copy this text" onClick={() => onCopy(entry)}>
      <span className="entry__text">{entry.text}</span>
    </button>
  );
}
