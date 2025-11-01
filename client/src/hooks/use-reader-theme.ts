import { useEffect, useRef } from "react";

/**
 * Custom hook to manage theme and dark mode for reader components
 * Saves original theme state on mount and restores it on unmount
 */
export function useReaderTheme(selectedTheme: string, isDarkMode: boolean) {
  const originalThemeRef = useRef<string | null>(null);
  const originalDarkModeRef = useRef<boolean>(false);

  // Save original theme state on mount and restore on unmount
  useEffect(() => {
    originalThemeRef.current = document.documentElement.getAttribute("data-theme");
    originalDarkModeRef.current = document.documentElement.classList.contains("dark");

    return () => {
      if (originalThemeRef.current) {
        document.documentElement.setAttribute("data-theme", originalThemeRef.current);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }

      if (originalDarkModeRef.current) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (selectedTheme !== "original") {
      document.documentElement.setAttribute("data-theme", selectedTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [selectedTheme]);

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);
}
