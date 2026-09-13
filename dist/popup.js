"use strict";
(() => {
    const STORAGE_KEY = "clipboardEntries";
    const countElement = document.querySelector("#entry-count");
    const currentSection = document.querySelector("#current-section");
    const currentEntryElement = document.querySelector("#current-entry");
    const historySection = document.querySelector("#history-section");
    const historyList = document.querySelector("#history-list");
    const emptyState = document.querySelector("#empty-state");
    const statusElement = document.querySelector("#status");
    let statusTimer;
    async function getEntries() {
        const result = await chrome.storage.local.get({
            [STORAGE_KEY]: [],
        });
        return result[STORAGE_KEY];
    }
    function showStatus(message, isError = false) {
        window.clearTimeout(statusTimer);
        statusElement.textContent = message;
        statusElement.classList.toggle("status--error", isError);
        statusTimer = window.setTimeout(() => {
            statusElement.textContent = "";
            statusElement.classList.remove("status--error");
        }, 1800);
    }
    async function copyEntry(entry) {
        try {
            await navigator.clipboard.writeText(entry.text);
            const response = (await chrome.runtime.sendMessage({
                type: "ACTIVATE_CLIPBOARD_ENTRY",
                id: entry.id,
            }));
            if (!response.ok) {
                throw new Error(response.error);
            }
            showStatus("Copied to clipboard");
        }
        catch (error) {
            console.error("Failed to copy saved text:", error);
            showStatus("Could not copy this item", true);
        }
    }
    function createEntryButton(entry, className) {
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
    function render(entries) {
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
    async function refresh() {
        try {
            render(await getEntries());
        }
        catch (error) {
            console.error("Failed to load clipboard history:", error);
            showStatus("Could not load clipboard history", true);
        }
    }
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && STORAGE_KEY in changes) {
            void refresh();
        }
    });
    void refresh();
})();
