import {
  aggregateJournalOverviewSides,
  challengeStatusLabel,
  countOpenLegsForChallenge,
  getChallengeDashboardMetrics,
  getChallengePropDailyLossUsedOnDate,
  getPairsByChallengeId,
  isChallengeLiveStatus,
} from "./challenges";
import { localTodayYmd } from "./format";
import { isLegClosed } from "./pnl";
import type {
  Challenge,
  ChallengeStatus,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
} from "./types";

/** One challenge row surfaced on the workspace overview (sorted by urgency). */
export type WorkspaceOverviewChallengeRow = {
  challenge: Challenge;
  metrics: ReturnType<typeof getChallengeDashboardMetrics>;
  openPairsCount: number;
  openLegsCount: number;
  drawdownPctOfMax: number;
  dailyLossPctOfCap: number;
};

export type WorkspaceOverviewDigest = {
  identityId: string;
  identityName: string;
  workspaceNote: string;
  countsByChallengeStatus: Partial<Record<ChallengeStatus, number>>;
  liveChallengeCount: number;
  inactiveChallengeCount: number;
  side: ReturnType<typeof aggregateJournalOverviewSides>;
  feesLoggedOnWorkspaceChallenges: number;
  grossBlended: number;
  netAfterTrackedFees: number;
  personalBlendedGross: number;
  totalsInScope: {
    tradeLegs: number;
    openTradeLegs: number;
    openHedgePairs: number;
    closedHedgePairs: number;
    openSessionsScoped: number;
    tradesTouchingCalendarToday: number;
  };
  liveChallengeRows: WorkspaceOverviewChallengeRow[];
  archivedSummary: { ids: string[]; sampleNames: string[] };
  recentTrades: LogTrade[];
};

export function readableChallengeStatusesLine(
  counts: Partial<Record<ChallengeStatus, number>>
): string {
  const parts: string[] = [];
  (Object.entries(counts) as [ChallengeStatus, number][]).forEach(
    ([status, n]) => {
      if ((n ?? 0) > 0) {
        parts.push(`${n} ${challengeStatusLabel(status).toLowerCase()}`);
      }
    }
  );
  return parts.length ? parts.join(" · ") : "No challenges yet";
}

export function buildWorkspaceOverviewDigest(input: {
  identity: Identity;
  sessions: LogSession[];
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: HedgePair[];
  recentTradeLimit?: number;
}): WorkspaceOverviewDigest {
  const { identity, sessions, trades, challenges, pairs } = input;
  const recentLimit = input.recentTradeLimit ?? 7;

  const sessionIdsReferenced = new Set<string>();
  for (const t of trades) {
    if (t.sessionId) sessionIdsReferenced.add(t.sessionId);
  }
  const sessionsScoped = sessions.filter((s) => sessionIdsReferenced.has(s.id));
  const openSessionsScoped = sessionsScoped.filter((s) => !s.closed).length;

  const countsByChallengeStatus: Partial<Record<ChallengeStatus, number>> =
    {};
  for (const c of challenges) {
    countsByChallengeStatus[c.status] =
      (countsByChallengeStatus[c.status] ?? 0) + 1;
  }

  const liveChallengeCount = challenges.filter((c) =>
    isChallengeLiveStatus(c.status)
  ).length;
  const inactiveChallengeCount = challenges.length - liveChallengeCount;

  const side = aggregateJournalOverviewSides(challenges, trades, pairs);
  const feesLoggedOnWorkspaceChallenges = challenges.reduce(
    (a, c) => a + c.fee,
    0
  );
  const grossBlended =
    side.challengeSideRealized +
    side.challengeSideUnrealized +
    side.personalRealized +
    side.personalUnrealized;
  const netAfterTrackedFees = grossBlended - feesLoggedOnWorkspaceChallenges;
  const personalBlendedGross =
    side.personalRealized + side.personalUnrealized;

  const openPairs = pairs.filter((p) => p.status === "open");
  const closedPairs = pairs.filter((p) => p.status !== "open");

  const openTradeLegs = trades.filter((t) => !isLegClosed(t)).length;

  const todayYmd = localTodayYmd();
  let tradesTouchingCalendarToday = 0;
  for (const t of trades) {
    const c = t.createdAt.slice(0, 10);
    const u = t.updatedAt.slice(0, 10);
    if (c === todayYmd || u === todayYmd) tradesTouchingCalendarToday++;
  }

  const liveChallengeRows: WorkspaceOverviewChallengeRow[] = [];
  const archivedChallengeIds: string[] = [];

  for (const ch of challenges) {
    const metrics = getChallengeDashboardMetrics(ch, trades, pairs);
    const chPairs = getPairsByChallengeId(ch.id, trades, pairs);
    const openPairsCount = chPairs.filter((p) => p.status === "open").length;
    const openLegsCount = countOpenLegsForChallenge(ch.id, trades, pairs);
    const drawdownPctOfMax =
      ch.maxDrawdown > 0
        ? metrics.drawdown / ch.maxDrawdown
        : 0;
    const dailyUsed = getChallengePropDailyLossUsedOnDate(ch.id, trades, todayYmd);
    const dailyLossPctOfCap =
      ch.dailyLossCap > 0 ? dailyUsed / ch.dailyLossCap : 0;

    const row: WorkspaceOverviewChallengeRow = {
      challenge: ch,
      metrics,
      openPairsCount,
      openLegsCount,
      drawdownPctOfMax,
      dailyLossPctOfCap,
    };

    if (isChallengeLiveStatus(ch.status)) {
      liveChallengeRows.push(row);
    } else {
      archivedChallengeIds.push(ch.id);
    }
  }

  liveChallengeRows.sort((a, b) => {
    if (a.metrics.targetReachedEval !== b.metrics.targetReachedEval) {
      return a.metrics.targetReachedEval ? -1 : 1;
    }
    const ra = b.drawdownPctOfMax - a.drawdownPctOfMax;
    if (Math.abs(ra) > 1e-9) return ra;
    if (
      a.challenge.status === "evaluation" &&
      b.challenge.status === "evaluation"
    ) {
      return a.metrics.distanceToTarget - b.metrics.distanceToTarget;
    }
    return b.metrics.propRealized - a.metrics.propRealized;
  });

  const archivedChallengesSorted = [...challenges]
    .filter((c) => !isChallengeLiveStatus(c.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const recentTrades = [...trades]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, recentLimit);

  return {
    identityId: identity.id,
    identityName: identity.name,
    workspaceNote: identity.note.trim(),
    countsByChallengeStatus,
    liveChallengeCount,
    inactiveChallengeCount,
    side,
    feesLoggedOnWorkspaceChallenges,
    grossBlended,
    netAfterTrackedFees,
    personalBlendedGross,
    totalsInScope: {
      tradeLegs: trades.length,
      openTradeLegs: openTradeLegs,
      openHedgePairs: openPairs.length,
      closedHedgePairs: closedPairs.length,
      openSessionsScoped,
      tradesTouchingCalendarToday,
    },
    liveChallengeRows,
    archivedSummary: {
      ids: archivedChallengeIds,
      sampleNames: archivedChallengesSorted
        .slice(0, 4)
        .map((x) => x.name),
    },
    recentTrades,
  };
}
