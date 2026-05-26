import { calculateWorkspaceMetrics } from "../workspace-metrics";
import { getChallengeDashboardMetrics } from "../challenges";
import type { Challenge, LogTrade, HedgePair, LogSession, Identity } from "../types";

/**
 * Test suite for Challenges Overview metrics accuracy
 * Validates that displayed numbers are correct and consistent
 */
describe("Challenges Overview Metrics Validation", () => {
  // Test data setup
  const mockIdentity: Identity = {
    id: "identity-1",
    name: "Test Workspace",
    note: "",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z"
  };

  const mockChallenges: Challenge[] = [
    {
      id: "challenge-1",
      identityId: "identity-1",
      name: "Evaluation 1",
      status: "evaluation",
      fee: 100,
      balance: 10000,
      currentProfitTarget: 1000,
      maxDrawdown: 500,
      dailyLossCap: 200,
      payoutAmount: 0,
      payoutAt: null,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    },
    {
      id: "challenge-2", 
      identityId: "identity-1",
      name: "Failed Challenge",
      status: "failed",
      fee: 80,
      balance: 10000,
      currentProfitTarget: 1000,
      maxDrawdown: 500,
      dailyLossCap: 200,
      payoutAmount: 0,
      payoutAt: null,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    }
  ];

  const mockTrades: LogTrade[] = [
    // Evaluation challenge trades
    {
      id: "trade-1",
      identityId: "identity-1",
      challengeId: "challenge-1",
      symbol: "NQ",
      side: "long",
      size: 1,
      entryPrice: 15000,
      exitPrice: 15100,
      directPnl: 2000, // Prop trade with profit
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    },
    {
      id: "trade-2",
      identityId: "identity-1", 
      challengeId: null, // Personal hedge trade
      symbol: "NQ",
      side: "short",
      size: 1,
      entryPrice: 15100,
      exitPrice: 15000,
      directPnl: -1800, // Personal hedge loss (hedging the prop profit)
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    },
    // Failed challenge trades
    {
      id: "trade-3",
      identityId: "identity-1",
      challengeId: "challenge-2", 
      symbol: "ES",
      side: "long",
      size: 2,
      entryPrice: 4000,
      exitPrice: 3950,
      directPnl: -2500, // Prop loss
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    },
    {
      id: "trade-4",
      identityId: "identity-1",
      challengeId: null, // Personal hedge trade
      symbol: "ES", 
      side: "short",
      size: 2,
      entryPrice: 3950,
      exitPrice: 4000,
      directPnl: 2400, // Personal hedge profit
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    }
  ];

  const mockPairs: HedgePair[] = [
    {
      id: "pair-1",
      propTradeId: "trade-1",
      personalTradeId: "trade-2", 
      combinedPnl: 200, // Net result of the hedge
      status: "closed_profit",
      phaseNumber: 1,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    },
    {
      id: "pair-2", 
      propTradeId: "trade-3",
      personalTradeId: "trade-4",
      combinedPnl: -100, // Net loss
      status: "closed_loss",
      phaseNumber: 1,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z"
    }
  ];

  const mockSessions: LogSession[] = [];

  describe("Individual Challenge Calculations", () => {
    it("should calculate evaluation challenge metrics correctly", () => {
      const evaluation = mockChallenges[0];
      const metrics = getChallengeDashboardMetrics(evaluation, mockTrades, mockPairs);
      
      // Prop side should show challenge progress
      expect(metrics.propRealized).toBe(2000); // trade-1 profit
      
      // Personal side should show hedge result (linked via pairs)
      expect(metrics.personalRealized).toBe(-1800); // trade-2 loss
      
      // Net result = personal result - challenge fee
      expect(metrics.netReal).toBe(-1800 - 100); // -1900
      expect(metrics.netReal).toBe(-1900);
    });

    it("should calculate failed challenge metrics correctly", () => {
      const failed = mockChallenges[1];
      const metrics = getChallengeDashboardMetrics(failed, mockTrades, mockPairs);
      
      // Prop side should show the loss
      expect(metrics.propRealized).toBe(-2500); // trade-3 loss
      
      // Personal side should show hedge result 
      expect(metrics.personalRealized).toBe(2400); // trade-4 profit
      
      // Net result = personal result - challenge fee
      expect(metrics.netReal).toBe(2400 - 80); // 2320
      expect(metrics.netReal).toBe(2320);
    });
  });

  describe("Workspace-Level Aggregations", () => {
    it("should calculate workspace metrics correctly", () => {
      const workspaceMetrics = calculateWorkspaceMetrics(
        "identity-1",
        mockTrades,
        mockChallenges, 
        mockPairs,
        mockSessions,
        [mockIdentity]
      );

      // Personal realized = sum of all personal hedge results
      expect(workspaceMetrics.personalRealized).toBe(-1800 + 2400); // 600
      expect(workspaceMetrics.personalRealized).toBe(600);

      // Challenge side realized = sum of all prop results
      expect(workspaceMetrics.challengeSideRealized).toBe(2000 + -2500); // -500
      expect(workspaceMetrics.challengeSideRealized).toBe(-500);

      // Total fees = sum of all challenge fees
      expect(workspaceMetrics.totalChallengeFees).toBe(100 + 80); // 180
      expect(workspaceMetrics.totalChallengeFees).toBe(180);

      // Book after fees = (personal + prop) - fees
      expect(workspaceMetrics.bookAfterFees).toBe(600 + -500 - 180); // -80
      expect(workspaceMetrics.bookAfterFees).toBe(-80);
    });

    it("should calculate challenge list KPIs correctly", () => {
      const workspaceMetrics = calculateWorkspaceMetrics(
        "identity-1",
        mockTrades,
        mockChallenges,
        mockPairs,
        mockSessions,
        [mockIdentity]
      );

      const { challengeListKpis } = workspaceMetrics;

      // Count metrics
      expect(challengeListKpis.count).toBe(2); // 2 challenges total
      expect(challengeListKpis.phases).toBe(2); // 2 hedge pairs
      expect(challengeListKpis.live).toBe(1); // 1 evaluation (active)

      // Fee metrics
      expect(challengeListKpis.fees).toBe(180); // 100 + 80

      // Net real calculations
      // Evaluation: netReal = -1800 - 100 = -1900
      // Failed: netReal = 2400 - 80 = 2320
      
      expect(challengeListKpis.evalNetReal).toBe(-1900); // Evaluation only
      expect(challengeListKpis.netRealExclEvaluation).toBe(2320); // Failed only
      // Eval fund = fee (100) + personal losses (1800) = 1900
      expect(challengeListKpis.fundInEval).toBe(1900);
    });
  });

  describe("Metric Naming Dictionary", () => {
    const expectedMetrics = {
      // Primary KPIs (Level 1)
      netResult: "Final result after all challenge fees",
      closedChallengesResult: "Net result from settled challenges only",
      activeEvaluations: "Number of currently running evaluation challenges", 
      totalChallenges: "Total number of challenges created",
      
      // Supporting Stats (Level 2)
      challengeFeesTotal: "Total challenge fees paid",
      totalPhases: "Total number of trading phases/hedge pairs",
      openEvaluationsResult: "Net result from open evaluations",
      failedChallenges: "Number of failed challenges",
      
      // Row-level metrics
      hedgeResult: "Result from personal hedge trading",
      challengeProgress: "Prop account progress toward target",
      challengeFee: "Fee paid for this challenge"
    };

    it("should have clear, jargon-free metric definitions", () => {
      // Verify each metric has a clear definition
      Object.entries(expectedMetrics).forEach(([key, definition]) => {
        expect(definition).toBeTruthy();
        expect(definition.length).toBeGreaterThan(10);
        
        // Should not contain confusing jargon
        expect(definition.toLowerCase()).not.toContain("legs");
        expect(definition.toLowerCase()).not.toContain("book");
        expect(definition.toLowerCase()).not.toContain("runway"); 
        expect(definition.toLowerCase()).not.toContain("benefit");
        expect(definition.toLowerCase()).not.toContain("real"); // Except in "real result"
      });
    });
  });

  describe("Calculation Consistency", () => {
    it("should have consistent totals between overview and individual challenges", () => {
      const workspaceMetrics = calculateWorkspaceMetrics(
        "identity-1",
        mockTrades,
        mockChallenges,
        mockPairs,
        mockSessions,
        [mockIdentity]
      );

      // Sum individual challenge net results
      let totalNetFromRows = 0;
      mockChallenges.forEach(challenge => {
        const challengeMetrics = getChallengeDashboardMetrics(challenge, mockTrades, mockPairs);
        totalNetFromRows += challengeMetrics.netReal;
      });

      // Should match the overview calculation  
      const overviewNet = workspaceMetrics.personalRealized - workspaceMetrics.totalChallengeFees;
      expect(totalNetFromRows).toBe(overviewNet);
      expect(totalNetFromRows).toBe(-1900 + 2320); // 420
      expect(totalNetFromRows).toBe(420);
    });

    it("should split evaluation vs non-evaluation correctly", () => {
      const workspaceMetrics = calculateWorkspaceMetrics(
        "identity-1", 
        mockTrades,
        mockChallenges,
        mockPairs,
        mockSessions,
        [mockIdentity]
      );

      const { challengeListKpis } = workspaceMetrics;
      
      // Evaluation + non-evaluation should equal total net
      const totalSplit = challengeListKpis.evalNetReal + challengeListKpis.netRealExclEvaluation;
      const totalDirect = workspaceMetrics.personalRealized - workspaceMetrics.totalChallengeFees;
      
      expect(totalSplit).toBe(totalDirect);
      expect(totalSplit).toBe(-1900 + 2320); // 420
      expect(totalSplit).toBe(420);
    });
  });
});