/** Normalize order item with packing fallbacks */
export function normalizeOrderItem(it, product) {
  return {
    productId: it.productId,
    productName: it.productName || product?.name || "?",
    unit: it.unit || product?.unit || "",
    qty: it.qty,
    packedQty: it.packedQty ?? 0,
    packedBy: it.packedBy ?? null,
    packedAt: it.packedAt ?? null,
  };
}

export function computePackingStatus(items) {
  const list = items || [];
  if (!list.length) return "не начата";
  const allDone = list.every(it => (it.packedQty ?? 0) >= it.qty);
  const someDone = list.some(it => (it.packedQty ?? 0) > 0);
  if (allDone) return "готов к доставке";
  if (someDone) return "фасуется";
  return "не начата";
}

export function packingProgress(items) {
  const list = items || [];
  if (!list.length) return { done: 0, total: 0, pct: 0 };
  const total = list.length;
  const done = list.filter(it => (it.packedQty ?? 0) >= it.qty).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function enrichOrder(order, products, clients) {
  const client = clients?.find(c => c.id === order.clientId);
  const items = (order.items || []).map(it =>
    normalizeOrderItem(it, products?.find(p => p.id === it.productId))
  );
  const packingStatus = order.packingStatus || computePackingStatus(items);
  return {
    ...order,
    items,
    packingStatus,
    deliveryStatus: order.deliveryStatus || "ожидает",
    courierId: order.courierId ?? null,
    readyForDeliveryAt: order.readyForDeliveryAt ?? null,
    deliveryStartedAt: order.deliveryStartedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    deliveryComment: order.deliveryComment || "",
    stockDeductedAt: order.stockDeductedAt ?? null,
    storeName: client?.name,
    storePhone: client?.phone,
    storeContact: client?.contact,
  };
}

export function inferNotifCategory(n) {
  if (n.category) return n.category;
  const t = `${n.title || ""} ${n.content || ""}`.toLowerCase();
  if (t.includes("задан")) return "task";
  if (t.includes("заказ") || t.includes("фасов") || t.includes("достав")) return "order";
  if (t.includes("долг")) return "debt";
  if (t.includes("сырь") || t.includes("остаток") || t.includes("склад")) return "stock";
  if (n.type === "ошибка" || n.severity === "critical") return "urgent";
  return "system";
}
