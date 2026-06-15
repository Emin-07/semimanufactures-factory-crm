const STORAGE_KEY = "mealify_hidden_warnings";

export function loadHiddenWarnings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHiddenWarnings(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* quota */ }
}

export function isWarningHidden(map, id) {
  return Boolean(map[id]);
}

export function hideWarning(map, id) {
  const next = { ...map, [id]: { hiddenAt: new Date().toISOString() } };
  saveHiddenWarnings(next);
  return next;
}

export function restoreWarning(map, id) {
  const next = { ...map };
  delete next[id];
  saveHiddenWarnings(next);
  return next;
}

export function warningId(type, entityId, dateKey = new Date().toISOString().slice(0, 10)) {
  return `${type}:${entityId ?? "x"}:${dateKey}`;
}
