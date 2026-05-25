import { 
  getChallengeDashboardMetrics,
  countOpenLegsForChallenge,
  getPairsByChallengeId
} from "./challenges";
import type { Challenge, LogTrade, HedgePair } from "./types";

// Core constants for hedge budget and expected payouts
export const DEFAULT_HEDGE_BUDGET = 1500;
export const DEFAULT_EXPECTED_PAYOUT = 1800;

/**
 * Simplified core KPI metrics focused on reliable cash-side data only.
 * Built for daily trading decisions, not comprehensive dashboard display.
 */
export interface ChallengeCoreKpis {
  /** Real money spent so far: fee + cumulative personal hedge losses */
  totalInvested: number;
  /** Remaining hedge budget before strategy becomes unprofitable */
  leftToHedge: number;
  /** Number of hedge pairs completed for this challenge */
  phasesDone: number;
  /** Net result if challenge passes today */
  ifWePassToday: number;
  
  /** Raw personal P&L minus fee (real cash result) */
  personalNet: number;
  /** Count of open prop + personal legs */
  openLegs: number;
  
  /** Personal side captured profit — hedge cycle done, eval effectively failed */
  isHedgeCycleComplete: boolean;
  /** Show pass/hedge budget KPIs (hidden once personal gain is realized) */
  showForwardKpis: boolean;
  
  hedgeBudget: number;
  expectedPayout: number;
  warnings: {
    budgetExceeded: boolean;
    negativeOutcome: boolean;
  };
}

/**
 * Calculate expected payout using simple, reliable logic.
 * Uses actual payoutAmount only for paid_out status, otherwise uses default.
 */
function calculateExpectedPayout(challenge: Challenge): number {
  // Only use actual payout for completed challenges with real payout recorded
  if (challenge.status === "paid_out" && 
      challenge.payoutAmount != null && 
      challenge.payoutAmount > 0) {
    return challenge.payoutAmount;
  }
  
  // Use default for all other cases - simple and predictable
  return DEFAULT_EXPECTED_PAYOUT;
}

/**
 * Get core KPI metrics focused only on reliable cash-side data.
 * Simple, trustworthy calculations for daily trading decisions.
 */
export function getChallengeCoreKpis(
  challenge: Challenge,
  trades: LogTrade[],
  pairs: HedgePair[]
): ChallengeCoreKpis {
  // Get personal P&L (source of truth for cash calculations)
  const dashboard = getChallengeDashboardMetrics(challenge, trades, pairs);
  const personalRealized = dashboard.personalRealized;
  
  // Core KPI calculations
  const hedgeBudget = DEFAULT_HEDGE_BUDGET;
  const expectedPayout = calculateExpectedPayout(challenge);
  
  // 1. Total Invested = fee + cumulative personal hedge losses only
  const personalLosses = Math.abs(Math.min(personalRealized, 0));
  const totalInvested = challenge.fee + personalLosses;
  
  // 2. Left to Hedge = hedgeBudget - totalInvested
  const leftToHedge = hedgeBudget - totalInvested;
  
  // 3. Phases Done = number of hedge pairs for this challenge
  const challengePairs = getPairsByChallengeId(challenge.id, trades, pairs);
  const phasesDone = challengePairs.length;
  
  // 4. If We Pass Today = expectedPayout - totalInvested
  const ifWePassToday = expectedPayout - totalInvested;
  
  // Secondary KPIs (reliable when available)
  const personalNet = personalRealized - challenge.fee;
  const openLegs = countOpenLegsForChallenge(challenge.id, trades, pairs);

  // Personal gain = hedge captured the prop loss; eval path is closed.
  const isHedgeCycleComplete = personalRealized > 0.005;
  const showForwardKpis = !isHedgeCycleComplete;
  
  // Simple warnings (only meaningful while still pursuing a pass)
  const warnings = {
    budgetExceeded: showForwardKpis && leftToHedge < 0,
    negativeOutcome: showForwardKpis && ifWePassToday < 0,
  };
  
  return {
    totalInvested,
    leftToHedge,
    phasesDone,
    ifWePassToday,
    personalNet,
    openLegs,
    isHedgeCycleComplete,
    showForwardKpis,
    hedgeBudget,
    expectedPayout,
    warnings,
  };
}

/**
 * Get practical helper text for core KPIs.
 * Short, clear explanations focused on trading decisions.
 */
export function getCoreKpiHelperText(
  kpiType: keyof ChallengeCoreKpis,
  options?: { isHedgeCycleComplete?: boolean }
): string {
  const settled = options?.isHedgeCycleComplete ?? false;

  switch (kpiType) {
    case "totalInvested":
      return settled ? "fee only — hedge paid out" : "fee + hedge losses";
    case "leftToHedge":
      return "budget remaining";
    case "phasesDone":
      return settled ? "rounds before fail" : "phases completed";
    case "ifWePassToday":
      return "net if passed now";
    case "personalNet":
      return settled ? "hedge won — eval failed" : "real cash result";
    case "openLegs":
      return "active positions";
    default:
      return "";
  }
}