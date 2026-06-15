import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { C, glassCardStyle, glassHeavyStyle, toneColors } from "../../theme/colors.js";
import { I } from "../../icons/Icons.jsx";
import { spring, scaleIn, slidePanel, sheetUp, stagger, listItem, t, fadeIn } from "../../motion/presets.js";
import { useAppMotion } from "../../motion/MotionProvider.jsx";
import { AnimatedNumber } from "./AnimatedNumber.jsx";

export { AnimatedNumber } from "./AnimatedNumber.jsx";
export { AppLoader } from "./AppLoader.jsx";

export const EthnicBorder = ({ color = C.primary, height = 2 }) => (
  <div style={{ width: "100%", height, background: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 8px, transparent 8px, transparent 12px, ${color}50 12px, ${color}50 16px, transparent 16px, transparent 24px)`, opacity: 0.35, borderRadius: 1 }} />
);

export const EthnicCorner = ({ size = 20, color = C.primary, position = "topLeft" }) => {
  const s = { position: "absolute", width: size, height: size, opacity: 0.15 };
  const pos = position === "topLeft" ? { top: -1, left: -1 } : position === "topRight" ? { top: -1, right: -1 } : position === "bottomLeft" ? { bottom: -1, left: -1 } : { bottom: -1, right: -1 };
  const rotate = position === "topLeft" ? "0" : position === "topRight" ? "90" : position === "bottomLeft" ? "270" : "180";
  return (
    <svg style={{ ...s, ...pos, transform: `rotate(${rotate}deg)` }} viewBox="0 0 20 20" fill="none">
      <path d="M0 0h20v2H2v18H0V0z" fill={color} />
      <path d="M4 4h4v2H6v2H4V4z" fill={color} />
    </svg>
  );
};

export const Badge = ({ children, color = "primary", s = {}, pulse }) => {
  const { reduceMotion } = useAppMotion();
  const m = {
    primary: { bg: C.primaryBg, c: C.primary },
    success: { bg: C.successBg, c: C.success },
    danger: { bg: C.dangerBg, c: C.danger },
    info: { bg: C.infoBg, c: C.info },
    purple: { bg: C.purpleBg, c: C.purple },
    cyan: { bg: C.cyanBg, c: C.cyan },
    pink: { bg: C.pinkBg, c: C.pink },
    orange: { bg: C.orangeBg, c: C.orange },
  };
  const v = m[color] || m.primary;
  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.snappy}
      className={pulse && !reduceMotion ? "urgent-pulse" : ""}
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999,
        fontSize: 11, fontWeight: 600, background: v.bg, color: v.c, letterSpacing: 0.3,
        border: `1px solid ${v.c}30`, ...s,
      }}
    >
      {children}
    </motion.span>
  );
};

export const Btn = ({ children, onClick, v = "primary", sz = "md", disabled, style = {}, icon, className = "" }) => {
  const { reduceMotion } = useAppMotion();
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 11,
    cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
  };
  const sizes = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "11px 22px", fontSize: 15 } };
  const vars = {
    primary: {
      background: `linear-gradient(135deg, ${C.primary}, ${C.primary2})`,
      color: "#1A1510",
      boxShadow: "0 10px 28px rgba(211,166,70,.24), inset 0 1px 0 rgba(255,255,255,.25)",
      border: "1px solid rgba(255,255,255,.12)",
    },
    secondary: {
      background: "rgba(255,255,255,.06)",
      color: C.text,
      border: "1px solid rgba(255,255,255,.10)",
      backdropFilter: "blur(12px)",
    },
    danger: { background: C.dangerBg, color: C.danger, border: "1px solid rgba(255,107,95,.28)" },
    ghost: { background: "transparent", color: C.muted, border: "1px solid transparent" },
    success: {
      background: `linear-gradient(135deg, ${C.success}, #5AB86A)`,
      color: "#1A1510",
      boxShadow: "0 8px 24px rgba(111,208,129,.2)",
    },
    info: { background: C.infoBg, color: C.info, border: `1px solid ${C.info}30` },
  };
  return (
    <motion.button
      className={`btn motion-safe ${v === "primary" ? "btn-primary-shine" : ""} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileHover={!disabled && !reduceMotion ? { y: -1, scale: 1.01 } : undefined}
      whileTap={!disabled && !reduceMotion ? { scale: 0.97 } : undefined}
      transition={spring.snappy}
      style={{ ...base, ...sizes[sz], ...vars[v], ...style }}
    >
      {icon}{children}
    </motion.button>
  );
};

const fieldBase = {
  width: "100%", padding: "9px 12px",
  background: "rgba(0,0,0,.22)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: 10, color: C.text, fontSize: 14, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
  transition: "border-color .18s ease, box-shadow .18s ease",
};

export const Inp = ({ label, error, style = {}, cStyle = {}, ...r }) => (
  <div style={{ marginBottom: 12, ...cStyle }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 4 }}>{label}</label>}
    <input
      style={{ ...fieldBase, border: `1px solid ${error ? C.danger : "rgba(255,255,255,.10)"}`, ...style }}
      onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = `0 0 0 2px ${C.ring}`; }}
      onBlur={e => { e.target.style.borderColor = error ? C.danger : "rgba(255,255,255,.10)"; e.target.style.boxShadow = "none"; }}
      {...r}
    />
    {error && <div style={{ color: C.danger, fontSize: 11, marginTop: 2 }}>{error}</div>}
  </div>
);

export const Sel = ({ label, options, error, cStyle = {}, ...r }) => (
  <div style={{ marginBottom: 12, ...cStyle }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 4 }}>{label}</label>}
    <select style={{ ...fieldBase, border: `1px solid ${error ? C.danger : "rgba(255,255,255,.10)"}`, appearance: "none" }} {...r}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const Txa = ({ label, cStyle = {}, ...r }) => (
  <div style={{ marginBottom: 12, ...cStyle }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 4 }}>{label}</label>}
    <textarea style={{ ...fieldBase, resize: "vertical", minHeight: 70 }} {...r} />
  </div>
);

export const Modal = ({ open, onClose, title, children, width = 520 }) => {
  const { reduceMotion } = useAppMotion();
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 640);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const cardVariants = isMobile ? sheetUp : scaleIn;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: t.fast }}
          onClick={onClose}
        >
          <motion.div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(8,6,4,.72)",
              backdropFilter: reduceMotion ? "none" : "blur(8px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            variants={reduceMotion ? { hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0 } } : cardVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{
              position: "relative", ...glassCardStyle, ...glassHeavyStyle,
              width: "100%", maxWidth: isMobile ? "100%" : width, maxHeight: isMobile ? "88vh" : "90vh",
              overflow: "auto",
              borderRadius: isMobile ? "22px 22px 0 0" : 22,
              boxShadow: "0 32px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.10)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <EthnicBorder color={C.primary} height={2} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: 6, display: "flex" }}><I.x size={16} /></button>
            </div>
            <div style={{ padding: "16px 20px" }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const Confirm = ({ open, onClose, onConfirm, title, message }) => (
  <Modal open={open} onClose={onClose} title={title} width={400}>
    <p style={{ color: C.muted, margin: "0 0 18px", lineHeight: 1.5 }}>{message}</p>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Btn v="secondary" onClick={onClose}>Отмена</Btn>
      <Btn v="danger" onClick={onConfirm}>Подтвердить</Btn>
    </div>
  </Modal>
);

export const Stat = ({ icon, label, value, color = C.primary, sub }) => (
  <div style={{ ...glassCardStyle, padding: "16px 18px", flex: "1 1 180px", minWidth: 160, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at top right, ${color}12, transparent 70%)` }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color, border: `1px solid ${color}28`, backdropFilter: "blur(8px)" }}>{icon}</div>
      {sub && <span style={{ fontSize: 11, fontWeight: 600, color: sub.startsWith("+") ? C.success : sub.startsWith("-") ? C.danger : C.muted }}>{sub}</span>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 2, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
  </div>
);

export const IconBox = ({ children, tone = "neutral", size = 32, s = {} }) => {
  const toneClr = toneColors[tone] || toneColors.neutral || C.muted;
  return (
    <span
      className="icon-box"
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? 11 : 10,
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        color: toneClr,
        background: `${toneClr}18`,
        border: `1px solid ${toneClr}28`,
        ...s,
      }}
    >
      {children}
    </span>
  );
};

export const MetricCard = ({ label, value, tone = "primary", color, sub, hero = false }) => {
  const toneClr = color || toneColors[tone] || toneColors.primary;
  if (hero) {
    return (
      <div className="metric-card hero-kpi hero-kpi-card" style={{
        ...glassHeavyStyle,
        borderRadius: 16,
        border: `1px solid ${toneClr}22`,
        background: `linear-gradient(180deg, ${toneClr}10, rgba(255,255,255,.03))`,
      }}>
        <div className="hero-kpi-label">{label}</div>
        <div className="metric-value hero-kpi-value money-text" style={{ color: toneClr }}>{value}</div>
        {sub && <div className="hero-kpi-sub">{sub}</div>}
      </div>
    );
  }
  return (
    <div className="metric-card" style={{
      ...glassHeavyStyle,
      borderRadius: 16,
      padding: "14px 16px",
      minWidth: 0,
      overflow: "hidden",
      border: `1px solid ${toneClr}22`,
      background: `linear-gradient(180deg, ${toneClr}10, rgba(255,255,255,.03))`,
    }}>
      <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div className="metric-value money-text" style={{ fontSize: 28, fontWeight: 800, color: toneClr, lineHeight: 0.95 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
};

export const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{children}</h3>
    {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.dim }}>{sub}</p>}
  </div>
);

export const DataPanel = ({ children, s = {} }) => (
  <div style={{ ...glassHeavyStyle, borderRadius: 16, padding: 0, overflow: "hidden", ...s }}>{children}</div>
);

export const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const tm = setTimeout(onClose, 3000); return () => clearTimeout(tm); }, [onClose]);
  const toastEl = (
    <motion.div
      className={`app-toast app-toast--${type}`}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, transition: t.fast }}
      transition={spring.snappy}
    >
      <div className="app-toast-dot" />
      <span className="app-toast-text">{message}</span>
    </motion.div>
  );
  if (typeof document === "undefined") return toastEl;
  return createPortal(toastEl, document.body);
};

export const TH = ({ children }) => (
  <th style={{
    padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 600,
    color: C.muted, textTransform: "uppercase", letterSpacing: 0.6,
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.05)",
    position: "sticky", top: 0, zIndex: 1,
  }}>{children}</th>
);

export const TD = ({ children, s = {} }) => (
  <td style={{ padding: "10px 14px", fontSize: 13, color: C.text, borderBottom: "1px solid rgba(255,255,255,.06)", ...s }}>{children}</td>
);

export const Card = ({ children, s = {}, hero, onClick, className = "", layout = false, variant = "default", tone }) => {
  const { reduceMotion } = useAppMotion();
  const clickable = !!onClick;

  const variantStyle = {
    hero: {
      padding: "24px 26px",
      background: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))",
      boxShadow: "0 24px 60px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.10)",
    },
    data: {
      ...glassHeavyStyle,
      borderRadius: 16,
      padding: 0,
      background: "rgba(18,16,13,.82)",
    },
    alert: {
      border: `1px solid ${tone === "danger" ? C.danger : tone === "warning" ? C.orange : C.orange}28`,
      background: tone === "danger" ? C.dangerBg : C.orangeBg,
    },
    default: {},
  }[variant] || {};

  return (
    <motion.div
      layout={layout || clickable}
      className={`glass-card ${clickable ? "clickable-card clickable-glass" : ""} ${className}`}
      onClick={onClick}
      whileHover={clickable && !reduceMotion ? { y: -2, scale: 1.003 } : undefined}
      whileTap={clickable && !reduceMotion ? { scale: 0.992 } : undefined}
      transition={spring.soft}
      style={{
        ...glassCardStyle,
        padding: hero ? "22px" : 18,
        position: "relative",
        cursor: clickable ? "pointer" : undefined,
        ...variantStyle,
        ...s,
      }}
    >
      {children}
    </motion.div>
  );
};

export const GlassCard = Card;

export const Title = ({ children }) => <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.text }}>{children}</h3>;

export const PageH = ({ title, children, sub }) => (
  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>{title}</h1>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.dim }}>{sub}</p>}
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
  </div>
);

export const SearchBox = ({ value, onChange, ph = "Поиск..." }) => (
  <div style={{ position: "relative" }}>
    <input
      placeholder={ph} value={value} onChange={onChange}
      style={{
        padding: "8px 12px 8px 34px",
        background: "rgba(0,0,0,.22)",
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 10, color: C.text, fontSize: 13,
        fontFamily: "inherit", outline: "none", width: 200,
      }}
    />
    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.dim }}><I.search size={15} /></span>
  </div>
);

export const ProgressBar = ({ value = 0, color = C.primary, height = 6, s = {} }) => (
  <div style={{ height, background: "rgba(255,255,255,.08)", borderRadius: height, overflow: "hidden", ...s }}>
    <motion.div
      className="progress-fill"
      initial={false}
      animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      transition={spring.soft}
      style={{ height: "100%", background: color, borderRadius: height }}
    />
  </div>
);

export const StatusPill = ({ children, color, tone = "info", pulse }) => {
  const { reduceMotion } = useAppMotion();
  const resolvedTone = color || tone;
  const c = toneColors[resolvedTone] || toneColors.info;
  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.snappy}
      className={pulse && !reduceMotion ? "urgent-pulse" : ""}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: `${c}16`, color: c, border: `1px solid ${c}32`,
      }}
    >
      {children}
    </motion.span>
  );
};

export const EmptyState = ({ icon, title, sub, action }) => {
  const { reduceMotion } = useAppMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={t.smooth}
      style={{ textAlign: "center", padding: "48px 20px", color: C.dim }}
    >
      {icon && <motion.div initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.5 }} transition={spring.soft} style={{ marginBottom: 12 }}>{icon}</motion.div>}
      <div style={{ fontSize: 15, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, marginBottom: 16 }}>{sub}</div>}
      {action}
    </motion.div>
  );
};

export const Drawer = ({ open, onClose, title, children, width = 440 }) => {
  const { reduceMotion } = useAppMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={{ position: "fixed", inset: 0, zIndex: 5100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: t.fast }}
          onClick={onClose}
        >
          <motion.div
            style={{ position: "absolute", inset: 0, background: "rgba(8,6,4,.65)", backdropFilter: reduceMotion ? "none" : "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="soft-scroll"
            variants={reduceMotion ? fadeIn : slidePanel}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: "min(100vw, " + width + "px)",
              ...glassHeavyStyle, borderLeft: "1px solid rgba(255,255,255,.12)",
              boxShadow: "-20px 0 60px rgba(0,0,0,.5)", overflow: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,.08)", position: "sticky", top: 0, background: "rgba(18,16,13,.92)", zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: 6, display: "flex" }}><I.x size={16} /></button>
            </div>
            <div style={{ padding: 18 }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const RecipeModal = ({ open, onClose, product, recipe, rawMaterials, quantity, showPrices = false }) => {
  const { reduceMotion } = useAppMotion();
  if (!product) return null;
  const items = recipe?.items || [];

  return (
    <Modal open={open} onClose={onClose} title={`Рецептура: ${product.name}`} width={520}>
      {!items.length ? (
        <EmptyState title="Рецептура не задана" sub="Обратитесь к менеджеру" />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: "grid", gap: 8 }}>
          {items.map((it, i) => {
            const raw = rawMaterials?.find(r => r.id === it.rawId);
            const need = quantity ? +(it.qty * quantity).toFixed(3) : it.qty;
            const enough = raw ? raw.stock >= need : false;
            return (
              <motion.div
                key={i}
                variants={listItem}
                style={{
                  ...glassHeavyStyle, borderRadius: 12, padding: "10px 12px",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                  border: enough ? "1px solid rgba(255,255,255,.08)" : `1px solid ${C.danger}35`,
                  boxShadow: enough || reduceMotion ? "none" : `0 0 20px ${C.danger}12`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{raw?.name || "?"}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                    {it.qty} {it.unit || raw?.unit || ""} / ед.
                    {quantity ? ` · нужно ${need} ${raw?.unit || ""}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Badge color={enough ? "success" : "danger"} s={{ fontSize: 10 }}>{enough ? "достаточно" : "мало"}</Badge>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>склад: {raw?.stock ?? "—"} {raw?.unit || ""}</div>
                  {showPrices && raw?.costPerUnit != null && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{(raw.costPerUnit * it.qty).toFixed(0)} ₽/ед.</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </Modal>
  );
};

export const RecipeButton = ({ productId, products, recipes, quantity, onOpen, sz = "sm", block = false, className = "" }) => {
  const { reduceMotion } = useAppMotion();
  const recipe = recipes?.find(r => r.productId === productId);
  const count = recipe?.items?.length || 0;
  if (!count) return null;
  return (
    <motion.button
      type="button"
      onClick={e => { e.stopPropagation(); onOpen?.(productId); }}
      className={`glass-chip ${block ? "product-card-recipe-btn" : ""} ${className}`.trim()}
      whileHover={!reduceMotion ? { scale: block ? 1.01 : 1.03, y: block ? 0 : -1 } : undefined}
      whileTap={!reduceMotion ? { scale: 0.98 } : undefined}
      transition={spring.snappy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        width: block ? "100%" : undefined,
        justifyContent: block ? "flex-start" : undefined,
        minHeight: block ? 40 : undefined,
        padding: block ? "0 12px" : sz === "sm" ? "5px 12px" : "7px 14px",
        fontSize: sz === "sm" ? 11 : 12, fontWeight: 600,
        color: C.muted, border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.06)", borderRadius: 999,
        cursor: "pointer", fontFamily: "inherit", textDecoration: "none",
      }}
    >
      <I.recipe size={13} />
      <span className="single-line">Рецептура · {count} комп.</span>
    </motion.button>
  );
};

export const UserChip = ({ name, role, s = {} }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
    color: C.text, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    ...s,
  }}>
    {name}{role ? ` · ${role}` : ""}
  </span>
);
