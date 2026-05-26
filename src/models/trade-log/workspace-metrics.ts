import { 
  aggregateJournalOverviewSides, 
  getChallengeDashboardMetrics,
  getPairsByChallengeId,
  isChallengeLiveStatus,
  estimatePersonalNotionalForChallenge
} from "./challenges";
import { localTodayYmd } from "./format";
import { isPersonalTrade, effectiveLegPnl, isLegClosed } from "./pnl";
import type {
  Challenge,
  ChallengeStatus,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
} from "./types";

// Canonical workspace metrics interface
export interface CanonicalWorkspaceMetrics {
  // Challenge-related P&L (uses pairs + individual trades correctly)
  challengeSideRealized: number;
  challengeSideUnrealized: number;
  personalRealized: number;
  personalUnrealized: number;
  
  // Fees and net calculations
  totalChallengeFees: number;
  grossBeforeFees: number;
  bookAfterFees: number;
  
  // Challenge counts
  activeRunways: number;
  failedChallenges: number;
  passedChallenges: number;
  fundedChallenges: number;
  paidOutChallenges: number;
  
  // Session data
  openSessionsToday: number;
  
  // Statistics
  statistics: WorkspaceStatistics;
  workspaceBreakdown: WorkspaceBreakdownRow[];
  recentTrades: LogTrade[];
  
  // Challenge list KPIs (for challenges page)
  challengeListKpis: ChallengeListKpis;
}

// Challenge list KPI interface matching the existing challenges-index-page logic
export interface ChallengeListKpis {
  count: number;
  live: number;
  phases: number;
  fees: number;
  hedgeNotional: number;
  totalInvested: number;
  /** Fees + personal hedge losses for evaluation challenges only */
  fundInEval: number;
  netRealExclEvaluation: number;
  evalNetReal: number;
}

// Statistics sub-interface
export interface WorkspaceStatistics {
  averageChallengeFee: number;
  totalChallengeFees: number;
  averagePersonalPnl: number;
  averageFirmPnl: number;
  averageTradeOverall: number;
  winRate: number;
  positiveTradeCount: number;
  negativeTradeCount: number;
  flatTradeCount: number;
  averageTradesPerWorkspace: number;
  averageTradesPerActiveChallenge: number;
  mostTradedSymbol: string | null;
  latestTradeTimestamp: string | null;
  latestSessionTimestamp: string | null;
}

// Workspace breakdown row interface
export interface WorkspaceBreakdownRow {
  identity: Identity;
  totalRealized: number;
  personalRealized: number;
  challengeSideRealized: number;
  /** personal + firm realized − all challenge fees */
  bookAfterFees: number;
  /** Same as Challenges header: fees + personal losses on open evals */
  fundInEval: number;
  /** Same as Challenges header: net real on settled (non-eval) challenges */
  closedProfit: number;
  challengeCount: number;
  /** evaluation + funded + passed — matches Challenges "Active" */
  activeChallenges: number;
  failedChallenges: number;
  personalTradeCount: number;
  challengeTradeCount: number;
  latestActivity: string | null;
}

/**
 * Apply workspace filtering to all data arrays
 */
export function applyWorkspaceFilter(
  identityId: string | null,
  trades: LogTrade[],
  challenges: Challenge[],
  pairs: HedgePair[]
): {
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: HedgePair[];
} {
  if (!identityId) {
    // Global view - return all data
    return { trades, challenges, pairs };
  }
  
  // Filter by workspace
  const scopedTrades = trades.filter(t => t.identityId === identityId);
  const scopedChallenges = challenges.filter(c => c.identityId === identityId);
  
  // Filter pairs by prop trade membership in scoped trades
  const tradeIds = new Set(scopedTrades.map(t => t.id));
  const scopedPairs = pairs.filter(p => tradeIds.has(p.propTradeId));
  
  return {
    trades: scopedTrades,
    challenges: scopedChallenges,
    pairs: scopedPairs
  };
}

/**
 * Calculate canonical workspace metrics using the same logic as challenge detail pages
 */
export function calculateWorkspaceMetrics(
  identityId: string | null, // null = all workspaces
  trades: LogTrade[],
  challenges: Challenge[],
  pairs: HedgePair[],
  sessions: LogSession[],
  identities: Identity[] = []
): CanonicalWorkspaceMetrics {
  // Apply workspace filtering first
  const filtered = applyWorkspaceFilter(identityId, trades, challenges, pairs);
  
  // Use the SAME aggregation logic as challenge detail pages
  const sides = aggregateJournalOverviewSides(
    filtered.challenges,
    filtered.trades,
    filtered.pairs
  );
  
  // Calculate fees from filtered challenges
  const totalChallengeFees = filtered.challenges.reduce((sum, c) => sum + c.fee, 0);
  
  // Calculate gross and net
  const grossBeforeFees = sides.challengeSideRealized + 
                          sides.challengeSideUnrealized + 
                          sides.personalRealized + 
                          sides.personalUnrealized;
  const bookAfterFees = sides.challengeSideRealized + sides.personalRealized - totalChallengeFees;
  
  // Count challenges by status (live count comes from challengeListKpis below)
  const failedChallenges = filtered.challenges.filter(c => c.status === "failed").length;
  const passedChallenges = filtered.challenges.filter(c => c.status === "passed").length;
  const fundedChallenges = filtered.challenges.filter(c => c.status === "funded").length;
  const paidOutChallenges = filtered.challenges.filter(c => c.status === "paid_out").length;
  
  // Count today's open sessions
  const today = localTodayYmd();
  const openSessionsToday = sessions.filter(s => s.date === today && !s.closed).length;
  
  // Calculate statistics (same scoped trades/challenges as KPIs)
  const statistics = calculateWorkspaceStatistics(filtered.trades, filtered.challenges, filtered.pairs);
  
  // Calculate workspace breakdown for all identities
  const workspaceBreakdown = calculateAllWorkspaceBreakdown(
    identityId, // Pass current scope for context
    trades, // Use full trade set for breakdown
    challenges, // Use full challenge set for breakdown
    pairs,
    identities,
    false // Don't force show all - respect scoping
  );
  
  // Get recent trades (scoped)
  const recentTrades = getRecentTrades(filtered.trades, 8);
  
  // Calculate challenge list KPIs using the same logic as challenges-index-page
  const challengeListKpis = calculateChallengeListKpis(filtered.challenges, filtered.trades, filtered.pairs);

  return {
    challengeSideRealized: sides.challengeSideRealized,
    challengeSideUnrealized: sides.challengeSideUnrealized,
    personalRealized: sides.personalRealized,
    personalUnrealized: sides.personalUnrealized,
    totalChallengeFees,
    grossBeforeFees,
    bookAfterFees,
    activeRunways: challengeListKpis.live,
    failedChallenges,
    passedChallenges,
    fundedChallenges,
    paidOutChallenges,
    openSessionsToday,
    statistics,
    workspaceBreakdown,
    recentTrades,
    challengeListKpis,
  };
}

/**
 * Apply additional filtering to challenges (search, status, date range)
 * This matches the filtering logic in challenges-index-page
 */
export function applyAdditionalChallengeFilters(
  challenges: Challenge[],
  filters: {
    searchQuery?: string;
    statusFilter?: "all" | ChallengeStatus;
    fromDate?: string;
    toDate?: string;
  }
): Challenge[] {
  let filtered = challenges;

  // Search filter
  if (filters.searchQuery && filters.searchQuery.trim() !== "") {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(query));
  }

  // Status filter
  if (filters.statusFilter && filters.statusFilter !== "all") {
    filtered = filtered.filter(c => c.status === filters.statusFilter);
  }

  // Date range filter - this would need the challengeMatchesActivityDateRange function
  // For now, we'll skip date filtering in the canonical layer and let the UI handle it

  return filtered;
}

/**
 * Calculate challenge list KPIs using the exact same logic as challenges-index-page
 */
export function calculateChallengeListKpis(
  challenges: Challenge[],
  trades: LogTrade[],
  pairs: HedgePair[]
): ChallengeListKpis {
  let live = 0;
  let phases = 0;
  let fees = 0;
  let hedgeNotional = 0;
  let fundInEval = 0;
  let netRealExclEvaluation = 0;
  let evalNetReal = 0;
  
  for (const c of challenges) {
    if (isChallengeLiveStatus(c.status)) live++;
    phases += getPairsByChallengeId(c.id, trades, pairs).length;
    fees += c.fee;
    hedgeNotional += estimatePersonalNotionalForChallenge(c.id, trades, pairs);
    const d = getChallengeDashboardMetrics(c, trades, pairs);
    if (c.status === "evaluation") {
      evalNetReal += d.netReal;
      const personalLosses = Math.abs(Math.min(d.personalRealized, 0));
      fundInEval += c.fee + personalLosses;
    } else {
      netRealExclEvaluation += d.netReal;
    }
  }
  
  const totalInvested = fees + hedgeNotional;
  
  return {
    count: challenges.length,
    live,
    phases,
    fees,
    hedgeNotional,
    totalInvested,
    fundInEval,
    netRealExclEvaluation,
    evalNetReal,
  };
}

/**
 * Calculate workspace statistics using canonical aggregation
 */
function calculateWorkspaceStatistics(
  trades: LogTrade[],
  challenges: Challenge[],
  _pairs: HedgePair[] = []
): WorkspaceStatistics {
  // Challenge fee statistics
  const totalChallengeFees = challenges.reduce((sum, c) => sum + c.fee, 0);
  const averageChallengeFee = challenges.length > 0 
    ? totalChallengeFees / challenges.length 
    : 0;
  
  // Trade statistics — effective leg P&L (matches challenge detail / KPI logic)
  const personalTrades = trades.filter(isPersonalTrade);
  const firmTrades = trades.filter(t => !isPersonalTrade(t));
  
  const closedPersonalTrades = personalTrades.filter(t => isLegClosed(t));
  const closedFirmTrades = firmTrades.filter(t => isLegClosed(t));
  const closedTradesWithPnl = trades.filter(t => isLegClosed(t));

  const averagePersonalPnl = closedPersonalTrades.length > 0 
    ? closedPersonalTrades.reduce((sum, t) => sum + effectiveLegPnl(t), 0) / closedPersonalTrades.length
    : 0;
  const averageFirmPnl = closedFirmTrades.length > 0 
    ? closedFirmTrades.reduce((sum, t) => sum + effectiveLegPnl(t), 0) / closedFirmTrades.length
    : 0;
  const averageTradeOverall = closedTradesWithPnl.length > 0 
    ? closedTradesWithPnl.reduce((sum, t) => sum + effectiveLegPnl(t), 0) / closedTradesWithPnl.length
    : 0;
  
  // Win rate and trade counts (closed legs only for win rate)
  const positiveTradeCount = closedTradesWithPnl.filter(t => effectiveLegPnl(t) > 0).length;
  const negativeTradeCount = closedTradesWithPnl.filter(t => effectiveLegPnl(t) < 0).length;
  const flatTradeCount = closedTradesWithPnl.filter(t => effectiveLegPnl(t) === 0).length;
  const winRate = closedTradesWithPnl.length > 0 
    ? positiveTradeCount / closedTradesWithPnl.length 
    : 0;
  
  // Workspace and challenge averages
  const uniqueIdentityIds = new Set(trades.map(t => t.identityId));
  const averageTradesPerWorkspace = uniqueIdentityIds.size > 0 
    ? trades.length / uniqueIdentityIds.size 
    : 0;
  
  const activeChallenges = challenges.filter(c => c.status === "evaluation");
  const averageTradesPerActiveChallenge = activeChallenges.length > 0 
    ? firmTrades.length / activeChallenges.length 
    : 0;
  
  // Most traded symbol
  const symbolCounts = new Map<string, number>();
  trades.forEach(t => {
    const count = symbolCounts.get(t.symbol) ?? 0;
    symbolCounts.set(t.symbol, count + 1);
  });
  
  let mostTradedSymbol: string | null = null;
  let maxCount = 0;
  for (const [symbol, count] of symbolCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostTradedSymbol = symbol;
    }
  }
  
  // Latest timestamps
  const latestTrade = trades.reduce((latest, t) => {
    if (!latest) return t;
    return new Date(t.updatedAt) > new Date(latest.updatedAt) ? t : latest;
  }, null as LogTrade | null);
  
  const latestTradeTimestamp = latestTrade?.updatedAt ?? null;
  
  // For sessions, we don't have them in this function, so return null
  const latestSessionTimestamp: string | null = null;
  
  return {
    averageChallengeFee,
    totalChallengeFees,
    averagePersonalPnl,
    averageFirmPnl,
    averageTradeOverall,
    winRate,
    positiveTradeCount,
    negativeTradeCount,
    flatTradeCount,
    averageTradesPerWorkspace,
    averageTradesPerActiveChallenge,
    mostTradedSymbol,
    latestTradeTimestamp,
    latestSessionTimestamp,
  };
}

/**
 * Calculate workspace breakdown using canonical aggregation for each workspace
 * @param currentScopeId - null for Overview page (show all), specific ID for scoped views
 * @param forceShowAll - if true, ignore currentScopeId and always show all workspaces
 */
function calculateAllWorkspaceBreakdown(
  currentScopeId: string | null,
  allTrades: LogTrade[],
  allChallenges: Challenge[],
  allPairs: HedgePair[],
  allIdentities: Identity[] = [],
  forceShowAll: boolean = false
): WorkspaceBreakdownRow[] {
  // Get all unique identities from data and provided identities list
  const identityIds = new Set([
    ...allTrades.map(t => t.identityId),
    ...allChallenges.map(c => c.identityId),
    ...allIdentities.map(i => i.id)
  ]);
  
  const identities: Identity[] = Array.from(identityIds).map(id => {
    // Use actual identity data if available, otherwise create a placeholder
    const actualIdentity = allIdentities.find(i => i.id === id);
    if (actualIdentity) {
      return actualIdentity;
    }
    
    // Fallback for missing identity data
    const trade = allTrades.find(t => t.identityId === id);
    const challenge = allChallenges.find(c => c.identityId === id);
    
    return {
      id,
      name: `Workspace ${id.slice(0, 8)}...`,
      note: "",
      createdAt: trade?.createdAt || challenge?.createdAt || new Date().toISOString(),
      updatedAt: trade?.updatedAt || challenge?.updatedAt || new Date().toISOString(),
    };
  });
  
  return identities
    .map(identity => {
    // Calculate metrics for this specific workspace using canonical logic
    const workspaceFiltered = applyWorkspaceFilter(identity.id, allTrades, allChallenges, allPairs);
    const sides = aggregateJournalOverviewSides(
      workspaceFiltered.challenges,
      workspaceFiltered.trades,
      workspaceFiltered.pairs
    );
    
    const personalRealized = sides.personalRealized;
    const challengeSideRealized = sides.challengeSideRealized;
    const totalRealized = personalRealized + challengeSideRealized;
    const workspaceFees = workspaceFiltered.challenges.reduce((sum, c) => sum + c.fee, 0);
    const bookAfterFees = totalRealized - workspaceFees;
    const listKpis = calculateChallengeListKpis(
      workspaceFiltered.challenges,
      workspaceFiltered.trades,
      workspaceFiltered.pairs
    );
    
    // Count trades by type
    const personalTradeCount = workspaceFiltered.trades.filter(isPersonalTrade).length;
    const challengeTradeCount = workspaceFiltered.trades.filter(t => !isPersonalTrade(t)).length;
    
    // Count challenges by status
    const challengeCount = workspaceFiltered.challenges.length;
    const activeChallenges = listKpis.live;
    const failedChallenges = workspaceFiltered.challenges.filter(c => c.status === "failed").length;
    
    // Find latest activity
    const latestTrade = workspaceFiltered.trades.reduce((latest, t) => {
      if (!latest) return t;
      return new Date(t.updatedAt) > new Date(latest.updatedAt) ? t : latest;
    }, null as LogTrade | null);
    
    const latestChallenge = workspaceFiltered.challenges.reduce((latest, c) => {
      if (!latest) return c;
      return new Date(c.updatedAt) > new Date(latest.updatedAt) ? c : latest;
    }, null as Challenge | null);
    
    let latestActivity: string | null = null;
    if (latestTrade && latestChallenge) {
      latestActivity = new Date(latestTrade.updatedAt) > new Date(latestChallenge.updatedAt) 
        ? latestTrade.updatedAt
        : latestChallenge.updatedAt;
    } else if (latestTrade) {
      latestActivity = latestTrade.updatedAt;
    } else if (latestChallenge) {
      latestActivity = latestChallenge.updatedAt;
    }
    
    return {
      identity,
      totalRealized,
      personalRealized,
      challengeSideRealized,
      bookAfterFees,
      fundInEval: listKpis.fundInEval,
      closedProfit: listKpis.netRealExclEvaluation,
      challengeCount,
      activeChallenges,
      failedChallenges,
      personalTradeCount,
      challengeTradeCount,
      latestActivity,
    };
  })
    .filter((row) => forceShowAll || !currentScopeId || row.identity.id === currentScopeId)
    .sort((a, b) => a.identity.name.localeCompare(b.identity.name));
}

/**
 * Get recent trades sorted by updatedAt
 */
function getRecentTrades(trades: LogTrade[], limit: number = 8): LogTrade[] {
  return [...trades]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * Calculate workspace metrics specifically for Overview page - always shows all workspaces
 */
export function calculateOverviewMetrics(
  trades: LogTrade[],
  challenges: Challenge[],
  pairs: HedgePair[],
  sessions: LogSession[],
  identities: Identity[] = []
): CanonicalWorkspaceMetrics {
  const metrics = calculateWorkspaceMetrics(null, trades, challenges, pairs, sessions, identities);
  
  // Override workspaceBreakdown to always show all workspaces
  const allWorkspacesBreakdown = calculateAllWorkspaceBreakdown(
    null,
    trades,
    challenges,
    pairs,
    identities,
    true // Force show all workspaces
  );
  
  return {
    ...metrics,
    workspaceBreakdown: allWorkspacesBreakdown,
  };
}

/**
 * Aggregate workspace breakdown rows into totals for footer and validation
 */
export function aggregateWorkspaceBreakdownTotals(rows: WorkspaceBreakdownRow[]): {
  totalPersonalRealized: number;
  totalChallengeSideRealized: number;
  totalBookAfterFees: number;
  totalFundInEval: number;
  totalClosedProfit: number;
  totalChallengeCount: number;
  totalActiveChallenges: number;
  totalFailedChallenges: number;
  totalPersonalTrades: number;
  totalChallengeTrades: number;
} {
  return rows.reduce((acc, row) => ({
    totalPersonalRealized: acc.totalPersonalRealized + row.personalRealized,
    totalChallengeSideRealized: acc.totalChallengeSideRealized + row.challengeSideRealized,
    totalBookAfterFees: acc.totalBookAfterFees + row.bookAfterFees,
    totalFundInEval: acc.totalFundInEval + row.fundInEval,
    totalClosedProfit: acc.totalClosedProfit + row.closedProfit,
    totalChallengeCount: acc.totalChallengeCount + row.challengeCount,
    totalActiveChallenges: acc.totalActiveChallenges + row.activeChallenges,
    totalFailedChallenges: acc.totalFailedChallenges + row.failedChallenges,
    totalPersonalTrades: acc.totalPersonalTrades + row.personalTradeCount,
    totalChallengeTrades: acc.totalChallengeTrades + row.challengeTradeCount,
  }), {
    totalPersonalRealized: 0,
    totalChallengeSideRealized: 0,
    totalBookAfterFees: 0,
    totalFundInEval: 0,
    totalClosedProfit: 0,
    totalChallengeCount: 0,
    totalActiveChallenges: 0,
    totalFailedChallenges: 0,
    totalPersonalTrades: 0,
    totalChallengeTrades: 0,
  });
}

/**
 * Debug helper: Get challenge-by-challenge breakdown for validation
 */
export function getDebugChallengeBreakdown(
  trades: LogTrade[],
  challenges: Challenge[],
  pairs: HedgePair[]
): Array<{
  id: string;
  name: string;
  status: string;
  fee: number;
  rawPropSum: number;
  rawPersonalSum: number;
  pairedCount: number;
  canonicalMetrics: ReturnType<typeof getChallengeDashboardMetrics>;
  netAfterFee: number;
}> {
  return challenges.map(c => {
    // Raw trade sums (old method)
    const propTrades = trades.filter(t => t.challengeId === c.id);
    const rawPropSum = propTrades.reduce((sum, t) => sum + (t.directPnl ?? 0), 0);
    
    const personalTrades = trades.filter(t => t.challengeId === null && t.identityId === c.identityId);
    const rawPersonalSum = personalTrades.reduce((sum, t) => sum + (t.directPnl ?? 0), 0);
    
    // Paired records count
    const challengePairs = pairs.filter(p => {
      const propTrade = trades.find(t => t.id === p.propTradeId);
      return propTrade?.challengeId === c.id;
    });
    const pairedCount = challengePairs.length;
    
    // Canonical metrics (new method)
    const canonicalMetrics = getChallengeDashboardMetrics(c, trades, pairs);
    const netAfterFee = canonicalMetrics.combinedRealized - c.fee;
    
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      fee: c.fee,
      rawPropSum,
      rawPersonalSum,
      pairedCount,
      canonicalMetrics,
      netAfterFee,
    };
  });
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format large numbers compactly
 */
export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toFixed(0);
}