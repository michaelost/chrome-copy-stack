import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { CLIPBOARD_FOLDERS_STORAGE_KEY, CLIPBOARD_STORAGE_KEY } from "../storage";

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void;

const storageListeners = new Set<StorageChangeListener>();
let storedData: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (query: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};

        for (const key of Object.keys(query)) {
          result[key] = key in storedData ? storedData[key] : query[key];
        }

        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        storedData = { ...storedData, ...items };
      }),
    },
    onChanged: {
      addListener: vi.fn((listener: StorageChangeListener) => {
        storageListeners.add(listener);
      }),
      removeListener: vi.fn((listener: StorageChangeListener) => {
        storageListeners.delete(listener);
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal("chrome", chromeMock);
Object.defineProperty(globalThis.navigator, "clipboard", {
  configurable: true,
  value: { writeText: vi.fn(), readText: vi.fn() },
});

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

export function getChromeMock() {
  return chromeMock;
}

export function setStoredEntries(entries: ClipboardEntry[]): void {
  storedData[CLIPBOARD_STORAGE_KEY] = entries;
}

export function setStoredFolders(folders: Folder[]): void {
  storedData[CLIPBOARD_FOLDERS_STORAGE_KEY] = folders;
}

export function emitStorageChange(entries: ClipboardEntry[]): void {
  storedData[CLIPBOARD_STORAGE_KEY] = entries;
  const changes = { [CLIPBOARD_STORAGE_KEY]: { newValue: entries } };
  storageListeners.forEach((listener) => listener(changes, "local"));
}

export function emitFolderStorageChange(folders: Folder[]): void {
  storedData[CLIPBOARD_FOLDERS_STORAGE_KEY] = folders;
  const changes = { [CLIPBOARD_FOLDERS_STORAGE_KEY]: { newValue: folders } };
  storageListeners.forEach((listener) => listener(changes, "local"));
}

beforeEach(() => {
  storedData = {};
  storageListeners.clear();
  chromeMock.storage.local.get.mockClear();
  chromeMock.storage.local.set.mockClear();
  chromeMock.storage.onChanged.addListener.mockClear();
  chromeMock.storage.onChanged.removeListener.mockClear();
  chromeMock.runtime.sendMessage.mockReset();
  chromeMock.runtime.sendMessage.mockResolvedValue({ ok: true });
  vi.mocked(navigator.clipboard.writeText).mockReset();
  vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
  vi.mocked(navigator.clipboard.readText).mockReset();
  vi.mocked(navigator.clipboard.readText).mockResolvedValue("");
});

afterEach(() => {
  cleanup();
});
