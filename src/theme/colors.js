export const C = {
  bg: "#11100D",
  bg2: "#17130F",
  surface: "rgba(35, 32, 26, 0.68)",
  surface2: "rgba(255, 255, 255, 0.065)",
  surface3: "rgba(255, 255, 255, 0.095)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  text: "rgba(248, 241, 229, 0.94)",
  muted: "rgba(248, 241, 229, 0.58)",
  dim: "rgba(248, 241, 229, 0.38)",
  primary: "#D8A93D",
  primary2: "#F0CA68",
  primaryBg: "rgba(216, 169, 61, 0.14)",
  success: "#74D889",
  successBg: "rgba(116, 216, 137, 0.13)",
  danger: "#FF6B5F",
  dangerBg: "rgba(255, 107, 95, 0.13)",
  info: "#79B8D8",
  infoBg: "rgba(121, 184, 216, 0.13)",
  purple: "#A78BFA",
  purpleBg: "rgba(167, 139, 250, 0.14)",
  cyan: "#62D6CC",
  cyanBg: "rgba(98, 214, 204, 0.12)",
  pink: "#F083B5",
  pinkBg: "rgba(240, 131, 181, 0.13)",
  orange: "#F2A84B",
  orangeBg: "rgba(242, 168, 75, 0.14)",
  accent1: "#A4B75B",
  accent1Bg: "rgba(164, 183, 91, 0.13)",
  glass: "rgba(31, 29, 24, 0.56)",
  glassHeavy: "rgba(18, 16, 13, 0.72)",
  glassSoft: "rgba(255, 255, 255, 0.045)",
  shadow: "0 32px 110px rgba(0,0,0,.50)",
  shadowSoft: "0 18px 50px rgba(0,0,0,.24)",
  ring: "rgba(216, 169, 61, 0.35)",
  blur: "blur(22px) saturate(130%)",
};

export const toneColors = {
  primary: C.primary,
  success: C.success,
  danger: C.danger,
  warning: C.orange,
  orange: C.orange,
  info: C.info,
  purple: C.purple,
  cyan: C.cyan,
  neutral: C.muted,
};

export const CC = [C.primary, C.success, C.info, C.danger, C.purple, C.pink, C.cyan, C.orange];

export const glassCardStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.035))",
  backdropFilter: "blur(22px) saturate(125%)",
  WebkitBackdropFilter: "blur(22px) saturate(125%)",
  border: "1px solid rgba(255,255,255,.095)",
  boxShadow: "0 18px 50px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.075)",
  borderRadius: 18,
};

export const glassHeavyStyle = {
  background: "rgba(18,16,13,.72)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,.085)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.055)",
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
};
