import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { toneColors } from "../../theme/colors.js";
import { I } from "../../icons/Icons.jsx";
import { useAppMotion } from "../../motion/MotionProvider.jsx";
import { t } from "../../motion/presets.js";

const MOBILE_BP = 760;
const STRIP_GAP = 12;
const CARD_TRANSITION = { duration: 0.38, ease: [0.16, 1, 0.3, 1] };
const DESKTOP_ROW_HEIGHT = 104;
const EXPANDED_UNITS = 2.45;
const SHRINK_UNITS = 0.72;
const NORMAL_UNITS = 1;

function useOverflow(deps = []) {
  const ref = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const overflow =
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1;
      setIsOverflowing(overflow);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, deps);

  return [ref, isOverflowing];
}

function useIsMobile(breakpoint = MOBILE_BP) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

function calcCardWidth(stripWidth, count, isExpanded, hasExpanded) {
  if (stripWidth <= 0 || count <= 0) return undefined;
  const available = stripWidth - (count - 1) * STRIP_GAP;
  if (available <= 0) return 0;
  if (!hasExpanded) return available / count;
  const totalUnits = (count - 1) * SHRINK_UNITS + EXPANDED_UNITS;
  const units = isExpanded ? EXPANDED_UNITS : SHRINK_UNITS;
  return (units / totalUnits) * available;
}

function ExpandableMetricCard({
  metric,
  isExpanded,
  hasExpanded,
  onToggle,
  targetWidth,
  fallbackWidth,
  isMobile,
}) {
  const { reduceMotion } = useAppMotion();
  const toneClr = toneColors[metric.tone] || toneColors.primary;

  const [labelRef, labelOverflow] = useOverflow([metric.label, isExpanded]);
  const [valueRef, valueOverflow] = useOverflow([metric.value, metric.fullValue, isExpanded]);
  const [subtitleRef, subtitleOverflow] = useOverflow([metric.subtitle, isExpanded]);

  const canExpand =
    metric.expandable ||
    Boolean(metric.fullValue) ||
    labelOverflow ||
    valueOverflow ||
    subtitleOverflow ||
    isExpanded;

  const displayValue =
    isExpanded && metric.fullValue ? metric.fullValue : metric.value;

  const title = !isExpanded && canExpand
    ? `${metric.label}: ${metric.fullValue || metric.value}`
    : undefined;

  const cardTransition = reduceMotion ? t.base : CARD_TRANSITION;
  const dimmed = hasExpanded && !isExpanded && !isMobile;
  const desktopWidth = targetWidth ?? fallbackWidth;

  return (
    <motion.button
      type="button"
      initial={false}
      animate={{
        width: isMobile ? "100%" : desktopWidth,
        opacity: dimmed ? 0.82 : 1,
        minHeight: isMobile && isExpanded ? 128 : DESKTOP_ROW_HEIGHT,
        height: isMobile ? undefined : DESKTOP_ROW_HEIGHT,
      }}
      transition={cardTransition}
      className={[
        "expandable-metric-card",
        canExpand ? "is-clickable" : "",
        isExpanded ? "is-expanded" : "",
        isMobile && isExpanded ? "is-expanded-mobile" : "",
      ].filter(Boolean).join(" ")}
      data-tone={metric.tone || "primary"}
      style={{
        "--metric-tone": toneClr,
        flexShrink: 0,
        borderColor: isExpanded ? `${toneClr}52` : `${toneClr}22`,
        background: isExpanded
          ? `linear-gradient(180deg, ${toneClr}22, rgba(255,255,255,.04))`
          : `linear-gradient(180deg, ${toneClr}10, rgba(255,255,255,.03))`,
      }}
      onClick={canExpand ? onToggle : undefined}
      aria-expanded={canExpand ? isExpanded : undefined}
      title={title}
      whileTap={canExpand && !reduceMotion ? { scale: 0.985 } : undefined}
    >
      <div className="metric-topline">
        <div ref={labelRef} className="metric-label">{metric.label}</div>
        {canExpand && (
          <span className={`metric-expand-indicator${isExpanded ? " is-open" : ""}`} aria-hidden="true">
            {isExpanded ? (
              <>
                <span className="metric-expand-text">Свернуть</span>
                <I.chevDown size={11} />
              </>
            ) : (
              <I.chevRight size={11} />
            )}
          </span>
        )}
      </div>
      <div className={`metric-value money-text${isExpanded ? " is-expanded" : ""}`} style={{ color: toneClr }}>
        <span ref={valueRef} className="metric-value-inner">{displayValue}</span>
      </div>
      {metric.subtitle && (
        <div ref={subtitleRef} className="metric-subtitle">{metric.subtitle}</div>
      )}
    </motion.button>
  );
}

export function ExpandableMetricStrip({ metrics, className = "" }) {
  const [expandedMetricId, setExpandedMetricId] = useState(null);
  const [stripWidth, setStripWidth] = useState(0);
  const stripRef = useRef(null);
  const isMobile = useIsMobile();
  const hasExpanded = Boolean(expandedMetricId);
  const count = metrics.length;

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setStripWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [count]);

  useEffect(() => {
    if (expandedMetricId && !metrics.some(m => m.id === expandedMetricId)) {
      setExpandedMetricId(null);
    }
  }, [metrics, expandedMetricId]);

  useEffect(() => {
    if (!expandedMetricId) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setExpandedMetricId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedMetricId]);

  const toggleMetric = (id) => {
    setExpandedMetricId(current => (current === id ? null : id));
  };

  const widths = useMemo(() => {
    const map = {};
    for (const metric of metrics) {
      map[metric.id] = calcCardWidth(
        stripWidth,
        count,
        expandedMetricId === metric.id,
        hasExpanded
      );
    }
    return map;
  }, [metrics, stripWidth, count, expandedMetricId, hasExpanded]);

  const fallbackWidth = `calc((100% - ${Math.max(count - 1, 0) * STRIP_GAP}px) / ${Math.max(count, 1)})`;

  return (
    <div
      ref={stripRef}
      className={`metric-strip${hasExpanded ? " has-expanded" : ""}${isMobile ? " is-mobile" : ""}${className ? ` ${className}` : ""}`}
    >
      {metrics.map(metric => (
        <ExpandableMetricCard
          key={metric.id}
          metric={metric}
          isExpanded={expandedMetricId === metric.id}
          hasExpanded={hasExpanded}
          onToggle={() => toggleMetric(metric.id)}
          targetWidth={widths[metric.id]}
          fallbackWidth={fallbackWidth}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}
