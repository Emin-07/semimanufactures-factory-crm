import { useState, useContext } from "react";
import { AppContext } from "../context/AppContext.js";
import { fmtShort } from "../utils/dates.js";
import { C, toneColors } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Card, IconBox, PageH, SearchBox } from "../components/ui/index.jsx";

const logActionIcon = (msg) => {
  const m = (msg || "").toLowerCase();
  if (m.includes("вход")) return { icon: <I.user size={14} />, tone: "success" };
  if (m.includes("выход")) return { icon: <I.out size={14} />, tone: "neutral" };
  if (m.includes("задан")) return { icon: <I.tasks size={14} />, tone: "primary" };
  if (m.includes("заказ") || m.includes("отгруз")) return { icon: <I.send size={14} />, tone: "purple" };
  if (m.includes("склад") || m.includes("сырь") || m.includes("постав")) return { icon: <I.box size={14} />, tone: "warning" };
  if (m.includes("фасов") || m.includes("достав")) return { icon: <I.truck size={14} />, tone: "purple" };
  if (m.includes("оплат") || m.includes("долг") || m.includes("расчёт") || m.includes("ставка")) return { icon: <I.chart size={14} />, tone: "primary" };
  if (m.includes("удал") || m.includes("корзин")) return { icon: <I.trash size={14} />, tone: "danger" };
  if (m.includes("восстан") || m.includes("отмен")) return { icon: <I.refresh size={14} />, tone: "info" };
  return { icon: <I.clock size={14} />, tone: "neutral" };
};

const LogsPage = () => {
  const { logs, users } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [fUser, setFUser] = useState("all");
  const workers = users.filter(u => u.status === "active");
  const filtered = logs.filter(l => {
    const matchSearch = !search || l.message.toLowerCase().includes(search.toLowerCase()) || l.userName.toLowerCase().includes(search.toLowerCase());
    const matchUser = fUser === "all" || l.userId === +fUser;
    return matchSearch && matchUser;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const groups = [];
  let lastDay = "";
  for (const l of filtered) {
    const day = l.date ? l.date.slice(0, 10) : "";
    if (day !== lastDay) { groups.push({ day, items: [] }); lastDay = day; }
    groups[groups.length - 1].items.push(l);
  }

  const dayLabel = d => {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today) return "Сегодня";
    if (d === yest) return "Вчера";
    return fmtShort(d + "T00:00:00");
  };

  const timeOf = iso => {
    try { return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };

  const inputStyle = {
    padding: "9px 12px",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 10,
    color: C.text,
    fontSize: 12,
    fontFamily: "inherit",
  };

  return (
    <div>
      <PageH title="Журнал">
        <SearchBox value={search} onChange={e => setSearch(e.target.value)} ph="Что искать..." />
        <select value={fUser} onChange={e => setFUser(e.target.value)} style={inputStyle}>
          <option value="all">Все</option>
          {workers.map(u => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
        </select>
      </PageH>
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 50, color: C.dim }}>Нет записей</div>}
      {groups.map(g => (
        <div key={g.day} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 8, paddingLeft: 4,
          }}>
            {dayLabel(g.day)}
          </div>
          <Card variant="data" s={{ padding: 0 }}>
            {g.items.map((l, i) => {
              const { icon, tone } = logActionIcon(l.message);
              const actorTone = toneColors[tone] || toneColors.neutral;
              return (
                <div
                  key={l.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: i < g.items.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                    display: "flex", alignItems: "center", gap: 12,
                    minHeight: 48,
                    transition: "background .15s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <IconBox tone={tone} size={30} s={{ borderRadius: "50%" }}>
                    {icon}
                  </IconBox>
                  <div style={{ fontSize: 11, color: C.dim, minWidth: 40, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {timeOf(l.date)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{l.message}</div>
                  </div>
                  <div style={{
                    fontSize: 11, color: actorTone, flexShrink: 0,
                    padding: "4px 9px", borderRadius: 999, fontWeight: 600,
                    background: `${actorTone}14`, border: `1px solid ${actorTone}2B`,
                  }}>
                    {l.userName?.split(" ")[0] || "—"}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
};

export { LogsPage };
