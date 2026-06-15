import { C } from "../../theme/colors.js";

export const chartColors = {
  revenue: "#7DB7D8",
  profit: C.success,
  margin: C.primary,
  danger: C.danger,
  warning: C.orange,
  info: C.info,
  grid: "rgba(255,255,255,.06)",
  axis: "rgba(248, 241, 229, .45)",
};

export const chartTooltipStyle = {
  background: "rgba(18, 16, 13, 0.94)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
  color: C.text,
  fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,.45)",
  padding: "10px 12px",
};

export const chartAxisTick = { fill: chartColors.axis, fontSize: 10 };
export const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 };
