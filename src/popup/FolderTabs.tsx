import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { UNGROUPED_FOLDER_ID } from "./useFolders";

interface FolderTabsProps {
  folders: Folder[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
}

export function FolderTabs({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
}: FolderTabsProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const tabs = [
    { id: UNGROUPED_FOLDER_ID, name: "Ungrouped" },
    ...folders.map((folder) => ({ id: folder.id, name: folder.name })),
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onCreateFolder(newFolderName);
    setNewFolderName("");
  }

  function focusAndSelectTab(index: number): void {
    const tab = tabs[index];

    if (!tab) {
      return;
    }

    onSelectFolder(tab.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAndSelectTab((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAndSelectTab((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelectTab(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelectTab(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <section className="folder-tabs">
      <div className="folder-tabs__list" role="tablist" aria-label="Folders">
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selectedFolderId;

          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="entries-panel"
              tabIndex={isSelected ? 0 : -1}
              className={isSelected ? "folder-tab folder-tab--active" : "folder-tab"}
              onClick={() => onSelectFolder(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      <form className="folder-tabs__create" onSubmit={handleCreateSubmit}>
        <input
          type="text"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          aria-label="New folder name"
        />
        <button type="submit" className="folder-tabs__add">
          Add folder
        </button>
      </form>
    </section>
  );
}
