import { useState, useMemo, useContext } from "react";
import { AppContext } from "../context/AppContext.js";
import { ROLES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS } from "../constants/index.js";
import { fmtShort } from "../utils/dates.js";
import { formatTime } from "../utils/formatters.js";
import { getAttendanceViewState } from "../utils/attendanceView.js";
import { toneColors } from "../theme/colors.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Toast, TH, TD, Card } from "../components/ui/index.jsx";

const actionIcon = (name) => {
  if (name === "check") return <I.check size={13} />;
  if (name === "out") return <I.out size={13} />;
  return undefined;
};

const AttendanceRow = ({ worker, viewState, onAction }) => {
  const toneClr = toneColors[viewState.tone] || toneColors.neutral;
  const outputTone = viewState.outputQty > 0 ? "success" : "neutral";
  const roleLabel = worker.jobTitle || ROLES.find(r => r.id === worker.roleId)?.label || "—";

  return (
    <div className="attendance-row" data-status={viewState.status}>
      <div className="attendance-person-cell">
        <div className="attendance-avatar" style={{ background: `${toneClr}20`, color: toneClr }}>
          {worker.name.charAt(0)}
        </div>
        <div className="attendance-person-info">
          <div className="attendance-person-name">{worker.name.split(" ").slice(0, 2).join(" ")}</div>
          <div className="attendance-person-role">{roleLabel}</div>
        </div>
      </div>

      <div className="attendance-status-cell">
        <span className="attendance-status-pill" data-tone={viewState.tone}>
          {viewState.statusLabel}
        </span>
      </div>

      <div className="attendance-time-cell">
        <div className="attendance-time-line">
          <span className="attendance-time-label">Приход:</span>
          <span className="attendance-time-value">
            {viewState.checkInTime ? formatTime(viewState.checkInTime) : "—"}
          </span>
        </div>
        <div className="attendance-time-line">
          <span className="attendance-time-label">Уход:</span>
          <span className="attendance-time-value">
            {viewState.checkOutTime ? formatTime(viewState.checkOutTime) : "—"}
          </span>
        </div>
      </div>

      <div className="attendance-output-cell">
        <span className="attendance-output-pill" data-tone={outputTone}>
          {viewState.outputQty} ед.
        </span>
      </div>

      <div className="attendance-actions-cell">
        {viewState.actions.map(action => (
          <Btn
            key={action.type}
            sz="sm"
            v={action.variant}
            className={`attendance-action-btn${action.type === "checkin" ? " attendance-btn-success" : ""}`}
            onClick={() => onAction(worker.id, action.markType)}
            icon={actionIcon(action.icon)}
          >
            {action.label}
          </Btn>
        ))}
        {viewState.readonlyLabel && (
          <span className="attendance-readonly-pill" data-tone={viewState.tone}>
            {viewState.readonlyLabel}
          </span>
        )}
      </div>
    </div>
  );
};

const MarksPage = () => {
  const { marks, setMarks, users, productionOutputs, currentUser, addLog, applyServerState } = useContext(AppContext);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fType, setFType] = useState("all");
  const [errs, setErrs] = useState({});
  const role = ROLES.find(r => r.id === currentUser.roleId);
  const isAdmin = role?.name === "admin" || role?.name === "owner";
  const isManager = role?.name === "manager";
  const isWorker = role?.name === "worker";
  const canManage = isAdmin || isManager;

  const workers = users.filter(u => u.status === "active");
  const todayStr = new Date().toISOString().slice(0, 10);

  const emptyForm = {
    employeeId: isWorker ? currentUser.id : (workers[0]?.id || ""),
    type: "приход",
    time: new Date().toISOString().slice(0, 16),
    reason: "",
    comment: "",
  };
  const [form, setForm] = useState(emptyForm);

  const dateMarks = useMemo(() => {
    let l = isWorker ? marks.filter(m => m.employeeId === currentUser.id) : marks;
    l = l.filter(m => (m.time || m.createdAt || "").slice(0, 10) === fDate);
    if (fType !== "all") l = l.filter(m => m.type === fType || m.markType === fType);
    return l.sort((a, b) => new Date(a.time || a.createdAt) - new Date(b.time || b.createdAt));
  }, [marks, fDate, fType, isWorker, currentUser, users]);

  const todayByWorker = useMemo(() => {
    const today = marks.filter(m => (m.time || m.createdAt || "").slice(0, 10) === todayStr);
    const byW = {};
    workers.forEach(w => {
      const wm = today.filter(m => m.employeeId === w.id);
      const arrived = wm.find(m => m.type === "приход" || m.markType === "присутствие");
      const left = wm.find(m => m.type === "уход");
      const late = wm.find(m => m.type === "опоздание");
      const absent = wm.find(m => m.type === "отсутствие");
      byW[w.id] = {
        arrived,
        left,
        late,
        absent,
        produced: (productionOutputs || [])
          .filter(o => o.employeeId === w.id && (o.date || "").slice(0, 10) === todayStr)
          .reduce((s, o) => s + o.quantity, 0),
      };
    });
    return byW;
  }, [marks, workers, todayStr, productionOutputs]);

  const shiftStats = useMemo(() => {
    let onShift = 0;
    let notMarked = 0;
    let finished = 0;
    workers.forEach(w => {
      const vs = getAttendanceViewState(todayByWorker[w.id]);
      if (vs.status === "active") onShift += 1;
      else if (vs.status === "missing") notMarked += 1;
      else if (vs.status === "closed") finished += 1;
    });
    return { onShift, notMarked, finished, total: workers.length };
  }, [workers, todayByWorker]);

  const postAttendance = async (employeeId, type, extra = {}) => {
    try {
      const r = await fetch("/api/actions/attendance-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, type, ...extra }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setToast({ message: err.error || "Не удалось отметить", type: "error" });
        return false;
      }
      const data = await r.json();
      if (data.state) applyServerState(data.state);
      return true;
    } catch {
      setToast({ message: "Нет связи с сервером", type: "error" });
      return false;
    }
  };

  const markSelf = async (type) => {
    if (await postAttendance(currentUser.id, type)) {
      setToast({ message: `${type} отмечен`, type: "success" });
    }
  };

  const quickMark = async (wId, type) => {
    const empName = users.find(u => u.id === wId)?.name?.split(" ")[0] || "";
    if (await postAttendance(wId, type)) {
      setToast({ message: `${empName} — ${type}`, type: "success" });
    }
  };

  const saveModal = () => {
    const e = {};
    if (!form.employeeId) e.employeeId = "!";
    if (!form.type) e.type = "!";
    setErrs(e);
    if (Object.keys(e).length) return;
    const now = new Date().toISOString();
    setMarks(p => [...p, {
      id: Date.now(),
      employeeId: +form.employeeId,
      type: form.type,
      time: form.time ? new Date(form.time).toISOString() : now,
      reason: form.reason,
      comment: form.comment,
      createdBy: currentUser.id,
      createdAt: now,
    }]);
    const empName = users.find(u => u.id === +form.employeeId)?.name?.split(" ")[0] || "";
    addLog(`${form.type}: ${empName} (${form.comment || "—"})`);
    setToast({ message: "Отметка добавлена", type: "success" });
    setModal(false);
  };

  const delMark = m => {
    setConfirm({
      title: "Удалить отметку?",
      message: "Это действие нельзя отменить",
      onConfirm: () => {
        setMarks(p => p.filter(x => x.id !== m.id));
        setToast({ message: "Удалено", type: "error" });
        setConfirm(null);
      },
    });
  };

  const workerView = isWorker ? getAttendanceViewState(todayByWorker[currentUser.id]) : null;

  const summaryCards = [
    { label: "На смене", value: shiftStats.onShift, tone: "success" },
    { label: "Не отметились", value: shiftStats.notMarked, tone: shiftStats.notMarked > 0 ? "warning" : "neutral" },
    { label: "Завершили", value: shiftStats.finished, tone: "info" },
    { label: "Всего сотрудников", value: shiftStats.total, tone: "primary" },
  ];

  return (
    <div className="marks-page">
      <header className="marks-page-header">
        <h1 className="marks-page-title">Посещаемость / Смена</h1>
        <div className="marks-page-actions">
          <input
            type="date"
            className="marks-filter-input"
            value={fDate}
            onChange={e => setFDate(e.target.value)}
          />
          <select className="marks-filter-input" value={fType} onChange={e => setFType(e.target.value)}>
            <option value="all">Все типы</option>
            {ATTENDANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {canManage && (
            <Btn onClick={() => { setForm(emptyForm); setErrs({}); setModal(true); }} icon={<I.plus size={15} />}>
              Добавить
            </Btn>
          )}
        </div>
      </header>

      {canManage && fDate === todayStr && (
        <div className="attendance-summary-grid">
          {summaryCards.map(card => (
            <div key={card.label} className="attendance-summary-card" data-tone={card.tone}>
              <div className="attendance-summary-label">{card.label}</div>
              <div className="attendance-summary-value">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {isWorker && fDate === todayStr && workerView && (
        <Card className="marks-worker-panel">
          <div className="marks-worker-panel-title">Моя смена сегодня</div>
          <div className="marks-worker-actions">
            {workerView.actions.map(action => (
              <Btn
                key={action.type}
                v={action.variant}
                className={action.type === "checkin" ? "attendance-btn-success" : undefined}
                onClick={() => markSelf(action.markType)}
                icon={actionIcon(action.icon)}
              >
                {action.label}
              </Btn>
            ))}
            {workerView.readonlyLabel && (
              <span className="attendance-readonly-pill" data-tone={workerView.tone}>
                {workerView.readonlyLabel}
              </span>
            )}
            {workerView.checkInTime && (
              <span className="attendance-time-line">
                <span className="attendance-time-label">Приход:</span>
                <span className="attendance-time-value">{formatTime(workerView.checkInTime)}</span>
              </span>
            )}
            {workerView.checkOutTime && (
              <span className="attendance-time-line">
                <span className="attendance-time-label">Уход:</span>
                <span className="attendance-time-value">{formatTime(workerView.checkOutTime)}</span>
              </span>
            )}
          </div>
        </Card>
      )}

      {canManage && fDate === todayStr && (
        <Card className="attendance-panel">
          <div className="attendance-panel-header">
            <div className="attendance-panel-title">Сводка на сегодня — {fmtShort(todayStr)}</div>
          </div>
          <div className="attendance-table-head">
            <span>Сотрудник</span>
            <span>Статус</span>
            <span>Время</span>
            <span>Выработка</span>
            <span style={{ textAlign: "right" }}>Действия</span>
          </div>
          <div className="attendance-list">
            {workers.map(w => (
              <AttendanceRow
                key={w.id}
                worker={w}
                viewState={getAttendanceViewState(todayByWorker[w.id])}
                onAction={quickMark}
              />
            ))}
          </div>
        </Card>
      )}

      <Card className="marks-records-panel">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH>Время</TH>
                <TH>Сотрудник</TH>
                <TH>Событие</TH>
                <TH>Причина</TH>
                <TH>Комментарий</TH>
                {canManage && <TH />}
              </tr>
            </thead>
            <tbody>
              {dateMarks.map(m => {
                const emp = users.find(u => u.id === m.employeeId);
                const type = m.type || m.markType || "—";
                const typeClr = ATTENDANCE_TYPE_COLORS[type] || "info";
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <TD s={{ fontSize: 12, whiteSpace: "nowrap", color: C.muted }}>
                      {formatTime(m.time || m.createdAt)}
                    </TD>
                    <TD s={{ fontWeight: 500 }}>{emp?.name?.split(" ").slice(0, 2).join(" ") || "—"}</TD>
                    <TD><Badge color={typeClr}>{type}</Badge></TD>
                    <TD s={{ fontSize: 12, color: C.muted }}>{m.reason || "—"}</TD>
                    <TD s={{ fontSize: 12, color: C.dim, maxWidth: 180 }}>{m.comment || "—"}</TD>
                    {canManage && (
                      <TD>
                        <Btn v="ghost" sz="sm" onClick={() => delMark(m)} icon={<I.trash size={13} />} />
                      </TD>
                    )}
                  </tr>
                );
              })}
              {dateMarks.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 40, color: C.dim, fontSize: 13 }}>
                    Нет отметок за {fmtShort(fDate)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Добавить отметку" width={440}>
        <Sel
          label="Сотрудник"
          value={form.employeeId}
          onChange={e => setForm({ ...form, employeeId: e.target.value })}
          error={errs.employeeId}
          options={[{ value: "", label: "Выберите" }, ...workers.map(w => ({ value: w.id, label: w.name.split(" ").slice(0, 2).join(" ") }))]}
        />
        <Sel label="Событие" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={ATTENDANCE_TYPES.map(t => ({ value: t, label: t }))} />
        <Inp label="Время (факт)" type="datetime-local" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        {(form.type === "опоздание" || form.type === "отсутствие") && (
          <Inp label="Причина" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Болезнь, семейные обстоятельства..." />
        )}
        <Txa label="Комментарий" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn v="secondary" onClick={() => setModal(false)}>Отмена</Btn>
          <Btn onClick={saveModal}>Добавить</Btn>
        </div>
      </Modal>
      {confirm && <Confirm open onClose={() => setConfirm(null)} {...confirm} />}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

export { MarksPage };
