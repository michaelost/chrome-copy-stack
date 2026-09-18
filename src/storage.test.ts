import { describe, expect, it } from "vitest";
import { setStoredEntries, setStoredFolders } from "./popup/test-setup";
import { getClipboardEntries, getFolders, saveFolders } from "./storage";

describe("getClipboardEntries", () => {
  it("normalizes entries saved before folders/favorites existed", async () => {
    setStoredEntries([{ id: "a", text: "alpha", copiedAt: 1 } as ClipboardEntry]);

    const entries = await getClipboardEntries();

    expect(entries).toEqual([
      { id: "a", text: "alpha", copiedAt: 1, folderId: null, isFavorite: false },
    ]);
  });

  it("preserves folderId and isFavorite when already present", async () => {
    setStoredEntries([
      { id: "a", text: "alpha", copiedAt: 1, folderId: "f1", isFavorite: true },
    ]);

    const entries = await getClipboardEntries();

    expect(entries).toEqual([
      { id: "a", text: "alpha", copiedAt: 1, folderId: "f1", isFavorite: true },
    ]);
  });
});

describe("getFolders / saveFolders", () => {
  it("returns an empty array when nothing is stored", async () => {
    expect(await getFolders()).toEqual([]);
  });

  it("round-trips folders through storage", async () => {
    await saveFolders([{ id: "f1", name: "Work", createdAt: 1 }]);

    expect(await getFolders()).toEqual([{ id: "f1", name: "Work", createdAt: 1 }]);
  });

  it("setStoredFolders seeds storage directly for read-path tests", async () => {
    setStoredFolders([{ id: "f2", name: "Personal", createdAt: 2 }]);

    expect(await getFolders()).toEqual([{ id: "f2", name: "Personal", createdAt: 2 }]);
  });
});
