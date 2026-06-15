import { useEffect, useRef, useState } from "react";
import { useAppMotion } from "../../motion/MotionProvider.jsx";

export function AnimatedNumber({
  value,
  duration = 0.85,
  format,
  suffix = "",
  className = "",
  style = {},
}) {
  const { reduceMotion } = useAppMotion();
  const num = typeof value === "number"
    ? value
    : parseFloat(String(value).replace(/[^\d.-]/g, "")) || 0;

  const [display, setDisplay] = useState(num);
  const prevRef = useRef(num);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(num);
      prevRef.current = num;
      return;
    }

    const from = prevRef.current;
    const to = num;
    if (from === to) return;

    const start = performance.now();
    const dur = duration * 1000;
    let raf;

    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [num, duration, reduceMotion]);

  const text = format
    ? `${format(display)}${suffix}`
    : `${display.toLocaleString("ru")}${suffix}`;

  return (
    <span className={className} style={style}>
      {text}
    </span>
  );
}
