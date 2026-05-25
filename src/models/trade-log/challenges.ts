import {
  computeUnrealizedPnl,
  effectivePersonalPnlForChallenge,
  effectivePropPnlForChallenge,
  isLegClosed,
  realizedLegAmount,
  realizedPersonalPnlForChallenge,
  realizedPropPnlForChallenge,
} from "./pnl";
import { dateFromCreatedAt } from "./format";
import type { Challenge, ChallengeStatus, HedgePair, LogTrade } from "./types";

/** New prop-firm legs allowed only while challenge is still in an active runway. */
export function challengeAcceptsNewPropTrades(c: Challenge): boolean {
  return (
    c.status === "evaluation" ||
    c.status === "funded" ||
    c.status === "passed"
  );
}

/** All selectable challenge statuses (archived removed — migrated to failed). */
export const ALL_CHALLENGE_STATUSES: readonly ChallengeStatus[] = [
  "evaluation",
  "passed",
  "failed",
  "funded",
  "paid_out",
];

const OTHER_STATUSES = (current: ChallengeStatus): ChallengeStatus[] =>
  ALL_CHALLENGE_STATUSES.filter((s) => s !== current);

/**
 * Allowed manual transitions — any status may move to any other valid status.
 */
export const CHALLENGE_STATUS_TRANSITIONS: Record<
  ChallengeStatus,
  readonly ChallengeStatus[]
> = {
  evaluation: OTHER_STATUSES("evaluation"),
  passed: OTHER_STATUSES("passed"),
  failed: OTHER_STATUSES("failed"),
  funded: OTHER_STATUSES("funded"),
  paid_out: OTHER_STATUSES("paid_out"),
};

export function isValidChallengeStatusTransition(
  from: ChallengeStatus,
  to: ChallengeStatus
): boolean {
  if (from === to) return true;
  return ALL_CHALLENGE_STATUSES.includes(to);
}

/** Status options in create/edit forms — always full list. */
export function selectableChallengeStatuses(
  _persistedStatus: ChallengeStatus | null
): ChallengeStatus[] {
  return [...ALL_CHALLENGE_STATUSES];
}

export function challengeStatusLabel(status: ChallengeStatus): string {
  switch (status) {
    case "evaluation":
      return "Evaluation";
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "funded":
      return "Funded";
    case "paid_out":
      return "Paid out";
    default:
      return status;
  }
}

export function getTradesByChallengeId(
  challengeId: string,
  trades: LogTrade[]
): LogTrade[] {
  return trades.filter((t) => t.challengeId === challengeId);
}

export function getPairsByChallengeId(
  challengeId: string,
  trades: LogTrade[],
  pairs: HedgePair[]
): HedgePair[] {
  const ids = new Set(
    trades.filter((t) => t.challengeId === challengeId).map((t) => t.id)
  );
  return pairs.filter((p) => ids.has(p.propTradeId));
}

/** Assign phaseNumber 1..n per challenge by pair createdAt (migration / repair). */
export function assignPhaseNumbersToPairs(
  trades: LogTrade[],
  pairs: HedgePair[]
): HedgePair[] {
  const challengeForPair = (pair: HedgePair) => {
    const t = trades.find((x) => x.id === pair.propTradeId);
    return t?.challengeId ?? null;
  };
  const groups = new Map<string, HedgePair[]>();
  for (const p of pairs) {
    const c = challengeForPair(p);
    if (!c) continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(p);
  }
  const phaseById = new Map<string, number>();
  for (const [, plist] of groups) {
    plist.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    plist.forEach((pair, i) => phaseById.set(pair.id, i + 1));
  }
  return pairs.map((p) => ({
    ...p,
    phaseNumber:
      phaseById.get(p.id) ??
      (typeof p.phaseNumber === "number" && p.phaseNumber > 0
        ? p.phaseNumber
        : 1),
  }));
}

/**
 * Rough notional tied up on personal hedge legs (|size × entry| per linked
 * personal trade). For display only.
 */
export function estimatePersonalNotionalForChallenge(
  challengeId: string,
  trades: LogTrade[],
  pairs: HedgePair[]
): number {
  let sum = 0;
  for (const p of getPairsByChallengeId(challengeId, trades, pairs)) {
    const t = trades.find((x) => x.id === p.personalTradeId);
    if (t) sum += Math.abs(t.size * t.entryPrice);
  }
  return sum;
}

/** Latest activity timestamp for filtering (challenge updates + related trades). */
export function challengeLatestActivityIso(
  challenge: Challenge,
  trades: LogTrade[],
  pairs: HedgePair[]
): string {
  let max = challenge.updatedAt;
  const bump = (iso: string | undefined) => {
    if (iso && iso > max) max = iso;
  };
  bump(challenge.createdAt);

  for (const t of trades) {
    if (t.challengeId !== challenge.id) continue;
    bump(t.updatedAt);
    bump(t.createdAt);
  }
  for (const p of getPairsByChallengeId(challenge.id, trades, pairs)) {
    const pt = trades.find((x) => x.id === p.propTradeId);
    const ht = trades.find((x) => x.id === p.personalTradeId);
    if (pt) {
      bump(pt.updatedAt);
      bump(pt.createdAt);
    }
    if (ht) {
      bump(ht.updatedAt);
      bump(ht.createdAt);
    }
  }
  return max;
}

/**
 * Inclusive YYYY-MM-DD range on {@link challengeLatestActivityIso} calendar day
 * (UTC date from ISO strings). Empty bounds = no bound.
 */
export function challengeMatchesActivityDateRange(
  challenge: Challenge,
  trades: LogTrade[],
  pairs: HedgePair[],
  fromYmd: string,
  toYmd: string
): boolean {
  const ymd = challengeLatestActivityIso(challenge, trades, pairs).slice(0, 10);
  if (fromYmd.trim() && ymd < fromYmd.trim()) return false;
  if (toYmd.trim() && ymd > toYmd.trim()) return false;
  return true;
}

/** Active runway — evaluation, funded, or passed (still tended in journal). */
export function isChallengeLiveStatus(status: Challenge["status"]): boolean {
  return (
    status === "evaluation" || status === "funded" || status === "passed"
  );
}

/** Dashboard metrics: prop = challenge progress; personal = real money; netReal = personal − fee. */
export function getChallengeDashboardMetrics(
  challenge: Challenge,
  trades: LogTrade[],
  pairs: HedgePair[]
): {
  propRunning: number;
  propRealized: number;
  personalRunning: number;
  personalRealized: number;
  combinedRealized: number;
  netReal: number;
  netAfterFee: number;
  distanceToTarget: number;
  targetReachedEval: boolean;
  drawdown: number;
} {
  const propRunning = effectivePropPnlForChallenge(challenge.id, trades);
  const personalRunning = effectivePersonalPnlForChallenge(
    challenge.id,
    trades,
    pairs
  );
  const propRealized = realizedPropPnlForChallenge(challenge.id, trades);
  const personalRealized = realizedPersonalPnlForChallenge(
    challenge.id,
    trades,
    pairs
  );

  const netReal = personalRealized - challenge.fee;
  const netAfterFee = netReal;
  const combinedRealized = propRealized + personalRealized;

  const isEval = challenge.status === "evaluation";
  const distanceToTarget =
    challenge.currentProfitTarget - propRealized;
  const targetReachedEval =
    isEval &&
    challenge.currentProfitTarget > 0 &&
    propRealized >= challenge.currentProfitTarget;

  const propTrades = trades
    .filter((t) => t.challengeId === challenge.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let cumRealized = 0;
  let peakEquity = challenge.balance;
  for (const t of propTrades) {
    if (isLegClosed(t)) {
      cumRealized += realizedLegAmount(t);
      const equity = challenge.balance + cumRealized;
      peakEquity = Math.max(peakEquity, equity);
    }
  }
  const equityNow = challenge.balance + propRealized;
  const drawdown = Math.max(0, peakEquity - equityNow);

  return {
    propRunning,
    propRealized,
    personalRunning,
    personalRealized,
    combinedRealized,
    netReal,
    netAfterFee,
    distanceToTarget,
    targetReachedEval,
    drawdown,
  };
}

export type ChallengeDashboardMetrics = ReturnType<
  typeof getChallengeDashboardMetrics
>;

/**
 * Home overview KPI split — same per-challenge math as challenge list / detail
 * ({@link getChallengeDashboardMetrics}), plus **unpaired** personal trades
 * (`challengeId` null, not in any hedge pair). Avoids book-level drift when pair
 * membership and `challengeId` disagree.
 */
export function aggregateJournalOverviewSides(
  challenges: Challenge[],
  trades: LogTrade[],
  pairs: HedgePair[]
): {
  challengeSideRealized: number;
  challengeSideUnrealized: number;
  personalRealized: number;
  personalUnrealized: number;
} {
  let challengeSideRealized = 0;
  let challengeSideUnrealized = 0;
  let personalRealized = 0;
  let personalUnrealized = 0;

  for (const c of challenges) {
    const d = getChallengeDashboardMetrics(c, trades, pairs);
    challengeSideRealized += d.propRealized;
    personalRealized += d.personalRealized;
    challengeSideUnrealized += d.propRunning - d.propRealized;
    personalUnrealized += d.personalRunning - d.personalRealized;
  }

  const inPair = new Set<string>();
  for (const p of pairs) {
    inPair.add(p.propTradeId);
    inPair.add(p.personalTradeId);
  }
  const challengeIds = new Set(challenges.map((c) => c.id));

  for (const t of trades) {
    if (inPair.has(t.id)) continue;
    if (t.challengeId != null && challengeIds.has(t.challengeId)) continue;

    if (t.challengeId != null) {
      if (isLegClosed(t)) {
        challengeSideRealized += realizedLegAmount(t);
      } else {
        challengeSideUnrealized += computeUnrealizedPnl(t);
      }
    } else {
      if (isLegClosed(t)) {
        personalRealized += realizedLegAmount(t);
      } else {
        personalUnrealized += computeUnrealizedPnl(t);
      }
    }
  }

  return {
    challengeSideRealized,
    challengeSideUnrealized,
    personalRealized,
    personalUnrealized,
  };
}

/**
 * Sets **failed** when realized-path drawdown exceeds **maxDrawdown** for
 * evaluation or funded challenges.
 */
export function applyChallengeDrawdownBreachFailure(
  challenges: Challenge[],
  trades: LogTrade[],
  pairs: HedgePair[],
  stampNow: () => string
): Challenge[] {
  let changed = false;
  const out = challenges.map((c) => {
    if (c.status !== "evaluation" && c.status !== "funded") return c;
    if (c.maxDrawdown <= 0) return c;
    const dd = getChallengeDashboardMetrics(c, trades, pairs).drawdown;
    if (dd > c.maxDrawdown) {
      changed = true;
      return { ...c, status: "failed" as const, updatedAt: stampNow() };
    }
    return c;
  });
  return changed ? out : challenges;
}

/**
 * Prop-firm realized **loss** booked on a calendar day (local YYYY-MM-DD),
 * using `updatedAt` as the close date proxy. Counts toward daily loss cap UI.
 */
export function getChallengePropDailyLossUsedOnDate(
  challengeId: string,
  trades: LogTrade[],
  ymd: string
): number {
  let used = 0;
  for (const t of trades) {
    if (t.challengeId !== challengeId || !isLegClosed(t)) continue;
    if (dateFromCreatedAt(t.updatedAt) !== ymd) continue;
    const pnl = realizedLegAmount(t);
    if (pnl < 0) used += -pnl;
  }
  return used;
}

/** Open prop legs + open personal legs in pairs for this challenge. */
export function countOpenLegsForChallenge(
  challengeId: string,
  trades: LogTrade[],
  pairs: HedgePair[]
): number {
  let n = 0;
  for (const t of trades) {
    if (t.challengeId === challengeId && !isLegClosed(t)) n++;
  }
  for (const p of pairs) {
    const prop = trades.find((tr) => tr.id === p.propTradeId);
    if (prop?.challengeId !== challengeId) continue;
    const per = trades.find((tr) => tr.id === p.personalTradeId);
    if (per && !isLegClosed(per)) n++;
  }
  return n;
}
