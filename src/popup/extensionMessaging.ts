export async function sendExtensionMessage(message: ExtensionMessage): Promise<void> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }
}
