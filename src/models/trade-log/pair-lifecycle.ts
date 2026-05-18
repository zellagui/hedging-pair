import { isLegClosed } from "./pnl";
import type { LogTrade } from "./types";

/** 1 = both open, 2 = one closed, 3 = both closed (hedged). */
export function getPairLifecycleStep(
  prop: LogTrade | undefined,
  personal: LogTrade | undefined
): 1 | 2 | 3 {
  const pOpen = prop != null && !isLegClosed(prop);
  const hOpen = personal != null && !isLegClosed(personal);
  if (pOpen && hOpen) return 1;
  if (pOpen !== hOpen) return 2;
  return 3;
}

export function pairLifecycleStepLabel(step: 1 | 2 | 3): string {
  if (step === 1) return "Both open";
  if (step === 2) return "One closed";
  return "Hedged (both closed)";
}

/** Emoji + short label; use `pairLifecycleStepLabel` for a11y titles. */
export function pairLifecycleStepBadgeText(step: 1 | 2 | 3): string {
  if (step === 1) return "🟡 Both open";
  if (step === 2) return "🟠 One closed";
  return "🟢 Hedged";
}
