import { useState, useMemo, useContext } from "react";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES } from "../constants/index.js";
import { getJobProfile, isSuperAdmin } from "../utils/roles.js";
import { packingProgress } from "../utils/orders.js";
import { fmtShort, relTime } from "../utils/dates.js";
import { formatMoney, formatMoneyCompact } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { pickMicrolog, micrologLabel, isAuthLogMessage, formatMicrologEntry } from "../utils/activityLog.js";
import { Badge, Btn, Stat, Card, Title, PageH, AnimatedNumber, IconBox } from "../components/ui/index.jsx";
import { ExpandableMetricStrip } from "../components/ui/ExpandableMetricStrip.jsx";
import { GlassChartTooltip } from "../components/charts/GlassChartTooltip.jsx";
import { stagger, listItem, fadeUp, softScale, spring } from "../motion/presets.js";
import { useAppMotion } from "../motion/MotionProvider.jsx";

const DashboardPage = () => {
  const {
    products, users, currentUser, tasks, rawMaterials, notifications, marks, taskEmployees, recipes,
    clientOrders, clients, setPage,
    productionOutputs, batches, debts, defects, applyServerState, logs,
  } = useContext(AppContext);

  const ap = products.filter(p => !p.deleted);
  const role = ROLES.find(r => r.id === currentUser.roleId);
  const jobProfile = getJobProfile(currentUser);
  const canSeeFinance = role?.name !== "worker";
  const isWorker = role?.name === "worker";
  const isAdmin = isSuperAdmin(currentUser);
  const isManager = role?.name === "manager";
  const isPacker = jobProfile === "packer";
  const isCourier = jobProfile === "courier";
  const isLepstitsa = jobProfile === "lepstitsa";
  const todayStr = new Date().toISOString().slice(0, 10);
  const [chartPeriod, setChartPeriod] = useState(14);
  const { reduceMotion } = useAppMotion();

  const todayTasks = tasks.filter(t => t.completedAt && t.completedAt.startsWith(todayStr));
  const todayProduced = todayTasks.reduce((s, t) => s + t.quantity, 0);

  const allWorkers = users.filter(u => u.roleId === 3 && u.status === "active" && !u.deleted);
  const busyWorkerIds = new Set();
  tasks.filter(t => t.status === "в работе").forEach(t => (t.userIds || []).forEach(id => busyWorkerIds.add(id)));
  const busyCount = busyWorkerIds.size;

  const bestWorker = useMemo(() => {
    const m = {};
    taskEmployees.filter(te => te.status === "завершено" || te.status === "просрочено").forEach(te => { m[te.employeeId] = (m[te.employeeId] || 0) + te.producedQty; });
    (productionOutputs || []).forEach(o => { m[o.employeeId] = (m[o.employeeId] || 0) + o.quantity; });
    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const w = users.find(u => u.id === +entries[0][0]);
    return { name: w?.name?.split(" ").slice(0, 2).join(" ") || "?", produced: entries[0][1] };
  }, [taskEmployees, users, productionOutputs]);

  const criticalRaw = rawMaterials.filter(r => r.stock <= r.minStock);
  const lowProducts = ap.filter(p => p.stock < 20);

  const overdueTasks = tasks.filter(t => !t.completedAt && new Date() > new Date(t.deadline) && t.status !== "завершено" && t.status !== "просрочено");

  const todayPresence = marks.filter(m => (m.type === "приход" || m.markType === "присутствие") && (m.time || m.createdAt || "").startsWith(todayStr)).map(m => m.employeeId);
  const absentWorkers = allWorkers.filter(w => !todayPresence.includes(w.id));

  const forecasts = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === "завершено" && t.completedAt);
    if (!completedTasks.length) return [];
    const daysSpan = Math.max(1, Math.ceil((Date.now() - new Date(completedTasks[completedTasks.length - 1]?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));
    const prodForecasts = ap.map(p => {
      const produced = completedTasks.filter(t => t.productId === p.id).reduce((s, t) => s + t.quantity, 0);
      const dailyRate = produced / daysSpan;
      const daysLeft = dailyRate > 0 ? Math.floor(p.stock / dailyRate) : 999;
      return { name: p.name, stock: p.stock, unit: p.unit, dailyRate: +dailyRate.toFixed(1), daysLeft, type: "product" };
    }).filter(f => f.daysLeft < 30);
    const rawForecasts = rawMaterials.map(r => {
      const totalUsed = tasks.filter(t => t.status === "завершено").reduce((s, t) => {
        const recipe = recipes.find(rc => rc.productId === t.productId);
        const item = recipe?.items.find(it => it.rawId === r.id);
        return s + (item ? item.qty * t.quantity : 0);
      }, 0);
      const dailyRate = totalUsed / daysSpan;
      const daysLeft = dailyRate > 0 ? Math.floor(r.stock / dailyRate) : 999;
      return { name: r.name, stock: r.stock, unit: r.unit, dailyRate: +dailyRate.toFixed(2), daysLeft, type: "raw" };
    }).filter(f => f.daysLeft < 30);
    return [...prodForecasts, ...rawForecasts].sort((a, b) => a.daysLeft - b.daysLeft);
  }, [ap, rawMaterials, tasks, recipes]);

  const totalValue = ap.reduce((s, p) => s + p.stock * p.sellPrice, 0);
  const activeTasks = tasks.filter(t => t.status === "назначено" || t.status === "в работе").length;
  const unreadNotifs = notifications.filter(n => (n.targetAll || n.targetUsers?.includes(currentUser.id)) && !n.readBy?.includes(currentUser.id)).length;
  const urgentOrders = clientOrders.filter(o => o.priority === "срочный" && o.status !== "отгружен" && o.status !== "отменён").length;

  const prodByDay = useMemo(() => {
    const m = {};
    tasks.filter(t => t.status === "завершено").forEach(t => { const d = fmtShort(t.completedAt); m[d] = (m[d] || 0) + t.quantity; });
    return Object.entries(m).map(([date, qty]) => ({ date, qty }));
  }, [tasks]);

  const chartData = prodByDay.slice(-chartPeriod);
  const chartAnim = !reduceMotion && chartData.length <= 80;

  const rawStockData = rawMaterials.slice(0, 8).map(r => ({ name: r.name.length > 10 ? r.name.slice(0, 10) + "…" : r.name, stock: r.stock, min: r.minStock }));

  const workerStats = useMemo(() => {
    return allWorkers.map(w => {
      const fromTasks = taskEmployees.filter(te => te.employeeId === w.id && (te.status === "завершено" || te.status === "просрочено")).reduce((s, te) => s + te.producedQty, 0);
      const fromOutputs = (productionOutputs || []).filter(o => o.employeeId === w.id).reduce((s, o) => s + o.quantity, 0);
      const produced = fromTasks + fromOutputs;
      const wTasks = tasks.filter(t => (t.userIds || []).includes(w.id));
      const done = wTasks.filter(t => t.status === "завершено");
      return { name: w.name.split(" ").slice(0, 2).join(" "), done: done.length, total: wTasks.length, produced };
    }).sort((a, b) => b.produced - a.produced);
  }, [allWorkers, tasks, taskEmployees, productionOutputs]);


  const expiredBatches = (batches || []).filter(b => b.status === "активна" && b.expiresAt && new Date(b.expiresAt) < new Date());
  const nearExpiryBatches = useMemo(() => {
    const now = Date.now();
    return (batches || [])
      .filter(b => b.status === "активна" && b.expiresAt && new Date(b.expiresAt) >= new Date())
      .map(b => {
        const daysLeft = Math.ceil((new Date(b.expiresAt).getTime() - now) / 86400000);
        return { ...b, daysLeft, productName: products.find(p => p.id === b.productId)?.name || "?" };
      })
      .filter(b => b.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [batches, products]);

  const activeDebts = (debts || []).filter(d => d.status !== "погашен");
  const totalActiveDebt = activeDebts.reduce((s, d) => s + (d.remaining ?? d.amount ?? 0), 0);
  const topDebtors = [...activeDebts]
    .sort((a, b) => (b.remaining ?? b.amount) - (a.remaining ?? a.amount))
    .slice(0, 3)
    .map(d => ({ store: clients.find(c => c.id === d.storeId)?.name || "?", amount: d.remaining ?? d.amount }));

  const healthScore = useMemo(() => {
    let score = 100;
    score -= criticalRaw.length * 8;
    score -= overdueTasks.length * 6;
    score -= absentWorkers.length * 5;
    score -= expiredBatches.length * 7;
    score -= activeDebts.filter(d => d.dueDate && new Date(d.dueDate) < new Date()).length * 5;
    return Math.max(0, Math.min(100, score));
  }, [criticalRaw, overdueTasks, absentWorkers, expiredBatches, activeDebts]);

  const healthColor = healthScore >= 80 ? C.success : healthScore >= 60 ? C.orange : C.danger;

  const statusItems = [
    { label: "Производство", ok: overdueTasks.length === 0, warn: overdueTasks.length > 0 },
    { label: "Сырьё", ok: criticalRaw.length === 0, warn: criticalRaw.length > 0 },
    { label: "Заказы", ok: urgentOrders === 0, warn: urgentOrders > 0 },
    { label: "Персонал", ok: absentWorkers.length === 0, warn: absentWorkers.length > 0 },
    { label: "Долги", ok: activeDebts.length === 0, warn: activeDebts.length > 0 },
  ];

  const attendanceMarked = marks.some(m => m.employeeId === currentUser.id && (m.type === "приход" || m.markType === "присутствие") && (m.time || m.createdAt || "").startsWith(todayStr));
  const myActiveTasks = tasks.filter(t => (t.userIds || []).includes(currentUser.id) && (t.status === "назначено" || t.status === "в работе")).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const myTodayProduced = (productionOutputs || []).filter(o => o.employeeId === currentUser.id && (o.date || "").startsWith(todayStr)).reduce((s, o) => s + o.quantity, 0);

  const activeOrders = clientOrders.filter(o => o.status !== "отгружен" && o.status !== "отменён").sort((a, b) => {
    const p = { срочный: 0, важный: 1, нормальный: 2 };
    return (p[a.priority] ?? 2) - (p[b.priority] ?? 2) || new Date(a.orderDate) - new Date(b.orderDate);
  });

  const packingOrders = clientOrders.filter(o => !o.deleted && !["отгружен", "отменён"].includes(o.status));
  const deliveryReady = packingOrders.filter(o => o.packingStatus === "готов к доставке" || o.status === "готов");

  const packingWaiting = packingOrders.filter(o => (o.packingStatus || "не начата") === "не начата").length;
  const packingActive = packingOrders.filter(o => o.packingStatus === "фасуется").length;
  const deliveryReadyCount = deliveryReady.length;
  const deliveryActive = clientOrders.filter(o => o.deliveryStatus === "в доставке").length;

  const heroMetrics = useMemo(() => {
    const items = [
      { id: "activeTasks", label: "Активные задания", value: activeTasks, tone: "primary" },
      { id: "urgentOrders", label: "Срочные заказы", value: urgentOrders, tone: urgentOrders > 0 ? "danger" : "neutral" },
      { id: "packing", label: "В фасовке", value: packingActive, tone: "warning" },
      { id: "readyDelivery", label: "Готово к доставке", value: deliveryReadyCount, tone: "purple" },
      { id: "lowRaw", label: "Сырьё ниже мин.", value: criticalRaw.length, tone: criticalRaw.length > 0 ? "danger" : "success" },
    ];
    if (canSeeFinance && totalActiveDebt > 0) {
      items.push({
        id: "activeDebt",
        label: "Активный долг",
        value: formatMoneyCompact(totalActiveDebt),
        fullValue: formatMoney(totalActiveDebt),
        tone: "danger",
      });
    }
    if (canSeeFinance && totalActiveDebt === 0) {
      items.push({
        id: "stock",
        label: "Склад",
        value: formatMoneyCompact(totalValue),
        fullValue: formatMoney(totalValue),
        subtitle: "остаток готовой продукции",
        tone: "primary",
      });
    }
    return items;
  }, [activeTasks, urgentOrders, packingActive, deliveryReadyCount, criticalRaw.length, canSeeFinance, totalActiveDebt, totalValue]);

  const microlog = useMemo(() => pickMicrolog(logs, 8), [logs]);
  const micrologTitle = useMemo(() => micrologLabel(logs), [logs]);

  const logTone = (msg) => {
    const m = (msg || "").toLowerCase();
    if (isAuthLogMessage(m)) return "neutral";
    if (m.includes("задан")) return "primary";
    if (m.includes("заказ") || m.includes("отгруз")) return "purple";
    if (m.includes("фасов")) return "warning";
    if (m.includes("достав")) return "info";
    if (m.includes("оплат") || m.includes("долг")) return "success";
    if (m.includes("склад") || m.includes("сырь") || m.includes("постав")) return "info";
    if (m.includes("удал")) return "danger";
    return "neutral";
  };

  const logIcon = (msg) => {
    const m = (msg || "").toLowerCase();
    if (m.includes("вход")) return <I.login size={14} />;
    if (m.includes("выход")) return <I.logout size={14} />;
    if (m.includes("задан")) return <I.tasks size={14} />;
    if (m.includes("заказ") || m.includes("отгруз")) return <I.send size={14} />;
    if (m.includes("склад") || m.includes("сырь") || m.includes("постав")) return <I.box size={14} />;
    if (m.includes("фасов") || m.includes("достав")) return <I.truck size={14} />;
    if (m.includes("оплат") || m.includes("долг")) return <I.chart size={14} />;
    if (m.includes("удал") || m.includes("корзин")) return <I.trash size={14} />;
    return <I.clock size={14} />;
  };


  if (isPacker) {
    return (
      <div className="dashboard-page" style={{ animation: "softFadeIn .4s ease" }}>
        <PageH title="Фасовка сегодня" sub={fmtShort(new Date().toISOString())}>
          <Btn onClick={() => setPage("packing")} icon={<I.box size={14} />}>Открыть фасовку</Btn>
        </PageH>
        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <Stat icon={<I.box size={18} />} label="Ждут фасовки" value={packingOrders.filter(o => (o.packingStatus || "не начата") === "не начата").length} color={C.info} />
          <Stat icon={<I.factory size={18} />} label="Фасуются" value={packingOrders.filter(o => o.packingStatus === "фасуется").length} color={C.orange} />
          <Stat icon={<I.check size={18} />} label="Готовы" value={deliveryReady.length} color={C.success} />
          <Stat icon={<I.alert size={18} />} label="Срочные" value={packingOrders.filter(o => o.priority === "срочный").length} color={C.danger} />
        </div>
        <Card>
          <Title>Очередь фасовки</Title>
          {packingOrders.slice(0, 8).map(o => {
            const cl = clients.find(c => c.id === o.clientId);
            const prog = packingProgress(o.items);
            return (
              <div key={o.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{cl?.name || "—"}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{prog.done}/{prog.total} позиций · {o.packingStatus || "не начата"}</div>
                </div>
                <Btn sz="sm" onClick={() => setPage("packing")}>Открыть</Btn>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  if (isCourier) {
    const mine = clientOrders.filter(o => o.courierId === currentUser.id && o.deliveryStatus === "в доставке");
    return (
      <div className="dashboard-page" style={{ animation: "softFadeIn .4s ease" }}>
        <PageH title="Доставка сегодня" sub={fmtShort(new Date().toISOString())}>
          <Btn onClick={() => setPage("delivery")} icon={<I.truck size={14} />}>Открыть доставку</Btn>
        </PageH>
        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <Stat icon={<I.check size={18} />} label="Готовы" value={deliveryReady.length} color={C.success} />
          <Stat icon={<I.truck size={18} />} label="У меня" value={mine.length} color={C.purple} />
          <Stat icon={<I.alert size={18} />} label="Срочные" value={clientOrders.filter(o => o.priority === "срочный" && o.deliveryStatus !== "доставлен").length} color={C.danger} />
        </div>
        <Card onClick={() => setPage("delivery")} s={{ cursor: "pointer" }}>
          <Title>Мои доставки</Title>
          {mine.length === 0 ? <div style={{ color: C.dim, fontSize: 13, padding: 16, textAlign: "center" }}>Нет активных доставок</div> :
            mine.map(o => {
              const cl = clients.find(c => c.id === o.clientId);
              return <div key={o.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 13 }}>{cl?.name} · {o.addressSnapshot || cl?.address}</div>;
            })}
        </Card>
      </div>
    );
  }

  // Worker view
  if (isWorker) {
    return (
      <div className="dashboard-page" style={{ animation: "softFadeIn .4s ease" }}>
        <PageH title={isLepstitsa ? "Моя смена" : `Моя смена, ${currentUser.name.split(" ")[1] || currentUser.name}`} sub={fmtShort(new Date().toISOString())}>
          {isLepstitsa ? (
            <Btn onClick={() => setPage("tasks")} icon={<I.tasks size={14} />}>Мои задания</Btn>
          ) : (
            <Btn onClick={() => setPage("prodOutput")} icon={<I.factory size={14} />}>Выпуск</Btn>
          )}
        </PageH>

        {!attendanceMarked && (
          <Card s={{ marginBottom: 16, border: `1px solid ${C.orange}35`, background: `linear-gradient(180deg, rgba(243,160,77,.12), rgba(243,160,77,.04))` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <I.alert size={18} style={{ color: C.orange, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: C.orange, fontWeight: 600, flex: 1 }}>Отметка прихода не сделана</span>
              <Btn v="secondary" sz="sm" onClick={async () => {
                try {
                  const r = await fetch("/api/actions/attendance-mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: currentUser.id, type: "приход" }) });
                  if (r.ok) { const data = await r.json(); if (data.state) applyServerState(data.state); }
                } catch { /* */ }
              }}>Отметить приход</Btn>
            </div>
          </Card>
        )}

        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <Stat icon={<I.tasks size={18} />} label="Мои задания" value={myActiveTasks.length} color={myActiveTasks.length > 0 ? C.primary : C.dim} />
          <Stat icon={<I.factory size={18} />} label="Мой выпуск сегодня" value={`${myTodayProduced} ед.`} color={myTodayProduced > 0 ? C.success : C.dim} />
          <Stat icon={<I.check size={18} />} label="Приход" value={attendanceMarked ? "Отмечен" : "Нет"} color={attendanceMarked ? C.success : C.orange} />
        </div>

        <Card s={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Title>Мои задания</Title>
            <button onClick={() => setPage("tasks")} style={{ fontSize: 11, color: C.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>все →</button>
          </div>
          {myActiveTasks.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.dim, fontSize: 13 }}>Нет активных заданий</div>}
          {myActiveTasks.map(t => {
            const prod = products.find(p => p.id === t.productId);
            const msLeft = new Date(t.deadline).getTime() - Date.now();
            const isOverdue = msLeft < 0;
            const hoursLeft = Math.floor(msLeft / 3600000);
            const dlColor = isOverdue ? C.danger : hoursLeft < 2 ? C.orange : hoursLeft < 24 ? C.primary : C.dim;
            const dlLabel = isOverdue ? "просрочено" : hoursLeft < 1 ? "< 1 ч" : hoursLeft < 24 ? `${hoursLeft} ч` : fmtShort(t.deadline);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ width: 4, height: 40, borderRadius: 2, background: t.status === "в работе" ? C.info : C.primary, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{prod?.name || "—"} <span style={{ fontWeight: 400, color: C.muted }}>×{t.quantity}</span></div>
                  <div style={{ fontSize: 11, color: dlColor, marginTop: 2 }}><I.clock size={10} style={{ marginRight: 4 }} />{dlLabel}</div>
                </div>
                <Badge color={t.status === "в работе" ? "info" : "primary"} s={{ fontSize: 10 }}>{t.status}</Badge>
              </div>
            );
          })}
        </Card>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Задания", pg: "tasks", icon: <I.tasks size={14} />, clr: C.info },
            { label: "Выпуск", pg: "prodOutput", icon: <I.factory size={14} />, clr: C.success },
            { label: "История", pg: "workerHistory", icon: <I.clock size={14} />, clr: C.cyan },
            { label: "Посещаемость", pg: "marks", icon: <I.check size={14} />, clr: C.primary },
          ].map(a => (
            <button key={a.pg} onClick={() => setPage(a.pg)} className="quick-action-btn" style={{ color: a.clr, borderColor: `${a.clr}30`, background: `${a.clr}10` }}>
              {a.icon}{a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Admin / manager attendance summary (compact — for sidebar rail)
  const attendanceRail = (isAdmin || isManager) && (() => {
    const arrivedIds = new Set(marks.filter(m => (m.type === "приход" || m.markType === "присутствие") && (m.time || m.createdAt || "").startsWith(todayStr)).map(m => m.employeeId));
    const departedIds = new Set(marks.filter(m => m.type === "уход" && (m.time || m.createdAt || "").startsWith(todayStr)).map(m => m.employeeId));
    const absentIds = new Set(marks.filter(m => m.type === "отсутствие" && (m.time || m.createdAt || "").startsWith(todayStr)).map(m => m.employeeId));
    const prodWorkers = users.filter(u => u.roleId === 3 && u.status === "active" && !u.deleted);
    const noShowWorkers = prodWorkers.filter(w => !arrivedIds.has(w.id) && !absentIds.has(w.id));
    const finishedCount = prodWorkers.filter(w => arrivedIds.has(w.id) && departedIds.has(w.id)).length;

    return (
      <Card variant="data" className="dashboard-card dashboard-attendance-widget">
        <div className="dashboard-attendance-header">
          <h3 className="dashboard-attendance-title">Посещаемость</h3>
          <button type="button" onClick={() => setPage("marks")} className="dashboard-card-action dashboard-attendance-link">Открыть →</button>
        </div>
        <div className="dashboard-attendance-stats">
          <div className="attendance-mini-stat">
            <div className="attendance-mini-stat-value" style={{ color: C.success }}>{arrivedIds.size}</div>
            <div className="attendance-mini-stat-label">пришли</div>
          </div>
          <div className="attendance-mini-stat">
            <div className="attendance-mini-stat-value" style={{ color: noShowWorkers.length > 0 ? C.orange : C.dim }}>{noShowWorkers.length}</div>
            <div className="attendance-mini-stat-label">не отметились</div>
          </div>
          <div className="attendance-mini-stat">
            <div className="attendance-mini-stat-value" style={{ color: C.info }}>{finishedCount}</div>
            <div className="attendance-mini-stat-label">завершили</div>
          </div>
        </div>
        {noShowWorkers.length > 0 && (
          <div className="dashboard-attendance-alert">
            <div className="dashboard-attendance-alert-title">Не отметили приход</div>
            <div className="dashboard-attendance-alert-list">
              {noShowWorkers.slice(0, 5).map(w => (
                <div key={w.id} className="dashboard-attendance-alert-row">
                  <span className="dashboard-attendance-alert-dot" />
                  <span className="dashboard-attendance-alert-text">
                    {w.name.split(" ").slice(0, 2).join(" ")}
                    <span className="dashboard-attendance-alert-hint"> · приход не отмечен</span>
                  </span>
                </div>
              ))}
            </div>
            {noShowWorkers.length > 5 && (
              <div className="dashboard-attendance-alert-more">+ ещё {noShowWorkers.length - 5}</div>
            )}
          </div>
        )}
      </Card>
    );
  })();

  return (
    <motion.div className="dashboard-page" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
      <PageH title={isSuperAdmin(currentUser) || isManager ? "Сводка смены" : `Привет, ${currentUser.name.split(" ")[1] || currentUser.name}`} sub={isSuperAdmin(currentUser) || isManager ? "Смена, заказы, фасовка и риски сегодня" : `${role?.label} · ${fmtShort(new Date().toISOString())}`}>
        <Btn onClick={() => setPage("tasks")} icon={<I.plus size={14} />}>Задание</Btn>
        <Btn v="secondary" onClick={() => setPage("prodOutput")} icon={<I.factory size={14} />}>Выпуск</Btn>
      </PageH>
      </motion.div>

      <div className="dashboard-grid">
        <section className="dashboard-main">
          <motion.div variants={softScale} whileHover={reduceMotion ? undefined : { y: -2 }} transition={spring.soft}>
          <Card hero>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div className="eyebrow">Сегодня</div>
                <div className="hero-number"><AnimatedNumber value={todayProduced} suffix=" ед." /></div>
                <div className="hero-sub">произведено сегодня</div>
              </div>
              <div className="period-tabs">
                {[{ d: 7, l: "7Д" }, { d: 14, l: "14Д" }, { d: 30, l: "30Д" }].map(p => (
                  <button key={p.d} className={`period-tab${chartPeriod === p.d ? " active" : ""}`} onClick={() => setChartPeriod(p.d)}>{p.l}</button>
                ))}
              </div>
            </div>
            <div className="hero-metric-strip-wrap">
              <ExpandableMetricStrip metrics={heroMetrics} className="hero-metric-strip" />
            </div>
            {chartData.length > 1 ? (
              <div className="hero-chart-wrap">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} style={{ background: "transparent" }}>
                  <defs>
                    <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<GlassChartTooltip />} />
                  <Area type="monotone" dataKey="qty" stroke={C.primary} fill="url(#gHero)" strokeWidth={2} name="Кол-во" isAnimationActive={chartAnim} animationDuration={900} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-empty-state">
                <I.chart size={22} style={{ color: C.dim, opacity: 0.6 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Недостаточно данных для графика</div>
                <div style={{ fontSize: 11, color: C.dim, maxWidth: 280 }}>Добавьте выпуск за несколько дней, чтобы увидеть динамику</div>
              </div>
            )}
          </Card>
          </motion.div>

          <motion.div variants={fadeUp} whileHover={reduceMotion ? undefined : { y: -2 }} transition={spring.soft}>
          <Card variant="data" className="dashboard-card activity-card activity-section">
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-group">
                <div className="dashboard-card-title">{micrologTitle}</div>
                <div className="dashboard-card-subtitle">Последние операционные события смены</div>
              </div>
              <button type="button" onClick={() => setPage("logs")} className="dashboard-card-action">Журнал →</button>
            </div>
            {microlog.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", minHeight: 220, color: C.dim, fontSize: 13 }}>Пока нет записей</div>
            ) : (
              <div className="activity-list">
                {microlog.map(l => {
                  const entry = formatMicrologEntry(l);
                  return (
                    <div key={l.id} className="activity-row">
                      <div className="activity-icon">
                        <IconBox tone={logTone(l.message)} size={40}>{logIcon(l.message)}</IconBox>
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{entry.title}</div>
                        {entry.details && <div className="activity-details single-line">{entry.details}</div>}
                        <div className="activity-meta single-line">
                          {entry.meta}{entry.meta ? " · " : ""}{relTime(l.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          </motion.div>

          <motion.div variants={listItem} className="kpi-row">
            <Stat icon={<I.check size={18} />} label="Сегодня произведено" value={`${todayProduced} ед.`} color={C.success} />
            <Stat icon={<I.tasks size={18} />} label="Ждут фасовки" value={packingWaiting} color={packingWaiting > 0 ? C.orange : C.dim} />
            <Stat icon={<I.truck size={18} />} label="В доставке" value={deliveryActive} color={deliveryActive > 0 ? C.info : C.dim} />
            <Stat icon={<I.users size={18} />} label="Загрузка" value={`${busyCount}/${allWorkers.length}`} color={busyCount > 0 ? C.primary : C.dim} />
          </motion.div>

          {activeOrders.length > 0 && (
            <motion.div variants={listItem}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Title>Заказы магазинов</Title>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {urgentOrders > 0 && <Badge color="danger">{urgentOrders} срочных</Badge>}
                  <button onClick={() => setPage("clients")} style={{ fontSize: 11, color: C.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>все →</button>
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {activeOrders.slice(0, 6).map(o => {
                  const cl = clients.find(c => c.id === o.clientId);
                  const priClr = o.priority === "срочный" ? C.danger : o.priority === "важный" ? C.orange : C.dim;
                  return (
                    <div key={o.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
                      background: o.priority === "срочный" ? "rgba(255,107,95,.08)" : "rgba(255,255,255,.03)",
                      border: `1px solid ${o.priority === "срочный" ? C.danger + "35" : "rgba(255,255,255,.08)"}`,
                      animation: o.priority === "срочный" ? "pulseBorder 2s infinite" : "none",
                    }}>
                      <div style={{ width: 3, height: 32, borderRadius: 2, background: priClr, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cl?.name || "—"}</div>
                        <div style={{ fontSize: 11, color: C.dim }}>{o.items.map(it => products.find(p => p.id === it.productId)?.name || "?").join(", ")} · {formatMoney(o.total)}</div>
                      </div>
                      <Badge color={o.status === "готов" ? "purple" : o.status === "в производстве" ? "primary" : o.status === "сборка" ? "orange" : "info"} s={{ fontSize: 10 }}>{o.status}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
            </motion.div>
          )}

          {forecasts.length > 0 && (
            <Card>
              <Title>Прогноз остатков</Title>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {forecasts.slice(0, 8).map((f, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,.2)", border: `1px solid ${f.daysLeft <= 3 ? C.danger + "35" : f.daysLeft <= 7 ? C.orange + "30" : "rgba(255,255,255,.08)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{f.name}</span>
                      <Badge color={f.daysLeft <= 3 ? "danger" : f.daysLeft <= 7 ? "orange" : "success"} s={{ fontSize: 10 }}>{f.daysLeft} дн.</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{f.stock} {f.unit} · ~{f.dailyRate}/день</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <Title>Остатки сырья</Title>
            <div style={{ display: "grid", gap: 10 }}>
              {rawMaterials.slice(0, 8).map(r => {
                const pct = r.minStock > 0 ? Math.min(100, Math.round(r.stock / r.minStock * 50)) : 100;
                const clr = r.stock <= r.minStock ? C.danger : r.stock <= r.minStock * 2 ? C.orange : C.success;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.text, width: 110, flexShrink: 0 }}>{r.name}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: clr, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: clr, width: 72, textAlign: "right" }}>{r.stock} {r.unit}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="chart-grid">
            <Card>
              <Title>Производство по дням</Title>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={C.cyan} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<GlassChartTooltip />} />
                  <Area type="monotone" dataKey="qty" stroke={C.info} fill="url(#gP)" name="Кол-во" isAnimationActive={chartAnim} animationDuration={900} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <Title>Остатки сырья vs минимум</Title>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rawStockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<GlassChartTooltip />} />
                  <Bar dataKey="stock" fill={C.info} radius={[6, 6, 0, 0]} name="Остаток" />
                  <Bar dataKey="min" fill={C.danger} radius={[6, 6, 0, 0]} name="Минимум" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <Title>Эффективность сотрудников</Title>
              {workerStats.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < workerStats.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${CC[i]}18`, color: CC[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>Выполнено: {w.done}/{w.total}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{w.produced}</div>
                </div>
              ))}
            </Card>
          </div>
        </section>

        <motion.aside className="dashboard-rail" variants={fadeUp} transition={{ delay: 0.12 }}>
          <Card>
            <Title>Статус смены</Title>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: healthScore }, { value: 100 - healthScore }]} dataKey="value" innerRadius={28} outerRadius={40} startAngle={90} endAngle={-270} stroke="none">
                      <Cell fill={healthColor} />
                      <Cell fill="rgba(255,255,255,.08)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: healthColor }}>{healthScore}</div>
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                {healthScore >= 80 ? "Все показатели в норме" : healthScore >= 60 ? "Есть зоны внимания" : "Требуется действие"}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {statusItems.map(s => (
                <div key={s.label} className="risk-row">
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{s.label}</span>
                  <Badge color={s.ok ? "success" : "danger"} s={{ fontSize: 10 }}>{s.ok ? "норма" : "внимание"}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Title>Требует внимания</Title>
              <button onClick={() => setPage("notifications")} style={{ fontSize: 11, color: C.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Уведомления →</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              {healthScore >= 80
                ? "Критичных событий нет. Предупреждения смотрите в колокольчике."
                : "Есть зоны внимания — откройте уведомления для деталей и скрытия."}
            </div>
          </Card>

          <Card>
            <Title>Быстрые действия</Title>
            <div className="quick-actions-grid">
              {[
                { label: "Задание", pg: "tasks", icon: <I.tasks size={14} /> },
                { label: "Выпуск", pg: "prodOutput", icon: <I.factory size={14} /> },
                { label: "Поставка", pg: "deliveries", icon: <I.down size={14} /> },
                { label: "Заказ", pg: "clients", icon: <I.send size={14} /> },
                { label: "Долги", pg: "debts", icon: <I.chart size={14} /> },
                { label: "Закупки", pg: "procurement", icon: <I.box size={14} /> },
              ].map(a => (
                <button key={a.pg} className="quick-action-btn" onClick={() => setPage(a.pg)}>
                  <span className="quick-action-icon">{a.icon}</span>
                  <span className="quick-action-label">{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {canSeeFinance && activeDebts.length > 0 && (
            <Card onClick={() => setPage("debts")}>
              <Title>Долги магазинов</Title>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.danger, marginBottom: 8 }}>{formatMoney(totalActiveDebt)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{activeDebts.length} магазинов-должников</div>
              {topDebtors.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 12 }}>
                  <span style={{ color: C.text }}>{d.store}</span>
                  <span style={{ color: C.danger, fontWeight: 600 }}>{formatMoney(d.amount)}</span>
                </div>
              ))}
            </Card>
          )}

          {attendanceRail}

          {nearExpiryBatches.length > 0 && (
            <Card>
              <Title>Партии под контролем</Title>
              <div style={{ display: "grid", gap: 6 }}>
                {nearExpiryBatches.map(b => (
                  <div key={b.id} className="risk-row">
                    <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{b.productName}</span>
                    <Badge color={b.daysLeft <= 2 ? "danger" : "orange"} s={{ fontSize: 10 }}>{b.daysLeft} дн. · {b.quantity} ед.</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.aside>
      </div>
    </motion.div>
  );
};

export { DashboardPage };
