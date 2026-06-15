import { useState, useCallback } from "react";

export function useLocalStorage(key, init) {
  const [val, setValRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : (typeof init === "function" ? init() : init);
    } catch { return typeof init === "function" ? init() : init; }
  });
  const setVal = useCallback((updater) => {
    setValRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]); // eslint-disable-line
  return [val, setVal];
}
