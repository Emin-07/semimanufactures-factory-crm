import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, getWriteErrorHandler } from "../api/client.js";

const POLL_INTERVAL = 6000;
const POLL_MAX_INTERVAL = 30000; // back off to 30s when server is unreachable

export function usePersisted(key, init) {
  const initVal = typeof init === "function" ? init() : init;
  const [val, setValRaw] = useState(initVal);
  const lastSaved = useRef(null);
  const pollDelay = useRef(POLL_INTERVAL);
  const timerRef = useRef(null);

  useEffect(() => {
    apiFetch(`/api/state/${key}`)
      .then(r => r && r.ok ? r.json() : null)
      .then(data => {
        if (data !== null) {
          lastSaved.current = JSON.stringify(data);
          setValRaw(data);
          pollDelay.current = POLL_INTERVAL; // reset on success
        }
      })
      .catch(() => {});
  }, [key]); // eslint-disable-line

  useEffect(() => {
    let cancelled = false;

    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          const r = await apiFetch(`/api/state/${key}`);
          if (r && r.ok) {
            const data = await r.json();
            if (data !== null) {
              const serialized = JSON.stringify(data);
              if (serialized !== lastSaved.current) {
                lastSaved.current = serialized;
                setValRaw(data);
              }
            }
            pollDelay.current = POLL_INTERVAL; // success → reset
          }
        } catch {
          // Server unreachable — back off exponentially up to max
          pollDelay.current = Math.min(pollDelay.current * 2, POLL_MAX_INTERVAL);
        }
        if (!cancelled) schedule();
      }, pollDelay.current);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [key]); // eslint-disable-line

  const setVal = useCallback((updater) => {
    setValRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const serialized = JSON.stringify(next);
      lastSaved.current = serialized;
      const _onWriteError = getWriteErrorHandler();
      apiFetch(`/api/state/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        retries: 3,
        retryDelay: 1000,
      })
        .then(r => {
          if (r && !r.ok) {
            lastSaved.current = null;
            _onWriteError?.({ key, status: r.status });
          }
        })
        .catch(() => {
          lastSaved.current = null;
          _onWriteError?.({ key, status: 0 });
        });
      return next;
    });
  }, [key]); // eslint-disable-line

  const setLocal = useCallback((updater) => {
    setValRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      lastSaved.current = JSON.stringify(next);
      return next;
    });
  }, []); // eslint-disable-line

  return [val, setVal, setLocal];
}
