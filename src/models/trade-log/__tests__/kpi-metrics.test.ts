import { 
  getChallengeCoreKpis, 
  getCoreKpiHelperText,
  DEFAULT_HEDGE_BUDGET,
  DEFAULT_EXPECTED_PAYOUT
} from "../kpi-metrics";
import type { Challenge, LogTrade, HedgePair } from "../types";

// Mock data for testing
const createMockChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: "test-challenge-1",
  identityId: "test-identity-1",
  name: "Test Challenge",
  fee: 100,
  balance: 50000,
  currentProfitTarget: 3000,
  maxDrawdown: 2000,
  dailyLossCap: 500,
  status: "evaluation",
  note: "",
  payoutAmount: null,
  payoutAt: null,
  disbursementAt: null,
  ledgerPhases: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides
});

const createMockTrade = (overrides: Partial<LogTrade> = {}): LogTrade => ({
  id: "test-trade-1",
  identityId: "test-identity-1",
  challengeId: "test-challenge-1",
  sessionId: null,
  symbol: "ES",
  direction: "long",
  size: 1,
  entryPrice: 4500,
  exitPrice: 4550,
  directPnl: null,
  currentPrice: null,
  stopLoss: null,
  takeProfit: null,
  fees: 5,
  notes: "",
  screenshot: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides
});

const createMockPair = (overrides: Partial<HedgePair> = {}): HedgePair => ({
  id: "test-pair-1",
  phaseNumber: 1,
  propTradeId: "test-trade-1",
  personalTradeId: "test-trade-2",
  combinedPnl: 0,
  status: "open",
  manuallySetStatus: false,
  planId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides
});

describe("Core KPI Metrics Calculator", () => {
  describe("getChallengeCoreKpis", () => {
    it("calculates core KPIs for active evaluation with hedge losses", () => {
      const challenge = createMockChallenge({
        status: "evaluation",
        fee: 200
      });
      
      // Personal hedge trades with losses (source of truth for cash calculations)
      const personalTrade1 = createMockTrade({
        id: "personal-1",
        challengeId: null,
        directPnl: -400, // $400 hedge loss
      });
      
      const personalTrade2 = createMockTrade({
        id: "personal-2", 
        challengeId: null,
        directPnl: -300, // $300 hedge loss
      });
      
      // Prop trade (for pair linkage)
      const propTrade = createMockTrade({
        id: "prop-1",
        challengeId: challenge.id,
        directPnl: 1500,
      });
      
      const pair = createMockPair({
        propTradeId: propTrade.id,
        personalTradeId: personalTrade1.id,
      });
      
      const trades = [propTrade, personalTrade1, personalTrade2];
      const pairs = [pair];
      
      const kpis = getChallengeCoreKpis(challenge, trades, pairs);
      
      expect(kpis.isHedgeCycleComplete).toBe(false);
      expect(kpis.showForwardKpis).toBe(true);

      // Total Invested = fee + abs(min(personalRealized, 0))
      // = 200 + abs(min(-700, 0)) = 200 + 700 = 900
      expect(kpis.totalInvested).toBe(900);
      
      // Left to Hedge = DEFAULT_HEDGE_BUDGET - totalInvested
      // = 1500 - 900 = 600
      expect(kpis.leftToHedge).toBe(600);
      
      // Phases Done = number of pairs
      expect(kpis.phasesDone).toBe(1);
      
      // If We Pass Today = DEFAULT_EXPECTED_PAYOUT - totalInvested
      // = 1800 - 900 = 900
      expect(kpis.ifWePassToday).toBe(900);
      
      // Personal Net = personalRealized - fee = -700 - 200 = -900
      expect(kpis.personalNet).toBe(-900);
      
      expect(kpis.warnings.budgetExceeded).toBe(false);
      expect(kpis.warnings.negativeOutcome).toBe(false);
    });

    it("marks hedge cycle complete when personal side has realized gain", () => {
      const challenge = createMockChallenge({
        status: "evaluation",
        fee: 100
      });
      
      const personalTrade = createMockTrade({
        id: "personal-1",
        challengeId: null,
        directPnl: 300,
      });
      
      const kpis = getChallengeCoreKpis(challenge, [personalTrade], []);
      
      expect(kpis.isHedgeCycleComplete).toBe(true);
      expect(kpis.showForwardKpis).toBe(false);
      expect(kpis.totalInvested).toBe(100);
      expect(kpis.personalNet).toBe(200);
      expect(kpis.warnings.budgetExceeded).toBe(false);
      expect(kpis.warnings.negativeOutcome).toBe(false);
    });

    it("handles budget exceeded scenario", () => {
      const challenge = createMockChallenge({
        fee: 500
      });
      
      const personalTrade = createMockTrade({
        challengeId: null,
        directPnl: -1200, // Large hedge loss
      });
      
      const kpis = getChallengeCoreKpis(challenge, [personalTrade], []);
      
      // Total Invested = 500 + 1200 = 1700 (exceeds DEFAULT_HEDGE_BUDGET of 1500)
      expect(kpis.totalInvested).toBe(1700);
      
      // Left to Hedge = 1500 - 1700 = -200 (negative)
      expect(kpis.leftToHedge).toBe(-200);
      
      // If We Pass Today = 1800 - 1700 = 100 (still positive)
      expect(kpis.ifWePassToday).toBe(100);
      
      expect(kpis.warnings.budgetExceeded).toBe(true);
      expect(kpis.warnings.negativeOutcome).toBe(false);
    });

    it("handles negative outcome scenario", () => {
      const challenge = createMockChallenge({
        fee: 300
      });
      
      const personalTrade = createMockTrade({
        challengeId: null,
        directPnl: -1800, // Very large hedge loss
      });
      
      const kpis = getChallengeCoreKpis(challenge, [personalTrade], []);
      
      // Total Invested = 300 + 1800 = 2100
      expect(kpis.totalInvested).toBe(2100);
      
      // If We Pass Today = 1800 - 2100 = -300 (negative outcome)
      expect(kpis.ifWePassToday).toBe(-300);
      
      expect(kpis.warnings.budgetExceeded).toBe(true);
      expect(kpis.warnings.negativeOutcome).toBe(true);
    });

    it("handles paid_out challenge with actual payout", () => {
      const challenge = createMockChallenge({
        status: "paid_out",
        payoutAmount: 2500,
        fee: 200
      });
      
      const personalTrade = createMockTrade({
        challengeId: null,
        directPnl: -800,
      });
      
      const kpis = getChallengeCoreKpis(challenge, [personalTrade], []);
      
      // Should use actual payoutAmount instead of default
      expect(kpis.expectedPayout).toBe(2500);
      
      // If We Pass Today = 2500 - (200 + 800) = 1500
      expect(kpis.ifWePassToday).toBe(1500);
    });

    it("handles challenge with no phases yet", () => {
      const challenge = createMockChallenge({
        fee: 150
      });
      
      const kpis = getChallengeCoreKpis(challenge, [], []);
      
      // No trades yet
      expect(kpis.totalInvested).toBe(150); // Just the fee
      expect(kpis.leftToHedge).toBe(1350); // 1500 - 150
      expect(kpis.phasesDone).toBe(0);
      expect(kpis.ifWePassToday).toBe(1650); // 1800 - 150
      expect(kpis.personalNet).toBe(-150); // 0 - 150
      expect(kpis.openLegs).toBe(0);
      
      expect(kpis.warnings.budgetExceeded).toBe(false);
      expect(kpis.warnings.negativeOutcome).toBe(false);
    });
  });

  describe("getCoreKpiHelperText", () => {
    it("returns practical helper text for core KPIs", () => {
      expect(getCoreKpiHelperText("totalInvested")).toBe("fee + hedge losses");
      expect(getCoreKpiHelperText("leftToHedge")).toBe("budget remaining");
      expect(getCoreKpiHelperText("phasesDone")).toBe("phases completed");
      expect(getCoreKpiHelperText("ifWePassToday")).toBe("net if passed now");
      expect(getCoreKpiHelperText("personalNet")).toBe("real cash result");
      expect(getCoreKpiHelperText("openLegs")).toBe("active positions");
    });

    it("returns settled helper text when hedge cycle is complete", () => {
      expect(getCoreKpiHelperText("totalInvested", { isHedgeCycleComplete: true })).toBe(
        "fee only — hedge paid out"
      );
      expect(getCoreKpiHelperText("personalNet", { isHedgeCycleComplete: true })).toBe(
        "hedge won — eval failed"
      );
      expect(getCoreKpiHelperText("phasesDone", { isHedgeCycleComplete: true })).toBe(
        "rounds before fail"
      );
    });
  });
});

// Manual verification function (can be called from browser console)
export function verifyCoreKpiCalculations() {
  console.log("🧪 Testing Core KPI calculations...");
  
  const challenge = createMockChallenge({
    status: "evaluation",
    fee: 200
  });
  
  const personalTrade = createMockTrade({
    id: "personal-1", 
    challengeId: null,
    directPnl: -800 // $800 hedge cost
  });
  
  const propTrade = createMockTrade({
    id: "prop-1",
    challengeId: challenge.id,
    directPnl: 1500
  });
  
  const pair = createMockPair({
    propTradeId: propTrade.id,
    personalTradeId: personalTrade.id
  });
  
  const kpis = getChallengeCoreKpis(challenge, [propTrade, personalTrade], [pair]);
  
  console.log("📊 Core KPI Results:", {
    "Total Invested": `$${kpis.totalInvested}`,
    "Left to Hedge": `$${kpis.leftToHedge}`,
    "Phases Done": kpis.phasesDone,
    "If We Pass Today": `$${kpis.ifWePassToday}`,
    "Personal Net": `$${kpis.personalNet}`,
    "Open Legs": kpis.openLegs,
    "Budget Exceeded": kpis.warnings.budgetExceeded,
    "Negative Outcome": kpis.warnings.negativeOutcome
  });
  
  return kpis;
}