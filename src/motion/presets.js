export const ease = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  soft: [0.22, 1, 0.36, 1],
};

export const spring = {
  soft: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
  snappy: { type: "spring", stiffness: 420, damping: 34, mass: 0.8 },
  slow: { type: "spring", stiffness: 180, damping: 24, mass: 1 },
};

export const t = {
  fast: { duration: 0.16, ease: ease.out },
  base: { duration: 0.24, ease: ease.out },
  smooth: { duration: 0.42, ease: ease.soft },
  page: { duration: 0.46, ease: ease.soft },
  modal: { duration: 0.28, ease: ease.out },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: ease.soft },
  },
};

export const softScale = {
  hidden: { opacity: 0, scale: 0.965, y: 14, filter: "blur(12px)" },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.soft,
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: t.base },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96, filter: "blur(8px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: spring.soft,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    filter: "blur(8px)",
    transition: t.fast,
  },
};

export const slidePanel = {
  hidden: { opacity: 0, x: 28, filter: "blur(8px)" },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: spring.soft,
  },
  exit: {
    opacity: 0,
    x: 18,
    filter: "blur(8px)",
    transition: t.fast,
  },
};

export const dropdown = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    filter: "blur(8px)",
    transformOrigin: "top right",
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: spring.snappy,
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.985,
    filter: "blur(6px)",
    transition: t.fast,
  },
};

export const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.08,
    },
  },
};

export const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: t.smooth,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: t.fast,
  },
};

export const pageTransition = {
  initial: {
    opacity: 0,
    y: 16,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: t.page,
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(8px)",
    transition: { duration: 0.18, ease: ease.out },
  },
};

export const sheetUp = {
  hidden: { opacity: 0, y: "100%" },
  show: {
    opacity: 1,
    y: 0,
    transition: spring.soft,
  },
  exit: {
    opacity: 0,
    y: "40%",
    transition: t.fast,
  },
};
