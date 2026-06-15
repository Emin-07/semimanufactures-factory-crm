import { useState, useEffect, useMemo, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { AppContext } from "../../context/AppContext.js";
import { relTime } from "../../utils/dates.js";
import { inferNotifCategory } from "../../utils/orders.js";
import { buildDashboardWarnings } from "../../utils/dashboardWarnings.js";
import { isWarningHidden } from "../../utils/hiddenWarnings.js";
import { C } from "../../theme/colors.js";
import { I } from "../../icons/Icons.jsx";
import { Badge } from "../../components/ui/index.jsx";
import { dropdown, spring, stagger, listItem, t } from "../../motion/presets.js";
import { useAppMotion } from "../../motion/MotionProvider.jsx";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "urgent", label: "Срочные" },
  { id: "task", label: "Задания" },
  { id: "order", label: "Заказы" },
  { id: "debt", label: "Долги" },
  { id: "stock", label: "Склад" },
  { id: "hidden", label: "Скрытые" },
];

const NotificationBell = ({ onGoToPage, isMobile }) => {
  const {
    notifications,
    setNotifsL,
    currentUser,
    rawMaterials,
    products,
    tasks,
    users,
    marks,
    productionOutputs,
    debts,
    hiddenWarningsMap,
    hideWarningItem,
    restoreWarningItem,
  } = useContext(AppContext);
  const { reduceMotion } = useAppMotion();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const h = e => {
      const inBtn = btnRef.current && btnRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inBtn && !inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const notifVisible = useMemo(() => {
    return (notifications || [])
      .filter(n => n.targetAll || n.targetUsers?.includes(currentUser.id))
      .map(n => ({ ...n, kind: "notification" }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notifications, currentUser]);

  const warningItems = useMemo(() => {
    return buildDashboardWarnings({
      rawMaterials,
      products,
      tasks,
      users,
      marks,
      productionOutputs,
      debts,
    }).map(w => ({
      ...w,
      hidden: isWarningHidden(hiddenWarningsMap, w.warningId || w.id),
    }));
  }, [rawMaterials, products, tasks, users, marks, productionOutputs, debts, hiddenWarningsMap]);

  const mergedItems = useMemo(() => {
    return [...warningItems, ...notifVisible].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [warningItems, notifVisible]);

  const filtered = useMemo(() => {
    if (filter === "hidden") {
      return warningItems.filter(n => n.hidden);
    }
    const active = mergedItems.filter(n => n.kind !== "warning" || !n.hidden);
    if (filter === "all") return active;
    if (filter === "urgent") {
      return active.filter(n =>
        n.severity === "critical" || n.type === "ошибка" ||
        inferNotifCategory(n) === "urgent" ||
        (n.title || "").toLowerCase().includes("сроч")
      );
    }
    return active.filter(n => inferNotifCategory(n) === filter);
  }, [mergedItems, warningItems, filter]);

  const unread = notifVisible.filter(n => !n.readBy?.includes(currentUser.id)).length;

  const markRead = async id => {
    try {
      const r = await fetch("/api/actions/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.dk_notifications) setNotifsL(data.dk_notifications);
    } catch { /* network */ }
  };

  const markAllRead = async () => {
    try {
      const r = await fetch("/api/actions/notifications/read-all", { method: "POST" });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.dk_notifications) setNotifsL(data.dk_notifications);
    } catch { /* network */ }
  };

  const handleAction = n => {
    const page = n.action?.page;
    if (page) {
      setOpen(false);
      onGoToPage(page);
    } else {
      setOpen(false);
      onGoToPage("notifications");
    }
  };

  const nColor = n => {
    if (n.kind === "warning") return n.severity === "critical" ? C.danger : C.orange;
    if (n.severity === "critical" || n.type === "ошибка") return C.danger;
    if (n.type === "предупреждение" || n.severity === "warning") return C.orange;
    return C.info;
  };

  const markerColor = (n, isRead) => {
    if (n.kind === "warning") return n.hidden ? "transparent" : C.orange;
    if (isRead) return "transparent";
    if (n.severity === "critical" || n.type === "ошибка") return C.danger;
    if (n.type === "предупреждение") return C.orange;
    return C.primary;
  };

  const panelStyle = isMobile
    ? {
        position: "fixed",
        left: 12,
        right: 12,
        top: 64,
        maxHeight: "calc(100vh - 90px)",
        width: "auto",
      }
    : {
        position: "fixed",
        right: 16,
        top: 92,
        width: 420,
        maxHeight: 520,
      };

  const panelVariants = reduceMotion
    ? { hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0, transition: t.fast } }
    : dropdown;

  return (
    <div ref={btnRef} style={{ position: "relative" }}>
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={!reduceMotion ? { scale: 1.04 } : undefined}
        whileTap={!reduceMotion ? { scale: 0.96 } : undefined}
        transition={spring.snappy}
        style={{
          position: "relative",
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 10,
          cursor: "pointer",
          padding: 7,
          color: C.muted,
          display: "flex",
          alignItems: "center",
        }}
      >
        <I.bell size={18} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.div
              key={unread}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={spring.snappy}
              style={{
                position: "absolute", top: 0, right: 0, minWidth: 15, height: 15, borderRadius: "50%",
                background: C.danger, color: "#fff", fontSize: 8, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid rgba(13,12,10,.9)", padding: "0 3px",
              }}
            >
              {unread > 9 ? "9+" : unread}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              variants={panelVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{
                ...panelStyle,
                background: "rgba(13, 12, 10, 0.94)",
                backdropFilter: reduceMotion ? "none" : "blur(20px) saturate(135%)",
                WebkitBackdropFilter: reduceMotion ? "none" : "blur(20px) saturate(135%)",
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 20,
                boxShadow: "0 28px 90px rgba(0,0,0,.72)",
                zIndex: 5000,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transformOrigin: "top right",
              }}
            >
              <div style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  Уведомления
                  {unread > 0 && <Badge color="danger" s={{ marginLeft: 6 }}>{unread}</Badge>}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{ background: "none", border: "none", color: C.info, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      Прочитать все
                    </button>
                  )}
                  <button onClick={() => { setOpen(false); onGoToPage("notifications"); }} style={{ background: "none", border: "none", color: C.primary, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    Все
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, padding: "8px 12px", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <LayoutGroup id="notif-filters">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      style={{
                        position: "relative",
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: `1px solid ${filter === f.id ? "rgba(211,166,70,.35)" : "rgba(255,255,255,.10)"}`,
                        background: filter === f.id ? "transparent" : "rgba(255,255,255,.04)",
                        color: filter === f.id ? C.primary : C.muted,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {filter === f.id && (
                        <motion.div
                          layoutId="notification-filter-pill"
                          className="notification-filter-pill"
                          transition={spring.snappy}
                        />
                      )}
                      <span style={{ position: "relative", zIndex: 1 }}>{f.label}</span>
                    </button>
                  ))}
                </LayoutGroup>
              </div>
              <div className="soft-scroll" style={{ flex: 1, overflow: "auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: C.dim, fontSize: 13 }}>Нет уведомлений</div>
                ) : (
                  <motion.div variants={stagger} initial="hidden" animate="show">
                    <AnimatePresence initial={false}>
                      {filtered.slice(0, 8).map(n => {
                        const isWarning = n.kind === "warning";
                        const isRead = isWarning ? false : n.readBy?.includes(currentUser.id);
                        const isMutedHidden = isWarning && n.hidden;
                        const leftMarker = markerColor(n, isRead);
                        return (
                          <motion.div
                            key={n.id}
                            layout
                            variants={listItem}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            style={{
                              padding: "10px 14px",
                              borderBottom: "1px solid rgba(255,255,255,.06)",
                              background: isRead ? "transparent" : "rgba(211,166,70,.05)",
                              borderLeft: `2px solid ${leftMarker}`,
                              opacity: isRead || isMutedHidden ? 0.62 : 1,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: `${nColor(n)}18`, color: nColor(n),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, marginTop: 1,
                              }}>
                                {n.type === "ошибка" ? <I.alert size={14} /> : <I.bell size={14} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                  <span className="notification-title" style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: C.text }}>
                                    {n.title}
                                  </span>
                                  {!isRead && !isWarning && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, flexShrink: 0 }} />}
                                </div>
                                <div className="notification-body" style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{n.content}</div>
                                <div style={{ fontSize: 10, color: C.dim, marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span>{relTime(n.createdAt)}</span>
                                  {isWarning && <span>Предупреждение панели</span>}
                                  {!isWarning && <span>{n.type}</span>}
                                </div>
                                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                  {!isWarning && !isRead && (
                                    <motion.button
                                      whileHover={!reduceMotion ? { scale: 1.03 } : undefined}
                                      whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                                      onClick={() => markRead(n.id)}
                                      style={{
                                        padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer",
                                        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                                        color: C.muted, fontFamily: "inherit",
                                      }}
                                    >
                                      Прочитано
                                    </motion.button>
                                  )}
                                  {(n.action?.label || n.action?.page) && (
                                    <motion.button
                                      whileHover={!reduceMotion ? { scale: 1.03 } : undefined}
                                      whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                                      onClick={() => { if (!isWarning && !isRead) markRead(n.id); handleAction(n); }}
                                      style={{
                                        padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer",
                                        background: "rgba(211,166,70,.12)", border: "1px solid rgba(211,166,70,.25)",
                                        color: C.primary, fontFamily: "inherit",
                                      }}
                                    >
                                      {n.action?.label || "Открыть"}
                                    </motion.button>
                                  )}
                                  {isWarning && !n.hidden && (
                                    <motion.button
                                      whileHover={!reduceMotion ? { scale: 1.03 } : undefined}
                                      whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                                      onClick={() => hideWarningItem(n.warningId || n.id)}
                                      style={{
                                        padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer",
                                        background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)",
                                        color: C.dim, fontFamily: "inherit",
                                      }}
                                    >
                                      Скрыть
                                    </motion.button>
                                  )}
                                  {isWarning && n.hidden && (
                                    <motion.button
                                      whileHover={!reduceMotion ? { scale: 1.03 } : undefined}
                                      whileTap={!reduceMotion ? { scale: 0.97 } : undefined}
                                      onClick={() => restoreWarningItem(n.warningId || n.id)}
                                      style={{
                                        padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer",
                                        background: "rgba(91,141,181,.12)", border: "1px solid rgba(91,141,181,.25)",
                                        color: C.info, fontFamily: "inherit",
                                      }}
                                    >
                                      Вернуть
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export { NotificationBell };
