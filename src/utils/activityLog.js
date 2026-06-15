const AUTH_RE = /^(вход|выход|login|logout)/i;

export function isAuthLogMessage(msg = "") {
  const m = (msg || "").toLowerCase();
  return m.includes("вход") || m.includes("выход") || m.includes("login") || m.includes("logout");
}

export function isOperationalLogMessage(msg = "") {
  const m = (msg || "").toLowerCase();
  if (isAuthLogMessage(m)) return false;
  return (
    m.includes("задан") ||
    m.includes("выпуск") ||
    m.includes("заказ") ||
    m.includes("отгруз") ||
    m.includes("фасов") ||
    m.includes("достав") ||
    m.includes("склад") ||
    m.includes("сырь") ||
    m.includes("постав") ||
    m.includes("оплат") ||
    m.includes("долг") ||
    m.includes("удал") ||
    m.includes("восстан") ||
    m.includes("чс") ||
    m.includes("blacklist") ||
    m.includes("расчёт") ||
    m.includes("ставка")
  );
}

/** Pick dashboard microlog: operational first, auth only as fallback */
export function pickMicrolog(logs = [], limit = 8) {
  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const operational = sorted.filter(l => isOperationalLogMessage(l.message));
  if (operational.length > 0) return operational.slice(0, limit);
  return sorted.filter(l => isAuthLogMessage(l.message)).slice(0, Math.min(3, limit));
}

export function micrologLabel(logs = []) {
  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const hasOps = sorted.some(l => isOperationalLogMessage(l.message));
  return hasOps ? "Микроменеджмент сегодня" : "Активность входа";
}

function shortFirstNames(raw = "") {
  const names = String(raw)
    .split(/,\s*/)
    .map(n => n.trim().split(/\s+/).slice(0, 1).join(" "))
    .filter(Boolean);
  if (!names.length) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} + ещё ${names.length - 2}`;
}

function splitArrow(msg = "") {
  const parts = msg.split(/\s*(?:→|->)\s*/);
  return { left: (parts[0] || "").trim(), right: (parts[1] || "").trim() };
}

/** Structured microlog row for dashboard */
export function formatMicrologEntry(log) {
  const msg = (log?.message || "").trim();
  const actor = log?.userName?.split(/\s+/).slice(0, 2).join(" ") || "—";
  const lower = msg.toLowerCase();
  const { left, right } = splitArrow(msg);

  if (lower.startsWith("задание:")) {
    const body = left.replace(/^задание:\s*/i, "").trim();
    const product = body.replace(/\sx(\d+)/i, (_, q) => ` · x${q}`);
    return {
      title: "Задание создано",
      details: product,
      meta: `${shortFirstNames(right) || actor}`,
    };
  }

  if (lower.startsWith("завершено:")) {
    const body = left.replace(/^завершено:\s*/i, "").trim();
    const product = body.replace(/\sx(\d+)/i, (_, q) => ` · x${q}`).replace(/\s*\(просрочено\)\s*$/i, "");
    return {
      title: "Задание завершено",
      details: product,
      meta: `${shortFirstNames(right) || actor}`,
    };
  }

  if (lower.includes("вход")) {
    return { title: "Вход в систему", details: "", meta: actor };
  }
  if (lower.includes("выход")) {
    return { title: "Выход из системы", details: "", meta: actor };
  }

  if (lower.startsWith("выпуск")) {
    const body = left.replace(/^выпуск(?:\s+изменён)?:\s*/i, "").trim();
    const product = body.replace(/\sx(\d+)/i, (_, q) => ` · x${q}`);
    return {
      title: lower.includes("удал") ? "Выпуск удалён" : lower.includes("измен") ? "Выпуск изменён" : "Добавлен выпуск",
      details: product,
      meta: shortFirstNames(right) || actor,
    };
  }

  if (lower.includes("заказ")) {
    return {
      title: lower.includes("отгруз") ? "Заказ отгружен" : "Заказ магазина",
      details: right || left.replace(/^заказ\s*/i, "").trim(),
      meta: actor,
    };
  }

  const colon = msg.indexOf(":");
  if (colon > 0 && colon < 40) {
    return {
      title: msg.slice(0, colon).trim(),
      details: msg.slice(colon + 1).trim(),
      meta: actor,
    };
  }

  return { title: msg, details: "", meta: actor };
}
