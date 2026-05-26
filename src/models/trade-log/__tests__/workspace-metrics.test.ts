import {
  applyWorkspaceFilter,
  calculateWorkspaceMetrics,
  getDebugChallengeBreakdown,
} from "../workspace-metrics";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
} from "../types";

// Mock data helpers
function createMockIdentity(id: string, name: string): Identity {
  return {
    id,
    name,
    note: "",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function createMockChallenge(
  id: string,
  identityId: string,
  status: Challenge["status"] = "evaluation",
  fee: number = 100
): Challenge {
  return {
    id,
    identityId,
    name: `Challenge ${id}`,
    fee,
    balance: 50000,
    currentProfitTarget: 5000,
    maxDrawdown: 2000,
    dailyLossCap: 1000,
    status,
    note: "",
    payoutAmount: null,
    payoutAt: null,
    disbursementAt: null,
    ledgerPhases: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function createMockTrade(
  id: string,
  identityId: string,
  challengeId: string | null,
  directPnl: number | null = null,
  exitPrice: number | null = null
): LogTrade {
  return {
    id,
    identityId,
    challengeId,
    sessionId: null,
    symbol: "EURUSD",
    direction: "long",
    size: 100000,
    entryPrice: 1.1000,
    exitPrice,
    directPnl,
    currentPrice: null,
    stopLoss: null,
    takeProfit: null,
    fees: 0,
    notes: "",
    screenshot: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function createMockPair(
  id: string,
  propTradeId: string,
  personalTradeId: string,
  combinedPnl: number,
  phaseNumber: number = 1
): HedgePair {
  return {
    id,
    phaseNumber,
    propTradeId,
    personalTradeId,
    combinedPnl,
    status: combinedPnl > 0 ? "profitable" : combinedPnl < 0 ? "loss" : "break-even",
    manuallySetStatus: false,
    planId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function createMockSession(
  id: string,
  date: string = "2024-01-01",
  closed: boolean = true
): LogSession {
  return {
    id,
    date,
    notes: "",
    closed,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

describe("Workspace Metrics", () => {
  describe("applyWorkspaceFilter", () => {
    it("should return all data when identityId is null", () => {
      const trades = [createMockTrade("t1", "w1", "c1")];
      const challenges = [createMockChallenge("c1", "w1")];
      const pairs = [createMockPair("p1", "t1", "t2")];

      const result = applyWorkspaceFilter(null, trades, challenges, pairs);

      expect(result.trades).toEqual(trades);
      expect(result.challenges).toEqual(challenges);
      expect(result.pairs).toEqual(pairs);
    });

    it("should filter data by workspace correctly", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1"),
        createMockTrade("t2", "w2", "c2"),
        createMockTrade("t3", "w1", null), // personal trade in w1
      ];
      const challenges = [
        createMockChallenge("c1", "w1"),
        createMockChallenge("c2", "w2"),
      ];
      const pairs = [
        createMockPair("p1", "t1", "t3"), // prop t1 (w1) + personal t3 (w1)
        createMockPair("p2", "t2", "t4"), // prop t2 (w2) + personal t4 (not in trades)
      ];

      const result = applyWorkspaceFilter("w1", trades, challenges, pairs);

      expect(result.trades).toHaveLength(2); // t1, t3
      expect(result.challenges).toHaveLength(1); // c1
      expect(result.pairs).toHaveLength(1); // p1 (because t1 is in scoped trades)
    });

    it("should filter pairs by prop trade membership", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1"), // prop trade in w1
        createMockTrade("t2", "w1", null), // personal trade in w1
      ];
      const challenges = [createMockChallenge("c1", "w1")];
      const pairs = [
        createMockPair("p1", "t1", "t2"), // should be included (t1 in scope)
        createMockPair("p2", "t3", "t4"), // should be excluded (t3 not in scope)
      ];

      const result = applyWorkspaceFilter("w1", trades, challenges, pairs);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0].id).toBe("p1");
    });
  });

  describe("calculateWorkspaceMetrics", () => {
    it("should handle paired records with directPnl = 0", () => {
      const identity1 = createMockIdentity("w1", "Workspace 1");
      
      const trades = [
        createMockTrade("t1", "w1", "c1", 0), // prop trade with directPnl = 0
        createMockTrade("t2", "w1", null, 0), // personal trade with directPnl = 0
      ];
      const challenges = [createMockChallenge("c1", "w1", "evaluation", 100)];
      const pairs = [
        createMockPair("p1", "t1", "t2", 500), // combinedPnl = 500
      ];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      // Should use combinedPnl from pairs, not directPnl from trades
      expect(result.challengeSideRealized).toBe(250); // Half of combinedPnl goes to challenge side
      expect(result.personalRealized).toBe(250); // Half goes to personal side
      expect(result.bookAfterFees).toBe(400); // 500 - 100 fee
    });

    it("should handle no paired records and fall back to trade directPnl", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 300), // prop trade
        createMockTrade("t2", "w1", null, 200), // personal trade
      ];
      const challenges = [createMockChallenge("c1", "w1", "evaluation", 100)];
      const pairs: HedgePair[] = []; // No pairs
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      expect(result.challengeSideRealized).toBe(300);
      expect(result.personalRealized).toBe(200);
      expect(result.bookAfterFees).toBe(400); // 300 + 200 - 100
    });

    it("should apply workspace filtering correctly", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 300), // w1 prop
        createMockTrade("t2", "w1", null, 200), // w1 personal
        createMockTrade("t3", "w2", "c2", 150), // w2 prop
      ];
      const challenges = [
        createMockChallenge("c1", "w1", "evaluation", 100),
        createMockChallenge("c2", "w2", "evaluation", 50),
      ];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      // Should only include w1 data
      expect(result.challengeSideRealized).toBe(300); // Only t1
      expect(result.personalRealized).toBe(200); // Only t2
      expect(result.totalChallengeFees).toBe(100); // Only c1 fee
      expect(result.activeRunways).toBe(1); // Only c1
    });

    it("should count challenges by status correctly", () => {
      const trades: LogTrade[] = [];
      const challenges = [
        createMockChallenge("c1", "w1", "evaluation"),
        createMockChallenge("c2", "w1", "failed"),
        createMockChallenge("c3", "w1", "passed"),
        createMockChallenge("c4", "w1", "funded"),
        createMockChallenge("c5", "w1", "paid_out"),
      ];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      expect(result.activeRunways).toBe(3); // evaluation + passed + funded (live)
      expect(result.failedChallenges).toBe(1); // failed
      expect(result.passedChallenges).toBe(1); // passed
      expect(result.fundedChallenges).toBe(1); // funded
      expect(result.paidOutChallenges).toBe(1); // paid_out
    });

    it("should count fees exactly once per challenge", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 300),
        createMockTrade("t2", "w1", "c1", 200), // Same challenge
      ];
      const challenges = [
        createMockChallenge("c1", "w1", "evaluation", 100), // Single fee
      ];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      expect(result.totalChallengeFees).toBe(100); // Fee counted once
      expect(result.bookAfterFees).toBe(400); // 300 + 200 - 100
    });

    it("should prevent double counting between paired and individual trades", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 0), // prop in pair
        createMockTrade("t2", "w1", null, 0), // personal in pair
        createMockTrade("t3", "w1", null, 150), // individual personal trade
      ];
      const challenges = [createMockChallenge("c1", "w1", "evaluation", 100)];
      const pairs = [
        createMockPair("p1", "t1", "t2", 400), // Paired trades
      ];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      // Should include:
      // - combinedPnl from pair (400)
      // - individual personal trade (150)
      // - but NOT double count t1 and t2
      expect(result.challengeSideRealized).toBeCloseTo(200, 1); // Half of pair
      expect(result.personalRealized).toBeCloseTo(350, 1); // Half of pair + individual
      expect(result.bookAfterFees).toBeCloseTo(450, 1); // Total - fee
    });

    it("should handle global view when identityId is null", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 300),
        createMockTrade("t2", "w2", "c2", 200),
      ];
      const challenges = [
        createMockChallenge("c1", "w1", "evaluation", 100),
        createMockChallenge("c2", "w2", "failed", 50),
      ];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics(null, trades, challenges, pairs, sessions);

      expect(result.challengeSideRealized).toBe(500); // Both trades
      expect(result.totalChallengeFees).toBe(150); // Both fees
      expect(result.activeRunways).toBe(1); // Only evaluation
      expect(result.failedChallenges).toBe(1); // Only failed
    });

    it("should handle empty data gracefully", () => {
      const result = calculateWorkspaceMetrics("w1", [], [], [], []);

      expect(result.challengeSideRealized).toBe(0);
      expect(result.personalRealized).toBe(0);
      expect(result.bookAfterFees).toBe(0);
      expect(result.totalChallengeFees).toBe(0);
      expect(result.activeRunways).toBe(0);
      expect(result.statistics.winRate).toBe(0);
      expect(result.workspaceBreakdown).toHaveLength(0);
      expect(result.recentTrades).toHaveLength(0);
    });
  });

  describe("getDebugChallengeBreakdown", () => {
    it("should compare raw vs canonical calculations", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 0), // prop with directPnl = 0
        createMockTrade("t2", "w1", null, 0), // personal with directPnl = 0
      ];
      const challenges = [createMockChallenge("c1", "w1", "evaluation", 100)];
      const pairs = [
        createMockPair("p1", "t1", "t2", 500), // combinedPnl = 500
      ];

      const result = getDebugChallengeBreakdown(trades, challenges, pairs);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
      expect(result[0].rawPropSum).toBe(0); // Old method
      expect(result[0].rawPersonalSum).toBe(0); // Old method
      expect(result[0].pairedCount).toBe(1);
      expect(result[0].canonicalMetrics.combinedRealized).toBe(500); // New method
      expect(result[0].netAfterFee).toBe(400); // 500 - 100
    });

    it("should handle challenges without pairs", () => {
      const trades = [createMockTrade("t1", "w1", "c1", 300)];
      const challenges = [createMockChallenge("c1", "w1", "evaluation", 100)];
      const pairs: HedgePair[] = [];

      const result = getDebugChallengeBreakdown(trades, challenges, pairs);

      expect(result[0].rawPropSum).toBe(300);
      expect(result[0].pairedCount).toBe(0);
      expect(result[0].canonicalMetrics.combinedRealized).toBe(300);
    });
  });

  describe("Statistics calculations", () => {
    it("should calculate win rate correctly", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 100), // win
        createMockTrade("t2", "w1", "c1", -50), // loss
        createMockTrade("t3", "w1", null, 200), // win
        createMockTrade("t4", "w1", null, null), // no P&L (excluded)
      ];
      const challenges = [createMockChallenge("c1", "w1")];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      expect(result.statistics.positiveTradeCount).toBe(2);
      expect(result.statistics.negativeTradeCount).toBe(1);
      expect(result.statistics.flatTradeCount).toBe(0);
      expect(result.statistics.winRate).toBeCloseTo(2 / 3, 2); // 2 wins out of 3 trades with P&L
    });

    it("should calculate averages correctly", () => {
      const trades = [
        createMockTrade("t1", "w1", "c1", 100), // firm
        createMockTrade("t2", "w1", "c1", 200), // firm
        createMockTrade("t3", "w1", null, -50), // personal
        createMockTrade("t4", "w1", null, 150), // personal
      ];
      const challenges = [
        createMockChallenge("c1", "w1", "evaluation", 80),
        createMockChallenge("c2", "w1", "failed", 120),
      ];
      const pairs: HedgePair[] = [];
      const sessions: LogSession[] = [];

      const result = calculateWorkspaceMetrics("w1", trades, challenges, pairs, sessions);

      expect(result.statistics.averageChallengeFee).toBe(100); // (80 + 120) / 2
      expect(result.statistics.averageFirmPnl).toBe(150); // (100 + 200) / 2
      expect(result.statistics.averagePersonalPnl).toBe(50); // (-50 + 150) / 2
      expect(result.statistics.averageTradeOverall).toBe(100); // (100 + 200 - 50 + 150) / 4
    });
  });
});