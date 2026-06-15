import { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { AppContext } from "../context/AppContext.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Badge, Btn, Modal, Stat, Toast, Card, PageH, StatusPill, EmptyState, Txa } from "../components/ui/index.jsx";
import { isManagerLike } from "../utils/roles.js";
import { apiFetch } from "../api/client.js";
import { listItem, spring, fadeUp } from "../motion/presets.js";
import { useAppMotion } from "../motion/MotionProvider.jsx";

const DeliveryPage = () => {
  const { currentUser, setClientOrdersL, users, applyServerState } = useContext(AppContext);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deliverModal, setDeliverModal] = useState(null);
  const [comment, setComment] = useState("");
  const managerView = isManagerLike(currentUser);
  const { reduceMotion } = useAppMotion();

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/actions/delivery/queue");
      if (!r?.ok) {
        const data = await r?.json().catch(() => ({}));
        setToast({ message: data?.error || "Не удалось загрузить", type: "error" });
        return;
      }
      const data = await r.json();
      setQueue(data.queue || []);
    } catch {
      setToast({ message: "Нет связи", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const kpis = useMemo(() => ({
    ready: queue.filter(o => o.packingStatus === "готов к доставке" && (o.deliveryStatus || "ожидает") === "ожидает").length,
    delivering: queue.filter(o => o.deliveryStatus === "в доставке").length,
    mine: queue.filter(o => o.courierId === currentUser.id && o.deliveryStatus === "в доставке").length,
    urgent: queue.filter(o => o.priority === "срочный" && o.deliveryStatus !== "доставлен").length,
  }), [queue, currentUser.id]);

  const applyAction = async (url, body) => {
    try {
      const r = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r?.json();
      if (!r?.ok) { setToast({ message: data?.error || "Ошибка", type: "error" }); return; }
      if (data.dk_client_orders) setClientOrdersL(data.dk_client_orders);
      applyServerState(data);
      setQueue(data.queue || []);
      setDeliverModal(null);
      setComment("");
      setToast({ message: "Готово", type: "success" });
    } catch {
      setToast({ message: "Нет связи", type: "error" });
    }
  };

  const cardState = o => {
    const packing = o.packingStatus !== "готов к доставке" && o.status !== "готов";
    if (packing) return "packing";
    if (o.deliveryStatus === "доставлен") return "delivered";
    if (o.deliveryStatus === "в доставке") return "delivering";
    return "ready";
  };

  return (
    <div className="mobile-card-list">
      <PageH title="Доставка" sub="Только полностью расфасованные заказы">
        <Btn v="secondary" sz="sm" onClick={loadQueue} icon={<I.refresh size={14} />}>Обновить</Btn>
      </PageH>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <Stat icon={<I.check size={18} />} label="Готовы" value={kpis.ready} color={C.success} />
        <Stat icon={<I.truck size={18} />} label="В доставке" value={kpis.delivering} color={C.purple} />
        <Stat icon={<I.user size={18} />} label="У меня" value={kpis.mine} color={C.info} />
        <Stat icon={<I.alert size={18} />} label="Срочные" value={kpis.urgent} color={kpis.urgent ? C.danger : C.dim} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.dim }}>Загрузка...</div>
      ) : queue.length === 0 ? (
        <EmptyState icon={<I.truck size={36} />} title="Нет заказов" sub="Готовые заказы появятся после фасовки" />
      ) : (
        <LayoutGroup>
        <motion.div layout style={{ display: "grid", gap: 12 }}>
          <AnimatePresence mode="popLayout">
          {queue.map(o => {
            const st = cardState(o);
            const disabled = st === "packing";
            const courier = users.find(u => u.id === o.courierId);
            return (
              <motion.div key={o.orderId} layout variants={listItem} initial="hidden" animate="show" exit="exit">
              <Card
                layout
                s={{
                  opacity: disabled ? 0.72 : 1,
                  border: o.priority === "срочный" ? `1px solid ${C.danger}40` : st === "ready" ? `1px solid ${C.success}35` : undefined,
                  boxShadow: st === "ready" && !reduceMotion ? `0 0 18px ${C.success}10` : undefined,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{o.storeName}</div>
                    {o.address && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><I.location size={12} /> {o.address}</div>}
                    {(o.contact || o.phone) && (
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
                        {o.contact && <span>{o.contact}</span>}
                        {o.phone && <span>{o.contact ? " · " : ""}<I.phone size={12} style={{ verticalAlign: "text-bottom", marginRight: 3 }} />{o.phone}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
                      {(o.items || []).map(it => `${it.productName} ×${it.qty}`).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {disabled && (
                      <StatusPill color="orange">
                        <span style={{ display: "inline-block", animation: "pulseGlow 1.2s infinite" }}>◌</span> Фасуется
                      </StatusPill>
                    )}
                    {st === "ready" && (
                      <StatusPill color="success"><I.check size={12} style={{ marginRight: 4, verticalAlign: "text-bottom" }} />Готов к доставке</StatusPill>
                    )}
                    {st === "delivering" && (
                      <StatusPill color="purple">В доставке{courier ? ` · ${courier.name.split(" ")[0]}` : ""}</StatusPill>
                    )}
                    {st === "delivered" && (
                      <motion.span initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} transition={spring.snappy} style={{ display: "inline-flex" }}>
                        <StatusPill color="success">Доставлен</StatusPill>
                      </motion.span>
                    )}

                    {(st === "ready") && (
                      <motion.div variants={fadeUp} initial="hidden" animate="show">
                      <Btn v="success" sz="sm" onClick={() => applyAction("/api/actions/delivery/take", { orderId: o.orderId })} icon={<I.truck size={14} />}>
                        Взять на доставку
                      </Btn>
                      </motion.div>
                    )}
                    {st === "delivering" && (o.courierId === currentUser.id || managerView) && (
                      <Btn sz="sm" onClick={() => setDeliverModal(o)} icon={<I.check size={14} />}>Доставлено</Btn>
                    )}
                    {disabled && (
                      <Btn sz="sm" disabled style={{ opacity: 0.5 }}>Ждёт фасовку</Btn>
                    )}
                  </div>
                </div>
              </Card>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
        </LayoutGroup>
      )}

      <Modal open={!!deliverModal} onClose={() => setDeliverModal(null)} title="Подтвердить доставку" width={420}>
        {deliverModal && (
          <>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
              {deliverModal.storeName} · заказ #{deliverModal.orderId}
            </p>
            <Txa label="Комментарий (необязательно)" value={comment} onChange={e => setComment(e.target.value)} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn v="secondary" onClick={() => setDeliverModal(null)}>Отмена</Btn>
              <Btn v="success" onClick={() => applyAction("/api/actions/delivery/delivered", { orderId: deliverModal.orderId, deliveryComment: comment })}>
                Доставлено
              </Btn>
            </div>
          </>
        )}
      </Modal>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

export { DeliveryPage };
