import { useEffect, useRef, useCallback } from "react";

export function useDebouncedProgress(
  onFlush: (positionSeconds: number) => Promise<void> | void,
  delay = 5000
) {
  const lastValueRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const onFlushRef = useRef(onFlush);

  useEffect(() => {
    onFlushRef.current = onFlush;
  }, [onFlush]);

  const flush = useCallback(async () => {
    if (lastValueRef.current == null || isFlushingRef.current) {
      return;
    }

    const valueToFlush = lastValueRef.current;
    lastValueRef.current = null; // Clear immediately to prevent retry spam
    isFlushingRef.current = true;
    try {
      await onFlushRef.current(valueToFlush);
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  const schedule = useCallback((positionSeconds: number) => {
    lastValueRef.current = positionSeconds;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      flush().catch((error) => {
        console.error("Failed to flush progress:", error);
      });
    }, delay);
  }, [delay, flush]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      flush().catch((error) => {
        console.error("Failed to flush progress on unmount:", error);
      });
    };
  }, [flush]);

  return {
    schedule,
    flush,
  };
}
