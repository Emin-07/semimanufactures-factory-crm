export function formatMoney(value, options = {}) {
  const {
    compact = false,
    maximumFractionDigits = 0,
    fallback = "0 ₽",
  } = options;

  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;

  if (compact && Math.abs(num) >= 1000) {
    const thousands = num / 1000;
    return `${new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: Math.abs(thousands) >= 10 ? 0 : 1,
    }).format(thousands)} тыс. ₽`;
  }

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits,
  }).format(num)} ₽`;
}

export const formatMoneyCompact = (value, options = {}) =>
  formatMoney(value, { ...options, compact: true });

export function formatNumber(value, options = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return options.fallback ?? "0";
  return new Intl.NumberFormat("ru-RU", options).format(num);
}

export function formatPercent(value, options = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return options.fallback ?? "0%";
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(num)}%`;
}

export function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function formatTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}
