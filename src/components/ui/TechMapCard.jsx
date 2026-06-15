import { useState, useRef, useLayoutEffect } from "react";
import { motion } from "motion/react";
import { C } from "../../theme/colors.js";
import { I } from "../../icons/Icons.jsx";
import { stagger, listItem, ease } from "../../motion/presets.js";
import { useAppMotion } from "../../motion/MotionProvider.jsx";

const collapseEase = ease.soft;

function StepIconBox({ children }) {
  return (
    <span style={{
      width: 36, height: 36, flexShrink: 0, borderRadius: 11,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "rgba(216,169,61,.14)", color: C.primary,
      border: "1px solid rgba(216,169,61,.22)",
    }}>{children}</span>
  );
}

function ToggleBtn({ open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tech-map-toggle"
      aria-expanded={open}
      aria-label={open ? "Скрыть технологическую карту" : "Показать технологическую карту"}
      title={open ? "Скрыть" : "Показать"}
      style={{
        marginLeft: "auto",
        flexShrink: 0,
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.10)",
        background: open ? "rgba(216,169,61,.12)" : "rgba(255,255,255,.05)",
        color: open ? C.primary : C.muted,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .22s ease, border-color .22s ease, color .22s ease",
      }}
    >
      <span style={{
        display: "inline-flex",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform .32s cubic-bezier(.16,1,.3,1)",
      }}>
        <I.chevDown size={14} />
      </span>
    </button>
  );
}

function CollapsibleBody({ open, reduceMotion, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const update = () => setHeight(open ? el.scrollHeight : 0);
    update();

    if (!open) return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  if (reduceMotion) {
    return open ? <div>{children}</div> : null;
  }

  return (
    <motion.div
      initial={false}
      animate={{ height, opacity: open ? 1 : 0 }}
      transition={{
        height: { duration: open ? 0.42 : 0.36, ease: collapseEase },
        opacity: { duration: open ? 0.32 : 0.28, ease: collapseEase },
      }}
      style={{ overflow: "hidden", willChange: "height, opacity" }}
    >
      <motion.div
        ref={innerRef}
        initial={false}
        animate={{
          y: open ? 0 : -10,
          opacity: open ? 1 : 0.55,
        }}
        transition={{ duration: open ? 0.38 : 0.32, ease: collapseEase }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function TechMapCard({
  steps = [],
  title = "Технологическая карта",
  subtitle = "Подготовка и этапы приготовления",
  compact = false,
  collapsible = true,
  defaultOpen,
}) {
  const { reduceMotion } = useAppMotion();
  const list = Array.isArray(steps) ? steps.filter(Boolean) : [];
  const [open, setOpen] = useState(defaultOpen ?? !compact);

  if (!list.length) {
    return (
      <div className="tech-map-card" style={{ padding: compact ? 14 : 18 }}>
        <div className="tech-map-header">
          <StepIconBox><I.recipe size={16} /></StepIconBox>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: C.text }}>{title}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Этапы не заданы</div>
          </div>
        </div>
        <div style={{ padding: "16px 0", textAlign: "center", color: C.dim, fontSize: 12 }}>
          Добавьте технологическую карту в карточке товара
        </div>
      </div>
    );
  }

  const StepList = reduceMotion ? "div" : motion.div;
  const StepRow = reduceMotion ? "div" : motion.div;
  const stepListProps = reduceMotion ? {} : { variants: stagger, initial: false, animate: "show" };
  const stepRowProps = reduceMotion ? {} : { variants: listItem, whileHover: { y: -1 } };

  const body = (
    <StepList className="tech-step-list" {...stepListProps}>
      {list.map((step, i) => (
        <StepRow key={i} className="tech-step" {...stepRowProps}>
          <div className="tech-step-number">{i + 1}</div>
          <div className="tech-step-text">{step}</div>
        </StepRow>
      ))}
    </StepList>
  );

  const headerMargin = reduceMotion
    ? { marginBottom: open ? 14 : 0 }
    : undefined;

  const HeaderWrap = reduceMotion ? "div" : motion.div;
  const headerWrapProps = reduceMotion ? {} : {
    initial: false,
    animate: { marginBottom: open ? 14 : 0 },
    transition: { duration: 0.32, ease: collapseEase },
  };

  return (
    <div className="tech-map-card" style={{ padding: compact ? 14 : 18 }}>
      <HeaderWrap className="tech-map-header" style={headerMargin} {...headerWrapProps}>
        <StepIconBox><I.recipe size={16} /></StepIconBox>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
              {open ? subtitle : `${list.length} ${list.length === 1 ? "этап" : list.length < 5 ? "этапа" : "этапов"}`}
            </div>
          )}
        </div>
        {collapsible && (
          <ToggleBtn open={open} onClick={() => setOpen(v => !v)} />
        )}
      </HeaderWrap>
      {collapsible ? (
        <CollapsibleBody open={open} reduceMotion={reduceMotion}>{body}</CollapsibleBody>
      ) : body}
    </div>
  );
}
