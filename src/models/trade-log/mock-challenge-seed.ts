import { normalizeLedgerPhases } from "./challenge-ledger";
import { SAMPLE_SPREADSHEET_ROWS } from "./sample-spreadsheet-rows";
import type { Challenge } from "./types";

function newId() {
  return crypto.randomUUID();
}

export function isTradeLogWorkspaceEmpty(s: {
  challenges: unknown[];
  trades: unknown[];
  pairs: unknown[];
  sessions: unknown[];
}): boolean {
  return (
    s.challenges.length === 0 &&
    s.trades.length === 0 &&
    s.pairs.length === 0 &&
    s.sessions.length === 0
  );
}

/** 17 challenges from {@link SAMPLE_SPREADSHEET_ROWS}. */
export function createMockChallengesFromSampleRows(
  identityId: string
): Challenge[] {
  const n = SAMPLE_SPREADSHEET_ROWS.length;
  const base = Date.now();

  return SAMPLE_SPREADSHEET_ROWS.map((row, i) => {
    const createdAt = new Date(base - (n - 1 - i) * 1000).toISOString();
    const disbIso = `${row.disbursementAt}T12:00:00.000Z`;

    return {
      id: newId(),
      identityId,
      name: row.name,
      fee: row.fee,
      balance: 50_000,
      currentProfitTarget: 3_000,
      maxDrawdown: 2_000,
      dailyLossCap: 1_200,
      status: "evaluation",
      note:
        "Sample spreadsheet row — edit or delete like any other challenge.",
      payoutAmount: null,
      payoutAt: null,
      disbursementAt: disbIso,
      ledgerPhases: normalizeLedgerPhases(row.ledgerPhases),
      createdAt,
      updatedAt: createdAt,
    };
  });
}
