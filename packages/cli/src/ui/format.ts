// apps/cli/src/ui/format.ts
import { theme } from "./theme.js";

export const format = {
  title: (text: string) => theme.brand.primary(theme.brand.title(text)),

  success: (text: string) => theme.state.success(`✔ ${text}`),

  error: (text: string) => theme.state.error(`✖ ${text}`),

  warning: (text: string) => theme.state.warning(text),

  muted: (text: string) => theme.text.muted(text),

  info: (text: string) => theme.state.info(text)
};
