import pc from "picocolors";

/**
 * Blockend CLI Theme System
 * Single source of truth for all colors/styles
 */

export const theme = {
  brand: {
    primary: pc.cyan,
    title: pc.bold,
    logo: pc.white
  },

  text: {
    normal: pc.white,
    muted: pc.dim,
    subtle: pc.gray
  },

  state: {
    success: pc.green,
    warning: pc.yellow,
    error: pc.red,
    info: pc.cyan
  },

  emphasis: {
    strong: pc.bold,
    dim: pc.dim
  }
} as const;
