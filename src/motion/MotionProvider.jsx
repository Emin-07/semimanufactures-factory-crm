import { createContext, useContext, useMemo } from "react";
import { useReducedMotion } from "motion/react";

const MotionContext = createContext({ reduceMotion: false });

export function MotionProvider({ children }) {
  const reduceMotion = useReducedMotion();

  const value = useMemo(
    () => ({ reduceMotion: !!reduceMotion }),
    [reduceMotion]
  );

  return (
    <MotionContext.Provider value={value}>
      {children}
    </MotionContext.Provider>
  );
}

export function useAppMotion() {
  return useContext(MotionContext);
}

/** Strip blur/translate for prefers-reduced-motion */
export function useMotionVariants(variants) {
  const { reduceMotion } = useAppMotion();

  return useMemo(() => {
    if (!reduceMotion) return variants;

    const simplify = (v) => {
      if (!v || typeof v !== "object") return v;
      const o = { ...v };
      delete o.filter;
      if ("y" in o) o.y = 0;
      if ("x" in o) o.x = 0;
      if ("scale" in o) o.scale = 1;
      if (o.transition) o.transition = { duration: 0.14, ease: [0.16, 1, 0.3, 1] };
      return o;
    };

    return Object.fromEntries(
      Object.entries(variants).map(([key, val]) => [key, simplify(val)])
    );
  }, [variants, reduceMotion]);
}
