import { formatMoney, formatNumber, formatPercent } from "../../utils/formatters.js";
import { C } from "../../theme/colors.js";
import { chartTooltipStyle } from "./chartTheme.js";

const formatValue = (value, unit) => {
  if (unit === "money") return formatMoney(value);
  if (unit === "percent") return formatPercent(value);
  if (unit === "thousands") return `${formatNumber(value)} тыс. ₽`;
  return formatNumber(value);
};

export function GlassChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;

  return (
    <div style={chartTooltipStyle}>
      {label && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}>
          {label}
        </div>
      )}
      {payload.map(entry => (
        <div
          key={entry.dataKey || entry.name}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, marginTop: 4 }}
        >
          <span style={{ color: C.muted }}>{entry.name}</span>
          <span style={{ color: entry.color || C.text, fontWeight: 700 }}>
            {formatValue(entry.value, unit)}
          </span>
        </div>
      ))}
    </div>
  );
}
