let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

let _onWriteError = null;
export function setWriteErrorHandler(fn) { _onWriteError = fn; }

export function getWriteErrorHandler() { return _onWriteError; }

// Returns null on 401 (triggers logout) or on network failure (server down).
// On first 401, tries POST /api/auth/refresh to get a new access token,
// then retries the original request once. If refresh also fails → logout.
let _refreshing = null; // shared promise to avoid parallel refresh races

export async function apiFetch(url, options, _isRetry = false) {
  try {
    const r = await fetch(url, options);
    if (r.status === 401) {
      if (_isRetry) { _onUnauthorized?.(); return null; }

      // Only one refresh at a time — queue concurrent callers behind the same promise
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
    // Network error / ECONNREFUSED — server is down or not yet started
    return null;
  }
}
