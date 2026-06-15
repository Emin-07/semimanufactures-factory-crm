/** Магазин вычеркнут из активной работы (ЧС / blocked) */
export function isStoreBlacklisted(store) {
  if (!store) return false;
  return (
    store.blacklisted === true ||
    store.isBlacklisted === true ||
    store.status === "blacklist" ||
    store.status === "blocked"
  );
}
