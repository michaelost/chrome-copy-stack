# Copy Stack

A Chrome Manifest V3 extension that keeps the 100 most recently copied text values. Open the extension popup to view the current clipboard value and copy any previous value back to the clipboard.

## Build

```sh
npm install
npm run build
```

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

After rebuilding, reload the extension from `chrome://extensions`.

## Behavior

- New copied text is added to the top of the stack.
- Copying the same text again moves it to the top instead of creating a duplicate.
- Clicking a saved entry copies it and moves it to the top.
- History is stored locally and removed when the extension is uninstalled.

Chrome does not allow content scripts on browser-internal pages such as `chrome://` pages, and this extension cannot capture copies made outside Chrome.
