import { warningId } from "./hiddenWarnings.js";

export function buildDashboardWarnings({
  criticalRaw = [],
  lowProducts = [],
  overdueTasks = [],
  absentWorkers = [],
  products = [],
  activeDebts = [],
  clients = [],
  todayStr = new Date().toISOString().slice(0, 10),
}) {
  const items = [];
  criticalRaw.forEach(r => items.push({
    id: warningId("stock", r.id, todayStr),
    category: "stock",
    severity: "critical",
    title: "Сырьё ниже минимума",
    body: `${r.name} — ${r.stock} ${r.unit}`,
    page: "raw",
  }));
  lowProducts.forEach(p => items.push({
    id: warningId("product", p.id, todayStr),
    category: "stock",
    severity: "warning",
    title: "Малый остаток товара",
    body: `${p.name} — ${p.stock} ${p.unit}`,
    page: "products",
  }));
  overdueTasks.forEach(t => {
    const pr = products.find(p => p.id === t.productId);
    items.push({
      id: warningId("task", t.id, todayStr),
      category: "task",
      severity: "critical",
      title: "Просроченное задание",
      body: `#${t.id}: ${pr?.name || "?"} ×${t.quantity}`,
      page: "tasks",
    });
  });
  absentWorkers.forEach(w => items.push({
    id: warningId("attendance", w.id, todayStr),
    category: "attendance",
    severity: "warning",
    title: "Приход не отмечен",
    body: w.name.split(" ").slice(0, 2).join(" "),
    page: "marks",
  }));
  activeDebts.filter(d => d.dueDate && new Date(d.dueDate) < new Date()).forEach(d => {
    const store = clients.find(c => c.id === d.storeId);
    items.push({
      id: warningId("debt", d.id, todayStr),
      category: "debt",
      severity: "warning",
      title: "Долг просрочен",
      body: store?.name || "?",
      page: "debts",
    });
  });
  return items;
}
