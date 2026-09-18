import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_TIMEOUT_MS = 1800;

export interface StatusState {
  message: string;
  isError: boolean;
}

export interface UseStatusMessageResult {
  status: StatusState;
  showStatus: (message: string, isError?: boolean) => void;
}

export function useStatusMessage(): UseStatusMessageResult {
  const [status, setStatus] = useState<StatusState>({ message: "", isError: false });
  const statusTimer = useRef<number | undefined>(undefined);

  const showStatus = useCallback((message: string, isError = false) => {
    window.clearTimeout(statusTimer.current);
    setStatus({ message, isError });
    statusTimer.current = window.setTimeout(() => {
      setStatus({ message: "", isError: false });
    }, STATUS_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(statusTimer.current);
    };
  }, []);

  return { status, showStatus };
}
