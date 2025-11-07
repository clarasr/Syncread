import { useEffect, useRef } from "react";

export function useDebouncedProgress(
  onFlush: (positionSeconds: number) => Promise<void> | void,
  delay = 5000
) {
  const lastValueRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);

  const flush = async () => {
    if (lastValueRef.current == null || isFlushingRef.current) {
      return;
    }

    const valueToFlush = lastValueRef.current;
    lastValueRef.current = null; // Clear immediately to prevent retry spam
    isFlushingRef.current = true;
    try {
      await onFlush(valueToFlush);
    } finally {
      isFlushingRef.current = false;
    }
  };

  const schedule = (positionSeconds: number) => {
    lastValueRef.current = positionSeconds;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      flush().catch((error) => {
        console.error("Failed to flush progress:", error);
      });
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      flush().catch((error) => {
        console.error("Failed to flush progress on unmount:", error);
      });
    };
  }, []);

  return {
    schedule,
    flush,
  };
}
