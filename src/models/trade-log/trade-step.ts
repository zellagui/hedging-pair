import type { HedgePair, LogTrade } from "@/models/trade-log/types";

export type TradeLifecycleStep =
  | "Open"
  | "Leg closed"
  | "Hedged"
  | "Closed"
  | "Invalid pair";

/**
 * Per-leg lifecycle: **Open** → **Leg closed** (this leg flat, pair still open) →
 * **Hedged** (both legs flat, pair settled). Unpaired closes are **Closed**.
 */
export function tradeStep(
  trade: LogTrade,
  pairs: HedgePair[],
  trades: LogTrade[]
): TradeLifecycleStep {
  if (trade.exitPrice == null) return "Open";

  const pair = pairs.find(
    (p) => p.propTradeId === trade.id || p.personalTradeId === trade.id
  );

  if (!pair) return "Closed";

  const propLeg = trades.find((t) => t.id === pair.propTradeId);
  const personalLeg = trades.find((t) => t.id === pair.personalTradeId);
  if (!propLeg || !personalLeg) return "Invalid pair";

  if (pair.status === "invalid") return "Invalid pair";

  const bothExited =
    propLeg.exitPrice != null && personalLeg.exitPrice != null;

  if (bothExited) {
    if (
      pair.status === "profitable" ||
      pair.status === "loss" ||
      pair.status === "break-even"
    ) {
      return "Hedged";
    }
    // Both exits set but pair still "open" (recompute pending) — treat as hedged flat.
    return "Hedged";
  }

  if (trade.exitPrice != null) return "Leg closed";

  return "Open";
}

export function pairIdForTrade(
  tradeId: string,
  pairs: HedgePair[]
): string | undefined {
  return pairs.find(
    (p) => p.propTradeId === tradeId || p.personalTradeId === tradeId
  )?.id;
}

export function oppositeTradeForRow(
  tradeId: string,
  pairs: HedgePair[],
  trades: LogTrade[]
): LogTrade | undefined {
  const pair = pairs.find(
    (p) => p.propTradeId === tradeId || p.personalTradeId === tradeId
  );
  if (!pair) return undefined;
  const otherId =
    pair.propTradeId === tradeId
      ? pair.personalTradeId
      : pair.propTradeId;
  return trades.find((t) => t.id === otherId);
}
