import { normalizeLedgerPhases } from "./challenge-ledger";
import {
  normalizeChallenge,
  normalizeIdentity,
  normalizePair,
  normalizeSession,
  normalizeTrade,
  normalizePlan,
} from "./normalize";
import type { PersistedTradeLogSlice } from "./storage";
import { STORAGE_VERSION } from "./storage";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
  PhasePlan,
} from "./types";

/** Canonical CSV filenames for workspace folder sync / export. */
export const CSV_FILE_IDENTITIES = "identities.csv";
export const CSV_FILE_CHALLENGES = "challenges.csv";
export const CSV_FILE_TRADES = "trades.csv";
export const CSV_FILE_PAIRS = "pairs.csv";
export const CSV_FILE_SESSIONS = "sessions.csv";
export const CSV_FILE_PLANS = "plans.csv";
export const CSV_FILE_META = "meta.json";

export type WorkspaceCsvMeta = {
  version: number;
  activeIdentityId: string | null;
  savedAtIso: string;
};

function escCell(raw: unknown): string {
  const s = raw === null || raw === undefined ? "" : String(raw);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Single header line + CRLF-terminated body rows */
export function stringifyCsv(headers: readonly string[], rows: unknown[][]): string {
  const head = headers.map(escCell).join(",");
  const body = rows.map((r) => r.map((c) => escCell(c)).join(",")).join("\r\n");
  return `${head}\r\n${body}\r\n`;
}

/** Parses CSV preserving quoted commas and newlines. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const t = text.replace(/^\ufeff/, "");
  if (t.trim() === "") return { headers: [], rows: [] };

  type RowArr = string[];
  const rows: RowArr[] = [];
  let i = 0;
  let field = "";
  let row: RowArr = [];
  let inQuotes = false;

  function pushField() {
    row.push(field);
    field = "";
  }

  function pushRowIfMeaningful() {
    const meaningful =
      row.length > 0 && row.some((x) => x.trim() !== "") ? row : null;
    if (meaningful) rows.push(meaningful);
    row = [];
  }

  while (i < t.length) {
    const ch = t[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      if (t[i] === "\n") i += 1;
      pushField();
      pushRowIfMeaningful();
      continue;
    }
    if (ch === "\n") {
      i += 1;
      pushField();
      pushRowIfMeaningful();
      continue;
    }
    field += ch;
    i += 1;
  }

  pushField();
  pushRowIfMeaningful();

  const headerRaw = rows[0];
  if (!headerRaw) return { headers: [], rows: [] };
  const dataRows = rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""));
  return { headers: headerRaw.map((h) => h.trim()), rows: dataRows };
}

export function stringifyMeta(meta: WorkspaceCsvMeta): string {
  return JSON.stringify(meta, null, 2);
}

export function parseMeta(raw: string): WorkspaceCsvMeta | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (typeof r.version !== "number") return null;
    return {
      version: r.version,
      activeIdentityId:
        r.activeIdentityId == null
          ? null
          : String(r.activeIdentityId).trim() === ""
            ? null
            : String(r.activeIdentityId),
      savedAtIso:
        typeof r.savedAtIso === "string" ? r.savedAtIso : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

const IDENTITY_COLUMNS = [
  "id",
  "name",
  "note",
  "createdAt",
  "updatedAt",
] as const;

const CHALLENGE_COLUMNS = [
  "id",
  "identityId",
  "name",
  "fee",
  "balance",
  "currentProfitTarget",
  "maxDrawdown",
  "dailyLossCap",
  "status",
  "note",
  "payoutAmount",
  "payoutAt",
  "disbursementAt",
  "ledgerPhasesJson",
  "createdAt",
  "updatedAt",
] as const;

const TRADE_COLUMNS = [
  "id",
  "identityId",
  "challengeId",
  "sessionId",
  "symbol",
  "direction",
  "size",
  "entryPrice",
  "exitPrice",
  "directPnl",
  "currentPrice",
  "stopLoss",
  "takeProfit",
  "fees",
  "notes",
  "screenshot",
  "createdAt",
  "updatedAt",
] as const;

const PAIR_COLUMNS = [
  "id",
  "phaseNumber",
  "propTradeId",
  "personalTradeId",
  "combinedPnl",
  "status",
  "manuallySetStatus",
  "planId",
  "createdAt",
  "updatedAt",
] as const;

const SESSION_COLUMNS = [
  "id",
  "date",
  "notes",
  "closed",
  "createdAt",
  "updatedAt",
] as const;

const PLAN_COLUMNS = [
  "id",
  "challengeId",
  "phaseNumber",
  "propTpUsd",
  "propSlUsd",
  "propContracts",
  "personalTargetProfit",
  "personalPointValue",
  "buffer",
  "lotStep",
  "minLot",
  "roundMode",
  "expectedPayout",
  "propSymbol",
  "personalSymbol",
  "personalEntryPrice",
  "hedgePairId",
  "status",
  "createdAt",
  "updatedAt",
] as const;

function ledgerPhasesToCell(c: Challenge): string {
  return JSON.stringify(c.ledgerPhases);
}

function rowIdentity(i: Identity): unknown[] {
  return [i.id, i.name, i.note, i.createdAt, i.updatedAt];
}

function rowChallenge(c: Challenge): unknown[] {
  return [
    c.id,
    c.identityId,
    c.name,
    c.fee,
    c.balance,
    c.currentProfitTarget,
    c.maxDrawdown,
    c.dailyLossCap,
    c.status,
    c.note,
    c.payoutAmount,
    c.payoutAt,
    c.disbursementAt,
    ledgerPhasesToCell(c),
    c.createdAt,
    c.updatedAt,
  ];
}

function rowTrade(t: LogTrade): unknown[] {
  return [
    t.id,
    t.identityId,
    t.challengeId,
    t.sessionId,
    t.symbol,
    t.direction,
    t.size,
    t.entryPrice,
    t.exitPrice,
    t.directPnl,
    t.currentPrice,
    t.stopLoss,
    t.takeProfit,
    t.fees,
    t.notes,
    t.screenshot,
    t.createdAt,
    t.updatedAt,
  ];
}

function rowPair(p: HedgePair): unknown[] {
  return [
    p.id,
    p.phaseNumber,
    p.propTradeId,
    p.personalTradeId,
    p.combinedPnl,
    p.status,
    p.manuallySetStatus,
    p.planId,
    p.createdAt,
    p.updatedAt,
  ];
}

function rowSession(s: LogSession): unknown[] {
  return [
    s.id,
    s.date,
    s.notes,
    s.closed,
    s.createdAt,
    s.updatedAt,
  ];
}

function rowPlan(p: PhasePlan): unknown[] {
  return [
    p.id,
    p.challengeId,
    p.phaseNumber,
    p.propTpUsd,
    p.propSlUsd,
    p.propContracts,
    p.personalTargetProfit,
    p.personalPointValue,
    p.buffer,
    p.lotStep,
    p.minLot,
    p.roundMode,
    p.expectedPayout,
    p.propSymbol,
    p.personalSymbol,
    p.personalEntryPrice,
    p.hedgePairId,
    p.status,
    p.createdAt,
    p.updatedAt,
  ];
}

export type CsvWorkspaceFiles = Record<string, string>;

export function serializeTradeLogSliceToFiles(
  slice: PersistedTradeLogSlice,
  meta?: WorkspaceCsvMeta
): CsvWorkspaceFiles {
  const m: WorkspaceCsvMeta =
    meta ?? {
      version: STORAGE_VERSION,
      activeIdentityId: slice.activeIdentityId ?? null,
      savedAtIso: new Date().toISOString(),
    };

  const sortedIdentities = [...slice.identities].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const sortedChallenges = [...slice.challenges].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const sortedTrades = [...slice.trades].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const sortedPairs = [...slice.pairs].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const sortedSessions = [...slice.sessions].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const sortedPlans = [...slice.plans].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  return {
    [CSV_FILE_META]: stringifyMeta(m),
    [CSV_FILE_IDENTITIES]: stringifyCsv(
      IDENTITY_COLUMNS,
      sortedIdentities.map(rowIdentity)
    ),
    [CSV_FILE_CHALLENGES]: stringifyCsv(
      CHALLENGE_COLUMNS,
      sortedChallenges.map(rowChallenge)
    ),
    [CSV_FILE_TRADES]: stringifyCsv(TRADE_COLUMNS, sortedTrades.map(rowTrade)),
    [CSV_FILE_PAIRS]: stringifyCsv(PAIR_COLUMNS, sortedPairs.map(rowPair)),
    [CSV_FILE_SESSIONS]: stringifyCsv(
      SESSION_COLUMNS,
      sortedSessions.map(rowSession)
    ),
    [CSV_FILE_PLANS]: stringifyCsv(PLAN_COLUMNS, sortedPlans.map(rowPlan)),
  };
}

function rowsToMaps(
  headers: string[],
  rows: string[][]
): Record<string, string>[] {
  const idx = new Map(headers.map((h, i) => [h.trim(), i] as const));
  return rows.map((cells) => {
    const obj: Record<string, string> = {};
    for (const h of headers) {
      const j = idx.get(h);
      if (j == null) continue;
      obj[h] = cells[j]?.trim() ?? "";
    }
    return obj;
  });
}

/** Parse persisted slice from textual file map (filename → content). */
export function parseFilesToTradeLogSlice(
  files: Record<string, string>
): PersistedTradeLogSlice {
  const metaRaw = files[CSV_FILE_META];
  parseMeta(metaRaw ?? "{}"); // validate optional

  const identCsv = parseCsv(files[CSV_FILE_IDENTITIES] ?? "");
  const chCsv = parseCsv(files[CSV_FILE_CHALLENGES] ?? "");
  const trCsv = parseCsv(files[CSV_FILE_TRADES] ?? "");
  const paCsv = parseCsv(files[CSV_FILE_PAIRS] ?? "");
  const seCsv = parseCsv(files[CSV_FILE_SESSIONS] ?? "");
  const plCsv = parseCsv(files[CSV_FILE_PLANS] ?? "");

  const identities =
    rowsToMaps(identCsv.headers, identCsv.rows).map(normalizeCsvIdentity);
  const challenges =
    rowsToMaps(chCsv.headers, chCsv.rows).map(normalizeCsvChallenge);
  const trades = rowsToMaps(trCsv.headers, trCsv.rows).map(normalizeCsvTrade);
  const pairs = rowsToMaps(paCsv.headers, paCsv.rows).map(normalizeCsvPair);
  const sessions =
    rowsToMaps(seCsv.headers, seCsv.rows).map(normalizeCsvSession);
  const plans = rowsToMaps(plCsv.headers, plCsv.rows).map(normalizeCsvPlan);

  const metaParsed = metaRaw ? parseMeta(metaRaw) : null;

  return {
    identities: identities.filter((x): x is Identity => x != null),
    challenges: challenges.filter((x): x is Challenge => x != null),
    trades: trades.filter((x): x is LogTrade => x != null),
    pairs: pairs.filter((x): x is HedgePair => x != null),
    sessions: sessions.filter((x): x is LogSession => x != null),
    plans: plans.filter((x): x is PhasePlan => x != null),
    activeIdentityId: metaParsed?.activeIdentityId ?? null,
  };
}

function normalizeCsvIdentity(o: Record<string, string>): Identity | null {
  return normalizeIdentity({
    id: o.id,
    name: o.name,
    note: o.note ?? "",
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

function normalizeCsvChallenge(o: Record<string, string>): Challenge | null {
  const ledgerPhasesJson = o.ledgerPhasesJson ?? o.ledgerPhases ?? "";
  let phases: unknown = [];
  try {
    phases =
      ledgerPhasesJson.trim() !== "" ? JSON.parse(ledgerPhasesJson) : [];
  } catch {
    phases = [];
  }
  return normalizeChallenge({
    id: o.id,
    identityId: o.identityId ?? "",
    name: o.name,
    fee: o.fee,
    balance: o.balance,
    currentProfitTarget: o.currentProfitTarget,
    maxDrawdown: o.maxDrawdown,
    dailyLossCap: o.dailyLossCap,
    status: o.status,
    note: o.note ?? "",
    payoutAmount: o.payoutAmount ?? null,
    payoutAt: o.payoutAt ?? null,
    disbursementAt: o.disbursementAt ?? null,
    ledgerPhases: normalizeLedgerPhases(phases),
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

function normalizeCsvTrade(o: Record<string, string>): LogTrade | null {
  return normalizeTrade({
    id: o.id,
    identityId: o.identityId ?? "",
    challengeId:
      o.challengeId === "" || o.challengeId == null ? null : o.challengeId,
    sessionId:
      o.sessionId === "" || o.sessionId == null ? null : o.sessionId,
    symbol: o.symbol,
    direction: o.direction,
    size: o.size,
    entryPrice: o.entryPrice,
    exitPrice: o.exitPrice,
    directPnl: o.directPnl ?? null,
    currentPrice: o.currentPrice ?? null,
    stopLoss: o.stopLoss ?? null,
    takeProfit: o.takeProfit ?? null,
    fees: o.fees ?? "0",
    notes: o.notes ?? "",
    screenshot:
      o.screenshot === "" || o.screenshot == null ? null : o.screenshot,
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

function normalizeCsvPair(o: Record<string, string>): HedgePair | null {
  return normalizePair({
    id: o.id,
    phaseNumber: o.phaseNumber,
    propTradeId: o.propTradeId,
    personalTradeId: o.personalTradeId,
    combinedPnl: o.combinedPnl,
    status: o.status,
    manuallySetStatus: o.manuallySetStatus,
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

function normalizeCsvSession(o: Record<string, string>): LogSession | null {
  return normalizeSession({
    id: o.id,
    date: o.date,
    notes: o.notes ?? "",
    closed:
      o.closed === "true" || o.closed === "1" ? true : o.closed === "false"
        ? false
        : Boolean(o.closed),
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

function normalizeCsvPlan(o: Record<string, string>): PhasePlan | null {
  return normalizePlan({
    id: o.id,
    challengeId: o.challengeId,
    phaseNumber: o.phaseNumber ?? "1",
    propSymbol: o.propSymbol ?? "",
    propDirection: o.propDirection ?? "long",
    propTpPoints: o.propTpPoints ?? "0",
    propSlPoints: o.propSlPoints ?? "0",
    propContracts: o.propContracts ?? "1",
    propPointValue: o.propPointValue ?? "1",
    propEntryPrice: o.propEntryPrice ?? "",
    personalSymbol: o.personalSymbol ?? o.propSymbol ?? "",
    personalPointValue: o.personalPointValue ?? "1",
    targetProfit: o.targetProfit ?? "0",
    lotStep: o.lotStep ?? "0.1",
    minLot: o.minLot ?? "0.1",
    buffer: o.buffer ?? "1.5",
    roundMode: o.roundMode ?? "up",
    personalEntryPrice: o.personalEntryPrice ?? "",
    expectedPayout: o.expectedPayout ?? "0",
    hedgePairId: o.hedgePairId ?? "",
    status: o.status ?? "planned",
    createdAt: o.createdAt ?? "",
    updatedAt: o.updatedAt ?? "",
  });
}

export function filterSliceForExport(
  full: PersistedTradeLogSlice,
  selectedIdentityIds: string[],
  selectedChallengeIds?: string[]
): PersistedTradeLogSlice {
  const idSetIdentity = new Set(
    selectedIdentityIds.map((x) => x.trim()).filter(Boolean)
  );
  if (idSetIdentity.size === 0) {
    return {
      identities: [],
      challenges: [],
      trades: [],
      pairs: [],
      sessions: [],
      plans: [],
      activeIdentityId: full.activeIdentityId,
    };
  }

  const chalPick =
    selectedChallengeIds != null && selectedChallengeIds.length > 0
      ? new Set(selectedChallengeIds)
      : null;

  const identities = full.identities.filter((i) => idSetIdentity.has(i.id));

  const challenges = full.challenges.filter(
    (c) =>
      idSetIdentity.has(c.identityId) &&
      (chalPick == null || chalPick.has(c.id))
  );

  const scopedChallengeIds = new Set(challenges.map((c) => c.id));

  const tradeById = new Map(full.trades.map((t) => [t.id, t]));

  const scopedPairs = full.pairs.filter((p) => {
    const prop = tradeById.get(p.propTradeId);
    return (
      prop != null &&
      prop.challengeId != null &&
      scopedChallengeIds.has(prop.challengeId)
    );
  });

  const tradeIdsNeeded = new Set<string>();
  for (const c of challenges) {
    for (const t of full.trades) {
      if (t.challengeId === c.id) tradeIdsNeeded.add(t.id);
    }
  }
  for (const p of scopedPairs) {
    tradeIdsNeeded.add(p.propTradeId);
    tradeIdsNeeded.add(p.personalTradeId);
  }

  for (const t of full.trades) {
    if (t.challengeId == null && idSetIdentity.has(t.identityId)) {
      tradeIdsNeeded.add(t.id);
    }
  }

  const trades = full.trades.filter((t) => tradeIdsNeeded.has(t.id));
  const pairs = scopedPairs.filter((p) => tradeIdsNeeded.has(p.propTradeId));

  const sessionIdsNeeded = new Set<string>();
  for (const t of trades) {
    if (t.sessionId) sessionIdsNeeded.add(t.sessionId);
  }

  const sessions = full.sessions.filter((s) => sessionIdsNeeded.has(s.id));
  
  const plans = full.plans.filter((p) => scopedChallengeIds.has(p.challengeId));

  let aid = full.activeIdentityId;
  if (aid != null && !idSetIdentity.has(aid)) {
    aid = identities[0]?.id ?? null;
  }

  return {
    identities,
    challenges,
    trades,
    pairs,
    sessions,
    plans,
    activeIdentityId: aid,
  };
}
