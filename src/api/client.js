let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

let _onWriteError = null;
export function setWriteErrorHandler(fn) { _onWriteError = fn; }

export function getWriteErrorHandler() { return _onWriteError; }

// Returns null on 401 (triggers logout) or on network failure (server down).
// On first 401, tries POST /api/auth/refresh to get a new access token,
// then retries the original request once. If refresh also fails → logout.
let _refreshing = null; // shared promise to avoid parallel refresh races

async function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// options supports extra fields: retries (default 0), retryDelay (ms, default 1000, doubles each attempt)
export async function apiFetch(url, options, _isRetry = false) {
  const { retries = 0, retryDelay = 1000, ...fetchOptions } = options ?? {};

  const attempt = async () => {
    try {
      const r = await fetch(url, fetchOptions);
      if (r.status === 401) {
        if (_isRetry) { _onUnauthorized?.(); return null; }
        if (!_refreshing) {
          _refreshing = fetch("/api/auth/refresh", { method: "POST" })
            .then(res => res.ok)
            .catch(() => false)
            .finally(() => { _refreshing = null; });
        }
        const refreshed = await _refreshing;
        if (refreshed) return apiFetch(url, options, true);
        _onUnauthorized?.();
        return null;
      }
      return r;
    } catch {
      return null; // network error
    }
  };

  let lastResult = await attempt();
  let remaining = retries;
  let delay = retryDelay;

  while (remaining > 0 && (lastResult === null || lastResult.status >= 500)) {
    await _sleep(delay);
    delay = Math.min(delay * 2, 16000);
    remaining--;
    lastResult = await attempt();
  }

  return lastResult;
}
