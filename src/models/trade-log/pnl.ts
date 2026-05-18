import type { HedgePair, LogTrade } from "./types";

/** Long +1, short -1 (applied to price delta). */
export function directionMultiplier(direction: LogTrade["direction"]): number {
  return direction === "long" ? 1 : -1;
}

/**
 * Price-based realized P&amp;L only (`exitPrice` set). Does not use {@link LogTrade.directPnl}.
 */
export function computeRealizedPnl(trade: LogTrade): number {
  if (trade.exitPrice == null) return 0;
  const m = directionMultiplier(trade.direction);
  const gross = (trade.exitPrice - trade.entryPrice) * trade.size * m;
  return gross - trade.fees;
}

/**
 * Closed P&amp;L if the leg exited at `exitPrice` (same math as {@link computeRealizedPnl}).
 * For “what if TP/SL hits” previews while the leg is still open.
 */
export function hypotheticalRealizedPnlAtExit(
  direction: LogTrade["direction"],
  size: number,
  entryPrice: number,
  exitPrice: number,
  fees: number
): number {
  const m = directionMultiplier(direction);
  const gross = (exitPrice - entryPrice) * size * m;
  return gross - fees;
}

/** Leg is settled when priced close or direct P&amp;L was logged. */
export function isLegClosed(trade: LogTrade): boolean {
  return trade.exitPrice != null || trade.directPnl != null;
}

/** Realized dollars on a closed leg (direct or price-computed). */
export function realizedLegAmount(trade: LogTrade): number {
  if (trade.directPnl != null) return trade.directPnl;
  if (trade.exitPrice != null) return computeRealizedPnl(trade);
  return 0;
}

/**
 * Open trade: mark-to-market using currentPrice. Fees are NOT subtracted here
 * so closing later does not double-count fees (fees apply only on realized).
 */
export function computeUnrealizedPnl(trade: LogTrade): number {
  if (isLegClosed(trade)) return 0;
  if (trade.currentPrice == null) return 0;
  const m = directionMultiplier(trade.direction);
  return (trade.currentPrice - trade.entryPrice) * trade.size * m;
}

/** Single display value for table + coloring. */
export function displayPnl(trade: LogTrade): {
  kind: "realized" | "unrealized";
  value: number;
} {
  if (isLegClosed(trade)) {
    return { kind: "realized", value: realizedLegAmount(trade) };
  }
  return { kind: "unrealized", value: computeUnrealizedPnl(trade) };
}

/**
 * Per-leg effective P&amp;L: direct P&amp;L, else price-realized, else unrealized
 * from mark, else 0.
 */
export function effectiveLegPnl(trade: LogTrade): number {
  if (trade.directPnl != null) return trade.directPnl;
  if (trade.exitPrice != null) return computeRealizedPnl(trade);
  if (trade.currentPrice != null) return computeUnrealizedPnl(trade);
  return 0;
}

export function aggregateOverview(trades: LogTrade[]): {
  totalRealized: number;
  totalUnrealized: number;
  totalTrades: number;
  openTrades: number;
} {
  let totalRealized = 0;
  let totalUnrealized = 0;
  let openTrades = 0;
  for (const t of trades) {
    if (isLegClosed(t)) {
      totalRealized += realizedLegAmount(t);
    } else {
      openTrades += 1;
      totalUnrealized += computeUnrealizedPnl(t);
    }
  }
  return {
    totalRealized,
    totalUnrealized,
    totalTrades: trades.length,
    openTrades,
  };
}

export function isPropTrade(t: LogTrade): boolean {
  return t.challengeId != null;
}

export function isPersonalTrade(t: LogTrade): boolean {
  return t.challengeId == null;
}

export function sumEffectiveLegPnl(
  trades: LogTrade[],
  predicate?: (t: LogTrade) => boolean
): number {
  let sum = 0;
  for (const t of trades) {
    if (predicate && !predicate(t)) continue;
    sum += effectiveLegPnl(t);
  }
  return sum;
}

/** Sum effectiveLegPnl for prop trades tied to this challenge (open + closed). */
export function effectivePropPnlForChallenge(
  challengeId: string,
  trades: LogTrade[]
): number {
  return sumEffectiveLegPnl(
    trades,
    (t) => t.challengeId === challengeId
  );
}

/** Personal-leg P&L for pairs whose prop leg belongs to `challengeId`. */
export function effectivePersonalPnlForChallenge(
  challengeId: string,
  trades: LogTrade[],
  pairs: HedgePair[]
): number {
  const tradeById = new Map(trades.map((t) => [t.id, t] as const));
  let sum = 0;
  for (const p of pairs) {
    const prop = tradeById.get(p.propTradeId);
    if (!prop || prop.challengeId !== challengeId) continue;
    const personal = tradeById.get(p.personalTradeId);
    if (personal) sum += effectiveLegPnl(personal);
  }
  return sum;
}

/** Closed-leg only: sum realized P&L for prop trades on this challenge. */
export function realizedPropPnlForChallenge(
  challengeId: string,
  trades: LogTrade[]
): number {
  let sum = 0;
  for (const t of trades) {
    if (t.challengeId === challengeId && isLegClosed(t)) {
      sum += realizedLegAmount(t);
    }
  }
  return sum;
}

/** Closed-leg only: realized P&L on personal legs linked to this challenge's prop pairs. */
export function realizedPersonalPnlForChallenge(
  challengeId: string,
  trades: LogTrade[],
  pairs: HedgePair[]
): number {
  const tradeById = new Map(trades.map((t) => [t.id, t] as const));
  let sum = 0;
  for (const p of pairs) {
    const prop = tradeById.get(p.propTradeId);
    if (!prop || prop.challengeId !== challengeId) continue;
    const personal = tradeById.get(p.personalTradeId);
    if (personal && isLegClosed(personal)) {
      sum += realizedLegAmount(personal);
    }
  }
  return sum;
}

/** Prop + linked personal P&L minus challenge fee (fee = one-time eval cost proxy). */
export function effectiveNetPnlForChallenge(
  challenge: { id: string; fee: number },
  trades: LogTrade[],
  pairs: HedgePair[]
): number {
  const prop = effectivePropPnlForChallenge(challenge.id, trades);
  const personal = effectivePersonalPnlForChallenge(
    challenge.id,
    trades,
    pairs
  );
  return prop + personal - challenge.fee;
}
