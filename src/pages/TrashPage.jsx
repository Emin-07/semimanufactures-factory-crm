import { useState, useMemo, useContext } from "react";
import { AppContext } from "../context/AppContext.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Badge, Btn, Confirm, Toast, Card, PageH, EmptyState } from "../components/ui/index.jsx";
import { fmtShort } from "../utils/dates.js";

const TABS = [
  { id: "products", label: "Товары", key: "products", setter: "setProducts" },
  { id: "tasks", label: "Задания", key: "tasks", setter: "setTasks" },
  { id: "clients", label: "Магазины", key: "clients", setter: "setClients" },
  { id: "orders", label: "Заказы", key: "clientOrders", setter: "setClientOrders" },
  { id: "raw", label: "Сырьё", key: "rawMaterials", setter: "setRawMaterials" },
  { id: "deliveries", label: "Поставки", key: "deliveries", setter: "setDeliveries" },
  { id: "users", label: "Пользователи", key: "users", setter: "setUsers" },
];

const TrashPage = () => {
  const ctx = useContext(AppContext);
  const { addLog, currentUser } = ctx;
  const [tab, setTab] = useState("products");
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const tabCfg = TABS.find(t => t.id === tab);

  const deleted = useMemo(() => {
    const list = ctx[tabCfg?.key] || [];
    if (!Array.isArray(list)) return [];
    return list.filter(x => x.deleted);
  }, [ctx, tabCfg]);

  const restore = item => {
    const setter = ctx[tabCfg.setter];
    if (!setter) return;
    setter(prev => prev.map(x => x.id === item.id ? {
      ...x,
      deleted: false,
      deletedAt: null,
      deletedBy: null,
      deletedByName: null,
      deletedReason: null,
    } : x));
    addLog(`Восстановлено: ${item.name || item.title || "#" + item.id}`);
    setToast({ message: "Восстановлено", type: "success" });
  };

  const hardDelete = item => {
    setConfirm({
      title: "Удалить навсегда?",
      message: "Это действие необратимо.",
      onConfirm: () => {
        const setter = ctx[tabCfg.setter];
        setter(prev => prev.filter(x => x.id !== item.id));
        addLog(`Удалено навсегда: ${item.name || item.title || "#" + item.id}`);
        setToast({ message: "Удалено навсегда", type: "error" });
        setConfirm(null);
      },
    });
  };

  const label = item => item.name || item.title || `#${item.id}`;

  return (
    <div>
      <PageH title="Корзина" sub="Только директор может восстанавливать и удалять навсегда" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`period-tab${tab === t.id ? " active" : ""}`}>{t.label}</button>
        ))}
      </div>

      {deleted.length === 0 ? (
        <EmptyState icon={<I.trash size={36} />} title="Пусто" sub={`Нет удалённых: ${tabCfg?.label}`} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {deleted.map(item => (
            <Card key={item.id}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label(item)}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                    {item.deletedByName || "—"} · {item.deletedAt ? fmtShort(item.deletedAt) : "—"}
                  </div>
                  {item.deletedReason && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.deletedReason}</div>}
                </div>
                <Badge color="danger">удалено</Badge>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="secondary" sz="sm" onClick={() => restore(item)} icon={<I.refresh size={12} />}>Восстановить</Btn>
                  <Btn v="danger" sz="sm" onClick={() => hardDelete(item)} icon={<I.trash size={12} />}>Навсегда</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Confirm {...confirm} open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

export { TrashPage };
