(() => {
  const countElement = document.querySelector<HTMLSpanElement>("#entry-count")!;
  const currentSection = document.querySelector<HTMLElement>("#current-section")!;
  const currentEntryElement = document.querySelector<HTMLDivElement>("#current-entry")!;
  const historySection = document.querySelector<HTMLElement>("#history-section")!;
  const historyList = document.querySelector<HTMLDivElement>("#history-list")!;
  const emptyState = document.querySelector<HTMLParagraphElement>("#empty-state")!;
  const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
  let statusTimer: number | undefined;

  function showStatus(message: string, isError = false): void {
    window.clearTimeout(statusTimer);
    statusElement.textContent = message;
    statusElement.classList.toggle("status--error", isError);
    statusTimer = window.setTimeout(() => {
      statusElement.textContent = "";
      statusElement.classList.remove("status--error");
    }, 1800);
  }

  async function copyEntry(entry: ClipboardEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.text);
    } catch (error: unknown) {
      console.error("Failed to copy saved text:", error);
      showStatus("Could not copy this item", true);
      return;
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: "ACTIVATE_CLIPBOARD_ENTRY",
        id: entry.id,
      } satisfies ExtensionMessage)) as ExtensionResponse;

      if (!response.ok) {
        throw new Error(response.error);
      }

      showStatus("Copied to clipboard");
    } catch (error: unknown) {
      console.error("Copied text but failed to update clipboard history:", error);
      showStatus("Copied, but history was not updated", true);
    }
  }

  function createEntryButton(entry: ClipboardEntry, className: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.title = "Copy this text";

    const textElement = document.createElement("span");
    textElement.className = "entry__text";
    textElement.textContent = entry.text;
    button.append(textElement);
    button.addEventListener("click", () => {
      void copyEntry(entry);
    });

    return button;
  }

  function render(entries: ClipboardEntry[]): void {
    const [currentEntry, ...previousEntries] = entries;
    countElement.textContent = `${entries.length} / 100`;
    emptyState.hidden = entries.length > 0;
    currentSection.hidden = !currentEntry;
    historySection.hidden = previousEntries.length === 0;
    currentEntryElement.replaceChildren();
    historyList.replaceChildren();

    if (currentEntry) {
      currentEntryElement.append(createEntryButton(currentEntry, "entry entry--current"));
    }

    previousEntries.forEach((entry) => {
      historyList.append(createEntryButton(entry, "entry"));
    });
  }

  async function refresh(): Promise<void> {
    try {
      render(await getClipboardEntries());
    } catch (error: unknown) {
      console.error("Failed to load clipboard history:", error);
      showStatus("Could not load clipboard history", true);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && CLIPBOARD_STORAGE_KEY in changes) {
      void refresh();
    }
  });

  void refresh();
})();
