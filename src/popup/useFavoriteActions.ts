import { useCallback } from "react";
import { sendExtensionMessage } from "./extensionMessaging";

interface UseFavoriteActionsResult {
  toggleFavorite: (entry: ClipboardEntry) => Promise<void>;
}

export function useFavoriteActions(
  showStatus: (message: string, isError?: boolean) => void,
): UseFavoriteActionsResult {
  const toggleFavorite = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        await sendExtensionMessage({ type: "TOGGLE_FAVORITE_ENTRY", id: entry.id });
      } catch (error: unknown) {
        console.error("Failed to update favorite state:", error);
        showStatus("Could not update favorite", true);
      }
    },
    [showStatus],
  );

  return { toggleFavorite };
}
