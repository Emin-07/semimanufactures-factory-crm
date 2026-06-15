import { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { AppContext } from "../context/AppContext.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Badge, Btn, Inp, Modal, Stat, Toast, Card, PageH, ProgressBar, StatusPill, EmptyState } from "../components/ui/index.jsx";
import { packingProgress } from "../utils/orders.js";
import { isManagerLike } from "../utils/roles.js";
import { apiFetch } from "../api/client.js";
import { listItem, spring } from "../motion/presets.js";
import { useAppMotion } from "../motion/MotionProvider.jsx";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "urgent", label: "Срочные" },
  { id: "new", label: "Новые" },
  { id: "packing", label: "Фасуются" },
  { id: "ready", label: "Готовы" },
];

const PackingPage = () => {
  const { currentUser, clientOrders, setClientOrdersL, clients, applyServerState } = useContext(AppContext);
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [qtyInputs, setQtyInputs] = useState({});
  const managerView = isManagerLike(currentUser);
  const { reduceMotion } = useAppMotion();

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      if (managerView) {
        const active = (clientOrders || [])
          .filter(o => !o.deleted && !["отгружен", "отменён"].includes(o.status))
          .map(o => {
            const cl = clients.find(c => c.id === o.clientId);
            return {
              orderId: o.id,
              storeName: cl?.name || "?",
              addressSnapshot: o.addressSnapshot || cl?.address,
              priority: o.priority,
              status: o.status,
              packingStatus: o.packingStatus || "не начата",
              items: (o.items || []).map(it => ({
                productId: it.productId,
                productName: it.productName,
                unit: it.unit,
                qty: it.qty,
                packedQty: it.packedQty ?? 0,
              })),
              note: o.note,
              createdAt: o.orderDate,
            };
          });
        setQueue(active);
      } else {
        const r = await apiFetch("/api/actions/packing/queue");
        if (!r?.ok) { setToast({ message: "Не удалось загрузить очередь", type: "error" }); return; }
        const data = await r.json();
        setQueue(data.queue || []);
      }
    } catch {
      setToast({ message: "Нет связи с сервером", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [managerView, clientOrders, clients]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const filtered = useMemo(() => {
    let list = [...queue];
    if (filter === "urgent") list = list.filter(o => o.priority === "срочный");
    else if (filter === "new") list = list.filter(o => (o.packingStatus || "не начата") === "не начата");
    else if (filter === "packing") list = list.filter(o => o.packingStatus === "фасуется");
    else if (filter === "ready") list = list.filter(o => o.packingStatus === "готов к доставке");
    const pri = { срочный: 0, важный: 1, нормальный: 2 };
    return list.sort((a, b) => (pri[a.priority] ?? 2) - (pri[b.priority] ?? 2));
  }, [queue, filter]);

  const kpis = useMemo(() => ({
    waiting: queue.filter(o => (o.packingStatus || "не начата") === "не начата").length,
    packing: queue.filter(o => o.packingStatus === "фасуется").length,
    ready: queue.filter(o => o.packingStatus === "готов к доставке").length,
    urgent: queue.filter(o => o.priority === "срочный").length,
  }), [queue]);

  const applyPacking = async (orderId, body) => {
    if (managerView) {
      setToast({ message: "Фасовку отмечает фасовщица через рабочий аккаунт", type: "warn" });
      return;
    }
    try {
      const r = await apiFetch("/api/actions/packing/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...body }),
      });
      const data = await r?.json();
      if (!r?.ok) { setToast({ message: data?.error || "Ошибка", type: "error" }); return; }
      if (data.dk_client_orders) setClientOrdersL(data.dk_client_orders);
      applyServerState(data);
      setQueue(data.queue || []);
      const updated = (data.queue || []).find(o => o.orderId === orderId);
      if (updated) setActiveOrder(updated);
      setToast({ message: "Обновлено", type: "success" });
    } catch {
      setToast({ message: "Нет связи", type: "error" });
    }
  };

  const openOrder = o => {
    setActiveOrder(o);
    const inputs = {};
    (o.items || []).forEach(it => { inputs[it.productId] = it.packedQty ?? 0; });
    setQtyInputs(inputs);
  };

  return (
    <div className="mobile-card-list">
      <PageH title="Фасовка заказов" sub="Отметьте каждый товар в заказе">
        <Btn v="secondary" sz="sm" onClick={loadQueue} icon={<I.refresh size={14} />}>Обновить</Btn>
      </PageH>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <Stat icon={<I.box size={18} />} label="Ждут фасовки" value={kpis.waiting} color={C.info} />
        <Stat icon={<I.factory size={18} />} label="Фасуются" value={kpis.packing} color={C.orange} />
        <Stat icon={<I.check size={18} />} label="Готовы к доставке" value={kpis.ready} color={C.success} />
        <Stat icon={<I.alert size={18} />} label="Срочные" value={kpis.urgent} color={kpis.urgent ? C.danger : C.dim} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`period-tab${filter === f.id ? " active" : ""}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.dim }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<I.box size={36} />} title="Нет заказов на фасовку" sub="Новые заказы появятся здесь автоматически" />
      ) : (
        <LayoutGroup>
        <motion.div layout style={{ display: "grid", gap: 12 }}>
          <AnimatePresence mode="popLayout">
          {filtered.map(o => {
            const prog = packingProgress(o.items);
            const urgent = o.priority === "срочный";
            const ready = o.packingStatus === "готов к доставке";
            return (
              <motion.div
                key={o.orderId}
                layout
                variants={listItem}
                initial="hidden"
                animate="show"
                exit="exit"
                transition={spring.soft}
              >
              <Card
                layout
                s={{
                  border: urgent ? `1px solid ${C.danger}45` : ready ? `1px solid ${C.success}40` : undefined,
                  boxShadow: urgent && !reduceMotion ? `0 0 24px ${C.danger}15` : ready && !reduceMotion ? `0 0 20px ${C.success}12` : undefined,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{o.storeName}</div>
                    {o.addressSnapshot && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{o.addressSnapshot}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {urgent && <StatusPill color="danger" pulse>Срочный</StatusPill>}
                      <StatusPill color={ready ? "success" : o.packingStatus === "фасуется" ? "orange" : "info"}>
                        {ready ? "Готов к доставке" : o.packingStatus || "не начата"}
                      </StatusPill>
                    </div>
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{prog.done}/{prog.total} позиций</div>
                    <ProgressBar value={prog.pct} color={ready ? C.success : C.orange} />
                  </div>
                  <Btn onClick={() => openOrder(o)} sz="sm">{ready ? "Просмотр" : "Открыть фасовку"}</Btn>
                </div>
              </Card>
              {ready && !reduceMotion && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 11, color: C.success, fontWeight: 600, marginTop: 6, textAlign: "center" }}>
                  <I.check size={13} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
                  Заказ готов к доставке
                </motion.div>
              )}
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
        </LayoutGroup>
      )}

      <Modal open={!!activeOrder} onClose={() => setActiveOrder(null)} title={`Фасовка · ${activeOrder?.storeName || ""}`} width={560}>
        {activeOrder && (
          <div style={{ display: "grid", gap: 12 }}>
            {(activeOrder.items || []).map(it => {
              const left = Math.max(0, it.qty - (it.packedQty ?? 0));
              const done = left === 0;
              return (
                <div key={it.productId} style={{ padding: 12, borderRadius: 14, background: "rgba(0,0,0,.22)", border: `1px solid ${done ? C.success + "35" : "rgba(255,255,255,.08)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{it.productName}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                        Нужно: {it.qty} {it.unit} · Готово: {it.packedQty ?? 0} · Осталось: {left}
                      </div>
                    </div>
                    {done && <Badge color="success">Готово</Badge>}
                  </div>
                  {!managerView && !done && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <Btn sz="sm" v="secondary" onClick={() => applyPacking(activeOrder.orderId, { productId: it.productId, packedQtyDelta: 1 })}>+1</Btn>
                      <Inp
                        type="number"
                        value={qtyInputs[it.productId] ?? it.packedQty ?? 0}
                        onChange={e => setQtyInputs(p => ({ ...p, [it.productId]: e.target.value }))}
                        cStyle={{ marginBottom: 0, flex: "1 1 80px", minWidth: 80 }}
                        style={{ padding: "7px 10px" }}
                      />
                      <Btn sz="sm" onClick={() => applyPacking(activeOrder.orderId, { productId: it.productId, packedQty: +(qtyInputs[it.productId] ?? 0) })}>
                        Сохранить
                      </Btn>
                      <Btn sz="sm" v="success" onClick={() => applyPacking(activeOrder.orderId, { productId: it.productId, packedQty: it.qty })}>
                        Товар готов
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
            {activeOrder.packingStatus === "готов к доставке" && (
              <div style={{ textAlign: "center", padding: 12, color: C.success, fontWeight: 700 }}>
                <I.check size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Заказ готов к доставке
              </div>
            )}
          </div>
        )}
      </Modal>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

export { PackingPage };
