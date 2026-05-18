export type RiskTone = "safe" | "warning" | "danger";

export type AccountStatus = "active" | "passed" | "failed";

export type AccountKind = "challenge" | "funded" | "personal";

export type HedgeOutcome = "profitable" | "break_even" | "loss";

export type KpiMetric = {
  id: string;
  label: string;
  /** Signed dollar amount or percentage points depending on `kind` */
  value: number;
  kind: "currency" | "percent";
};

export const commandHeaderMock = {
  systemName: "Challenge-Hedge System",
  sessionActive: true,
  /** Shown when sessionActive is true */
  sessionDetail:
    "Active Session — Open · 12:30 PM · Trading Asia Session",
  /** Shown when sessionActive is false */
  sessionInactiveLabel: "No active session",
} as const;

export const kpiMock: KpiMetric[] = [
  { id: "net", label: "Total Net P&L", value: 335.26, kind: "currency" },
  { id: "fees", label: "Fee Paid", value: 1106.0, kind: "currency" },
  { id: "personal", label: "Total Personal P&L", value: 1441.26, kind: "currency" },
  {
    id: "challenge",
    label: "Total Challenge P&L",
    value: -770.74,
    kind: "currency",
  },
  { id: "dd", label: "Drawdown Remaining", value: 15, kind: "percent" },
  { id: "target", label: "Target Remaining", value: 25, kind: "percent" },
];

export const todaySnapshotMock = {
  /** ISO date for snapshot (session day) */
  sessionDate: "2026-05-15",
  plan: "2 trades, 1 hedge pair, 2% max risk per pair.",
  trades: {
    count: 2,
    items: [
      "1 passed evaluation-style entry (CH-EVAL-1)",
      "1 hedge pair closed (CH-001 ↔ PERSONAL-001)",
    ],
  },
  sessionPnl: 42.18,
  notes: "Asia range sweep, 1 reversal, 1 hedge.",
};

export const riskMock = {
  tone: "danger" as RiskTone,
  dailyDrawdownUsedPct: 85,
  maxDrawdownUsedPct: 75,
  openRisk: 1200,
  ruleAlerts: [
    "1 challenge account near max drawdown",
    "Daily loss buffer under 15% — size down on next entry",
  ],
};

export type AccountTile = {
  id: string;
  label: string;
  kind: AccountKind;
  status: AccountStatus;
  balance: number;
  targetProgressPct: /** 0–100 */ number;
  payout?: number;
};

export const accountsMock: {
  challenge: AccountTile[];
  funded: AccountTile[];
  personal: AccountTile[];
} = {
  challenge: [
    {
      id: "ch-1",
      label: "Challenge 1",
      kind: "challenge",
      status: "active",
      balance: 98500,
      targetProgressPct: 75,
    },
    {
      id: "ch-2",
      label: "Challenge 2",
      kind: "challenge",
      status: "active",
      balance: 102400,
      targetProgressPct: 45,
    },
  ],
  funded: [
    {
      id: "fd-1",
      label: "Funded 1",
      kind: "funded",
      status: "passed",
      balance: 118000,
      targetProgressPct: 100,
      payout: 1200,
    },
  ],
  personal: [
    {
      id: "ps-1",
      label: "Personal 1",
      kind: "personal",
      status: "active",
      balance: 3200,
      targetProgressPct: 62,
    },
  ],
};

export type HedgePairRow = {
  id: string;
  challengeTrade: string;
  personalTrade: string;
  combinedPnl: number;
  outcome: HedgeOutcome;
};

export const hedgePairsMock: HedgePairRow[] = [
  {
    id: "p1",
    challengeTrade: "CH-001 · Long MES",
    personalTrade: "PERSONAL-001 · Short MES",
    combinedPnl: 98,
    outcome: "profitable",
  },
  {
    id: "p2",
    challengeTrade: "CH-002 · Short MNQ",
    personalTrade: "PERSONAL-002 · Long MNQ",
    combinedPnl: -12,
    outcome: "loss",
  },
  {
    id: "p3",
    challengeTrade: "CH-003 · Long GC",
    personalTrade: "PERSONAL-003 · Short GC",
    combinedPnl: 45,
    outcome: "profitable",
  },
  {
    id: "p4",
    challengeTrade: "CH-004 · Scalp CL",
    personalTrade: "PERSONAL-004 · Hedge CL",
    combinedPnl: 0,
    outcome: "break_even",
  },
];
