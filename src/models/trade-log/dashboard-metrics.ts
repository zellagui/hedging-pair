import { formatMoney, localTodayYmd } from "./format";
import { isPersonalTrade } from "./pnl";
import type {
  Challenge,
  Identity,
  LogSession,
  LogTrade,
} from "./types";

// Global dashboard KPI metrics
export interface GlobalDashboardKpis {
  bookAfterFees: number;
  personalLegsTotal: number;
  firmSideTotal: number;
  activeRunways: number;
  failedChallenges: number;
  openSessionsToday: number;
  
  // Helper breakdown
  grossBeforeFees: number;
  totalFees: number;
}

// Workspace breakdown row
export interface WorkspaceBreakdownRow {
  identity: Identity;
  totalRealized: number;
  bookAfterFees: number;
  challengeCount: number;
  activeChallenges: number;
  failedChallenges: number;
  personalTradeCount: number;
  challengeTradeCount: number;
  latestActivity: string | null;
}

// Dashboard statistics
export interface DashboardStatistics {
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

/**
 * Calculate global dashboard KPIs from all data
 */
export function calculateGlobalDashboardKpis(
  trades: LogTrade[],
  challenges: Challenge[],
  sessions: LogSession[]
): GlobalDashboardKpis {
  const today = localTodayYmd();
  
  // Calculate P&L totals
  const personalTrades = trades.filter(isPersonalTrade);
  const firmTrades = trades.filter(t => !isPersonalTrade(t));
  
  const personalLegsTotal = personalTrades.reduce((sum, t) => {
    return sum + (t.directPnl ?? 0);
  }, 0);
  
  const firmSideTotal = firmTrades.reduce((sum, t) => {
    return sum + (t.directPnl ?? 0);
  }, 0);
  
  const grossBeforeFees = personalLegsTotal + firmSideTotal;
  const totalFees = challenges.reduce((sum, c) => sum + c.fee, 0);
  const bookAfterFees = grossBeforeFees - totalFees;
  
  // Count challenge statuses
  const activeRunways = challenges.filter(c => c.status === "evaluation").length;
  const failedChallenges = challenges.filter(c => c.status === "failed").length;
  
  // Count today's open sessions
  const openSessionsToday = sessions.filter(s => 
    s.date === today && !s.closed
  ).length;
  
  return {
    bookAfterFees,
    personalLegsTotal,
    firmSideTotal,
    activeRunways,
    failedChallenges,
    openSessionsToday,
    grossBeforeFees,
    totalFees,
  };
}

/**
 * Calculate breakdown metrics for all workspaces
 */
export function calculateWorkspaceBreakdown(
  identities: Identity[],
  trades: LogTrade[],
  challenges: Challenge[]
): WorkspaceBreakdownRow[] {
  return identities.map(identity => {
    // Filter data for this workspace
    const workspaceTrades = trades.filter(t => t.identityId === identity.id);
    const workspaceChallenges = challenges.filter(c => c.identityId === identity.id);
    
    // Calculate P&L
    const totalRealized = workspaceTrades.reduce((sum, t) => {
      return sum + (t.directPnl ?? 0);
    }, 0);
    
    const workspaceFees = workspaceChallenges.reduce((sum, c) => sum + c.fee, 0);
    const bookAfterFees = totalRealized - workspaceFees;
    
    // Count trades by type
    const personalTradeCount = workspaceTrades.filter(isPersonalTrade).length;
    const challengeTradeCount = workspaceTrades.filter(t => !isPersonalTrade(t)).length;
    
    // Count challenges by status
    const challengeCount = workspaceChallenges.length;
    const activeChallenges = workspaceChallenges.filter(c => c.status === "evaluation").length;
    const failedChallenges = workspaceChallenges.filter(c => c.status === "failed").length;
    
    // Find latest activity
    const latestTrade = workspaceTrades.reduce((latest, t) => {
      if (!latest) return t;
      return new Date(t.updatedAt) > new Date(latest.updatedAt) ? t : latest;
    }, null as LogTrade | null);
    
    const latestChallenge = workspaceChallenges.reduce((latest, c) => {
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
      bookAfterFees,
      challengeCount,
      activeChallenges,
      failedChallenges,
      personalTradeCount,
      challengeTradeCount,
      latestActivity,
    };
  });
}

/**
 * Calculate statistical metrics for the dashboard
 */
export function calculateDashboardStatistics(
  trades: LogTrade[],
  challenges: Challenge[]
): DashboardStatistics {
  // Challenge fee statistics
  const totalChallengeFees = challenges.reduce((sum, c) => sum + c.fee, 0);
  const averageChallengeFee = challenges.length > 0 
    ? totalChallengeFees / challenges.length 
    : 0;
  
  // Trade P&L statistics
  const personalTrades = trades.filter(isPersonalTrade);
  const firmTrades = trades.filter(t => !isPersonalTrade(t));
  const tradesWithPnl = trades.filter(t => t.directPnl !== null);
  
  const personalPnlTotal = personalTrades.reduce((sum, t) => sum + (t.directPnl ?? 0), 0);
  const firmPnlTotal = firmTrades.reduce((sum, t) => sum + (t.directPnl ?? 0), 0);
  const overallPnlTotal = tradesWithPnl.reduce((sum, t) => sum + (t.directPnl ?? 0), 0);
  
  const averagePersonalPnl = personalTrades.length > 0 
    ? personalPnlTotal / personalTrades.length 
    : 0;
  const averageFirmPnl = firmTrades.length > 0 
    ? firmPnlTotal / firmTrades.length 
    : 0;
  const averageTradeOverall = tradesWithPnl.length > 0 
    ? overallPnlTotal / tradesWithPnl.length 
    : 0;
  
  // Win rate and trade counts
  const positiveTradeCount = tradesWithPnl.filter(t => (t.directPnl ?? 0) > 0).length;
  const negativeTradeCount = tradesWithPnl.filter(t => (t.directPnl ?? 0) < 0).length;
  const flatTradeCount = tradesWithPnl.filter(t => (t.directPnl ?? 0) === 0).length;
  const winRate = tradesWithPnl.length > 0 
    ? positiveTradeCount / tradesWithPnl.length 
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
 * Get recent trades for activity panel
 */
export function getRecentTrades(trades: LogTrade[], limit: number = 8): LogTrade[] {
  return [...trades]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
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
    return formatMoney(value);
  }
  return value.toFixed(0);
}