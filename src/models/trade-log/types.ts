/**
 * Trade journal — **Challenge** + **HedgePair** (“phase”) model.
 *
 * **Challenge** = one prop-firm eval or funded account: fee, balance, profit
 * target, risk caps, status. Prop legs carry `challengeId`; each is hedged with
 * a **personal** leg (`challengeId: null`) in a **HedgePair** with a per-challenge
 * **phaseNumber**. **Net real** = personal realized P&amp;L − fee (actual money).
 */

export type ChallengeStatus =
  | "evaluation"
  | "passed"
  | "failed"
  | "funded"
  | "paid_out"
  | "archived";

/** Trader / legal identity grouping challenges and trades in one workspace. */
export type Identity = {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * One prop-firm account lifecycle: fee → phases (hedge pairs) → pass → optional
 * payout. Rules in numeric caps; context in `note`.
 */
export const CHALLENGE_LEDGER_PHASE_COUNT = 6;

export type Challenge = {
  id: string;
  /** Workspace this challenge belongs to. */
  identityId: string;
  name: string;
  /** One-time entry / eval fee; subtracted in net P&L helpers. */
  fee: number;
  /** Starting account size for eval / notional baseline. */
  balance: number;
  /** Profit dollars required to pass (remaining = target − running prop P&L). */
  currentProfitTarget: number;
  maxDrawdown: number;
  dailyLossCap: number;
  status: ChallengeStatus;
  /** Free-form: firm, product tier, eval window notes, etc. */
  note: string;
  /** Recorded payout from the firm, if any. */
  payoutAmount: number | null;
  /** ISO date when payout was received, if any. */
  payoutAt: string | null;
  /**
   * Legacy persistence only (firm spreadsheet columns). Not shown in UI.
   */
  disbursementAt: string | null;
  /**
   * Legacy persistence only. Not shown in UI.
   */
  ledgerPhases: (number | null)[];
  createdAt: string;
  updatedAt: string;
};

export type TradeDirection = "long" | "short";

export type PairStatus =
  | "open"
  | "profitable"
  | "loss"
  | "break-even"
  | "invalid";

export type LogSession = {
  id: string;
  date: string;
  notes: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LogTrade = {
  id: string;
  /** Workspace (`Identity`); must match owning challenge when `challengeId` is set. */
  identityId: string;
  /**
   * Prop-firm (“official”) leg when set; **personal hedge** when `null`.
   * Hedge: mirror direction/size vs prop so prop losses offset personally;
   * pair + challenge summaries track net exposure.
   */
  challengeId: string | null;
  sessionId: string | null;
  symbol: string;
  direction: TradeDirection;
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  /**
   * When set, this value **is** the leg P&amp;L (realized) — no price math.
   * `exitPrice` may stay null. Omit or null when using price-based close.
   */
  directPnl: number | null;
  /** Mark for open legs; unrealized P&L when exit is null. */
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  fees: number;
  notes: string;
  screenshot: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * One **prop** trade + one **personal** hedge leg. `combinedPnl` is sum of
 * effective leg P&L; `status` is open vs settled outcome (or invalid tagging).
 * **phaseNumber** is 1-based within the challenge (Phase 1, Phase 2, …).
 */
export type HedgePair = {
  id: string;
  /** 1-based index within this challenge (trading session / phase). */
  phaseNumber: number;
  propTradeId: string;
  personalTradeId: string;
  combinedPnl: number;
  status: PairStatus;
  manuallySetStatus: boolean;
  createdAt: string;
  updatedAt: string;
};
