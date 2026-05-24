import {
  normalizeChallenge,
  normalizeIdentity,
  normalizePair,
  normalizeSession,
  normalizeTrade,
  normalizePlan,
} from "./normalize";
import { STORAGE_VERSION } from "./storage";
import type { PersistedTradeLogSlice } from "./storage";

export type TradeLogBackupFileShape = {
  version?: number;
  exportedAt?: string;
  sessions?: unknown;
  trades?: unknown;
  pairs?: unknown;
  challenges?: unknown;
  identities?: unknown;
  plans?: unknown;
  activeIdentityId?: string | null;
  /** Set by /api/journal when serving a legacy blob path (stripped before hydrate). */
  journalSyncMeta?: { fromLegacy?: boolean };
};

function asUnknownArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** JSON backup object (download, cloud sync, API). */
export function buildTradeLogBackupPayload(
  slice: PersistedTradeLogSlice,
  exportedAt?: string
): TradeLogBackupFileShape & { version: number } {
  return {
    version: STORAGE_VERSION,
    exportedAt: exportedAt ?? new Date().toISOString(),
    sessions: slice.sessions,
    trades: slice.trades,
    pairs: slice.pairs,
    challenges: slice.challenges,
    identities: slice.identities,
    plans: slice.plans,
    activeIdentityId: slice.activeIdentityId,
  };
}

export function serializeTradeLogBackup(
  slice: PersistedTradeLogSlice,
  exportedAt?: string
): string {
  return JSON.stringify(buildTradeLogBackupPayload(slice, exportedAt), null, 2);
}

/**
 * Parses a JSON file produced by {@link downloadTradeLogBackupJson} (or the same shape).
 * Drops malformed rows like localStorage hydration.
 */
export function parseTradeLogBackupJsonText(
  text: string,
  opts?: { maxBackupVersion?: number }
):
  | { ok: true; slice: PersistedTradeLogSlice; exportedAt?: string; fromLegacy?: boolean }
  | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  if (raw == null || typeof raw !== "object") {
    return { ok: false, error: "Backup root must be a JSON object." };
  }
  const o = raw as TradeLogBackupFileShape;
  const fromLegacy = o.journalSyncMeta?.fromLegacy === true;

  const maxV = opts?.maxBackupVersion ?? STORAGE_VERSION;
  if (typeof o.version === "number" && o.version > maxV) {
    return {
      ok: false,
      error: `This backup was exported from a newer journal (schema v${o.version}). Update this app, then import again.`,
    };
  }

  const sessions = asUnknownArray(o.sessions)
    .map(normalizeSession)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const trades = asUnknownArray(o.trades)
    .map(normalizeTrade)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const pairs = asUnknownArray(o.pairs)
    .map(normalizePair)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const challenges = asUnknownArray(o.challenges)
    .map(normalizeChallenge)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const identities = asUnknownArray(o.identities)
    .map(normalizeIdentity)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const plans = asUnknownArray(o.plans)
    .map(normalizePlan)
    .filter((x): x is NonNullable<typeof x> => x != null);

  const aid = o.activeIdentityId;
  const activeIdentityId =
    aid != null && String(aid).trim() !== "" ? String(aid).trim() : null;

  const slice: PersistedTradeLogSlice = {
    sessions,
    trades,
    pairs,
    challenges,
    identities,
    plans,
    activeIdentityId,
  };

  return {
    ok: true,
    slice,
    exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : undefined,
    fromLegacy,
  };
}

export function formatJournalSliceSummary(slice: PersistedTradeLogSlice): string {
  return `${slice.identities.length} workspace${slice.identities.length === 1 ? "" : "s"}, ${slice.challenges.length} challenge${slice.challenges.length === 1 ? "" : "s"}, ${slice.trades.length} trade leg${slice.trades.length === 1 ? "" : "s"}, ${slice.plans.length} plan${slice.plans.length === 1 ? "" : "s"}`;
}

/** Higher = more journal content (used to pick the best blob when several exist). */
export function scoreJournalSliceRichness(slice: PersistedTradeLogSlice): number {
  return (
    slice.identities.length +
    slice.challenges.length +
    slice.trades.length +
    slice.pairs.length +
    slice.sessions.length +
    slice.plans.length
  );
}
