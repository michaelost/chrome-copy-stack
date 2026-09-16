(() => {
  function getInputSelection(element: HTMLInputElement | HTMLTextAreaElement): string | null {
    try {
      const selectionStart = element.selectionStart;
      const selectionEnd = element.selectionEnd;

      if (selectionStart === null || selectionEnd === null) {
        return null;
      }

      return element.value.slice(selectionStart, selectionEnd);
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        console.error("Failed to read input selection:", error);
      }

      return null;
    }
  }

  function getCopiedText(event: ClipboardEvent): string {
    const clipboardText = event.clipboardData?.getData("text/plain");

    if (clipboardText) {
      return clipboardText;
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      const inputSelection = getInputSelection(event.target);

      if (inputSelection !== null) {
        return inputSelection;
      }
    }

    return window.getSelection()?.toString() ?? "";
  }

  document.addEventListener(
    "copy",
    (event) => {
      const text = getCopiedText(event);

      if (text.length === 0) {
        return;
      }

      void chrome.runtime
        .sendMessage({ type: "ADD_CLIPBOARD_ENTRY", text } satisfies ExtensionMessage)
        .catch((error: unknown) => {
          console.error("Failed to save copied text:", error);
        });
    },
    true,
  );
})();
