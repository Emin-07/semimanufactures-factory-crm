import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { C, glassCardStyle } from "../theme/colors.js";
import { APP_BRAND, APP_TAGLINE } from "../constants/brand.js";
import { I } from "../icons/Icons.jsx";
import { Btn, Inp, IconBox } from "../components/ui/index.jsx";
import { spring } from "../motion/presets.js";

const DEMO_ACCOUNTS = [
  { label: "Директор", email: "director@factory.ru", pw: "director123", tone: "director" },
  { label: "Менеджер", email: "manager@factory.ru", pw: "manager123", tone: "manager" },
  { label: "Владелец", email: "owner@factory.ru", pw: "owner123", tone: "owner" },
  { label: "Лепщица", email: "lep1@factory.ru", pw: "worker123", tone: "lepstitsa" },
  { label: "Фасовщица", email: "packer@factory.ru", pw: "worker123", tone: "packer" },
  { label: "Курьер", email: "courier@factory.ru", pw: "worker123", tone: "courier" },
];

const easeOut = [0.16, 1, 0.3, 1];

const pageStagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 22,
    filter: "blur(10px)",
  },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.58,
      ease: easeOut,
    },
  },
};

const cardReveal = {
  hidden: {
    opacity: 0,
    y: 26,
    scale: 0.965,
    filter: "blur(14px)",
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.68,
      ease: easeOut,
    },
  },
};

const BrandVisual = () => (
  <>
    <div className="brand-grid" />
    <div className="brand-orbit-wrap brand-orbit-wrap-one">
      <div className="brand-orbit brand-orbit-one" />
    </div>
    <div className="brand-orbit-wrap brand-orbit-wrap-two">
      <div className="brand-orbit brand-orbit-two" />
    </div>
    <div className="brand-node node-a" />
    <div className="brand-node node-b" />
    <div className="brand-node node-c" />
    <div className="brand-route route-a" />
    <div className="brand-route route-b" />
    <svg className="brand-silhouettes" viewBox="0 0 420 420" aria-hidden="true">
      <g fill="none" stroke="rgba(248,241,229,.07)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M48 118h52v36H48z M58 154v18 M90 136h10" />
        <path d="M300 92l28 14v42l-28 14-28-14v-42z M286 120h28" />
        <path d="M72 288h88 M72 304h62 M72 320h74" />
        <path d="M318 268c0-14 11-24 24-24s24 10 24 24v38h-48z M330 244v-10" />
        <path d="M168 72c18-10 38-10 56 0 M168 88h56 M196 88v28" />
      </g>
    </svg>
  </>
);

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("director@factory.ru");
  const [pw, setPw] = useState("director123");
  const [selectedDemo, setSelectedDemo] = useState("director@factory.ru");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      fetch("/api/health", { cache: "no-store" })
        .then(r => { if (mounted) setApiOk(r.ok); })
        .catch(() => { if (mounted) setApiOk(false); });
    };
    check();
    const t = setInterval(check, 5000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const pickDemo = (a) => {
    setSelectedDemo(a.email);
    setEmail(a.email);
    setPw(a.pw);
    setTimeout(() => setSelectedDemo(""), 450);
  };

  const go = async () => {
    if (loading) return;
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
      if (!r.ok) { const data = await r.json(); setErr(data.error || "Ошибка входа"); return; }
      onLogin(await r.json());
    } catch { setErr("Сервер недоступен. Запустите: npm run dev"); }
    finally { setLoading(false); }
  };

  return (
    <motion.main
      className="login-page login-shell"
      variants={pageStagger}
      initial="hidden"
      animate="show"
    >
      <section className="login-brand-panel">
        <motion.div
          className="login-brand-visual"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: easeOut }}
        >
          <BrandVisual />
        </motion.div>

        <motion.div className="login-brand-content" variants={pageStagger}>
          <motion.div className="login-logo-mark" variants={cardReveal}>
            <IconBox tone="primary" size={64} s={{ borderRadius: 18 }}>
              <I.logo size={30} />
            </IconBox>
          </motion.div>

          <motion.h1 className="login-brand-title" variants={fadeUp}>{APP_BRAND}</motion.h1>

          <motion.p className="login-brand-sub" variants={fadeUp}>
            {APP_TAGLINE}
          </motion.p>
        </motion.div>
      </section>

      <motion.section className="login-auth-column login-panel" variants={pageStagger}>
        <motion.div className="login-form-card login-card" variants={cardReveal}>
          <div style={{ padding: "36px 40px 32px", position: "relative", zIndex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Вход</h2>
            <p style={{ margin: "6px 0 24px", color: C.muted, fontSize: 13 }}>Введите данные аккаунта</p>

            {apiOk === false && (
              <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}40`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: C.danger, marginBottom: 4 }}>
                  <I.alert size={15} /> Backend не запущен
                </div>
                <div style={{ color: C.muted }}>Запустите: <code style={{ color: C.primary }}>npm run dev</code></div>
              </div>
            )}
            {err && (
              <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}35`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: C.danger, fontSize: 12 }}>
                <I.alert size={15} />{err}
              </div>
            )}

            <Inp label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            <Inp label="Пароль" type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} disabled={loading} />
            <Btn onClick={go} style={{ width: "100%", justifyContent: "center", padding: 13, marginTop: 8 }} sz="lg" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Btn>
          </div>
        </motion.div>

        <motion.div
          className="demo-accounts-panel"
          variants={cardReveal}
          style={{ marginTop: 20, ...glassCardStyle, borderRadius: 16, padding: "16px 18px" }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Демо-аккаунты
          </div>
          <motion.div className="login-demo-grid" variants={pageStagger}>
            {DEMO_ACCOUNTS.map(a => (
              <motion.button
                key={a.email}
                type="button"
                data-tone={a.tone}
                className={`demo-account-card${selectedDemo === a.email ? " selected" : ""}`}
                onClick={() => pickDemo(a)}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
              >
                <IconBox tone={a.tone === "director" ? "danger" : a.tone === "manager" ? "info" : a.tone === "owner" ? "purple" : a.tone === "packer" ? "cyan" : a.tone === "courier" ? "warning" : "primary"} size={28}>
                  <I.user size={14} />
                </IconBox>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{a.email.split("@")[0]}</div>
                </span>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>
    </motion.main>
  );
};

export { LoginPage };
