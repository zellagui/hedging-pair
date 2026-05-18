import { effectiveLegPnl, isLegClosed } from "./pnl";
import type { HedgePair, LogTrade } from "./types";

const EPS = 1;

export function isValidHedgePairLegs(pt: LogTrade, ht: LogTrade): boolean {
  return pt.challengeId != null && ht.challengeId == null;
}

function nowIso() {
  return new Date().toISOString();
}

export function pairOutcomeFromCombined(
  combined: number,
  anyLegOpen: boolean
): HedgePair["status"] {
  if (anyLegOpen) return "open";
  if (combined > EPS) return "profitable";
  if (combined < -EPS) return "loss";
  return "break-even";
}

/**
 * Recompute combinedPnl from legs. Missing trade → invalid.
 * Manual mode: keep status; still refresh combinedPnl.
 */
export function recomputePair(
  pair: HedgePair,
  tradeById: Map<string, LogTrade>
): HedgePair {
  const pt = tradeById.get(pair.propTradeId);
  const ht = tradeById.get(pair.personalTradeId);
  const updatedAt = nowIso();

  if (!pt || !ht) {
    return { ...pair, combinedPnl: 0, status: "invalid", updatedAt };
  }

  const combinedPnl = effectiveLegPnl(pt) + effectiveLegPnl(ht);
  const anyLegOpen = !isLegClosed(pt) || !isLegClosed(ht);

  // Wrong tagging: prop leg must have a challenge; personal must not — overrides manual status.
  if (pt.challengeId == null || ht.challengeId != null) {
    return { ...pair, combinedPnl, status: "invalid", updatedAt };
  }

  if (pair.manuallySetStatus) {
    return { ...pair, combinedPnl, updatedAt };
  }

  const status = pairOutcomeFromCombined(combinedPnl, anyLegOpen);
  return { ...pair, combinedPnl, status, updatedAt };
}

export function refreshAllPairs(
  pairs: HedgePair[],
  trades: LogTrade[]
): HedgePair[] {
  const map = new Map(trades.map((t) => [t.id, t] as const));
  return pairs.map((p) => recomputePair(p, map));
}
