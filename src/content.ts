(() => {
  function getInputSelection(element: HTMLInputElement | HTMLTextAreaElement): string {
    const selectionStart = element.selectionStart;
    const selectionEnd = element.selectionEnd;

    if (selectionStart === null || selectionEnd === null) {
      return "";
    }

    return element.value.slice(selectionStart, selectionEnd);
  }

  function getCopiedText(event: ClipboardEvent): string {
    const clipboardText = event.clipboardData?.getData("text/plain");

    if (clipboardText) {
      return clipboardText;
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return getInputSelection(event.target);
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
