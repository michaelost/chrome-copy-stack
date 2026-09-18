import { useState, type ChangeEvent, type FormEvent } from "react";
import { UNGROUPED_FOLDER_ID } from "./useFolders";

interface FolderSelectorProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
}

export function FolderSelector({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
}: FolderSelectorProps) {
  const [newFolderName, setNewFolderName] = useState("");

  function handleFilterChange(event: ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    onSelectFolder(value === "" ? null : value);
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onCreateFolder(newFolderName);
    setNewFolderName("");
  }

  return (
    <section className="folder-controls">
      <label className="folder-controls__filter">
        <span className="folder-controls__label">Folder</span>
        <select
          value={selectedFolderId ?? ""}
          onChange={handleFilterChange}
          aria-label="Filter by folder"
        >
          <option value="">All</option>
          <option value={UNGROUPED_FOLDER_ID}>Ungrouped</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <form className="folder-controls__create" onSubmit={handleCreateSubmit}>
        <input
          type="text"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          aria-label="New folder name"
        />
        <button type="submit" className="folder-controls__add">
          Add folder
        </button>
      </form>
    </section>
  );
}
