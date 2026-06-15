import { motion } from "motion/react";
import { APP_BRAND } from "../../constants/brand.js";
import { C } from "../../theme/colors.js";
import { spring, t } from "../../motion/presets.js";
import { useAppMotion } from "../../motion/MotionProvider.jsx";

export function AppLoader({ message = `Загружаем ${APP_BRAND}…` }) {
  const { reduceMotion } = useAppMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: t.fast }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: C.bg,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduceMotion ? t.fast : spring.soft}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: `linear-gradient(135deg, rgba(211,166,70,.28), rgba(211,166,70,.08))`,
          border: "1px solid rgba(211,166,70,.32)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.primary,
          boxShadow: "0 12px 40px rgba(211,166,70,.18)",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </motion.div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: 0.4 }}>{APP_BRAND}</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{message}</div>
      </div>

      <div
        style={{
          width: 160,
          height: 3,
          borderRadius: 99,
          background: "rgba(255,255,255,.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          className={reduceMotion ? "" : "loader-progress-fill"}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={reduceMotion ? { duration: 0.3 } : { duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${C.primary}, ${C.primary2 || C.primary})`,
            borderRadius: 99,
          }}
        />
      </div>
    </motion.div>
  );
}
