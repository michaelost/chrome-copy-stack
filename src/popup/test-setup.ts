import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void;

const storageListeners = new Set<StorageChangeListener>();
let storedEntries: ClipboardEntry[] = [];

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async () => ({ clipboardEntries: storedEntries })),
      set: vi.fn(),
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

export function getChromeMock() {
  return chromeMock;
}

export function setStoredEntries(entries: ClipboardEntry[]): void {
  storedEntries = entries;
}

export function emitStorageChange(entries: ClipboardEntry[]): void {
  storedEntries = entries;
  const changes = { clipboardEntries: { newValue: entries } };
  storageListeners.forEach((listener) => listener(changes, "local"));
}

beforeEach(() => {
  storedEntries = [];
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
