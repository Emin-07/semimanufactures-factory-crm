/** Единое представление строки посещаемости для shift-control UI */
export function getAttendanceViewState(ws = {}) {
  const { arrived, left, late, absent, produced = 0 } = ws;

  if (absent) {
    return {
      status: "absent",
      statusLabel: "нет",
      tone: "danger",
      checkInTime: null,
      checkOutTime: null,
      outputQty: produced,
      actions: [],
      readonlyLabel: "Отсутствует",
    };
  }

  if (arrived && left) {
    return {
      status: "closed",
      statusLabel: "смена закрыта",
      tone: "info",
      checkInTime: arrived?.time || null,
      checkOutTime: left?.time || null,
      outputQty: produced,
      actions: [],
      readonlyLabel: "Смена закрыта",
    };
  }

  if (arrived && !left) {
    return {
      status: "active",
      statusLabel: late ? "опоздал" : "на смене",
      tone: late ? "warning" : "success",
      checkInTime: arrived?.time || null,
      checkOutTime: null,
      outputQty: produced,
      actions: [
        { type: "checkout", label: "Завершить смену", variant: "info", markType: "уход", icon: "out" },
      ],
      readonlyLabel: null,
    };
  }

  return {
    status: "missing",
    statusLabel: "не отмечен",
    tone: "warning",
    checkInTime: null,
    checkOutTime: null,
    outputQty: produced,
    actions: [
      { type: "checkin", label: "Отметить приход", variant: "success", markType: "приход", icon: "check" },
      { type: "absent", label: "Нет", variant: "danger", markType: "отсутствие", icon: null },
    ],
    readonlyLabel: null,
  };
}
