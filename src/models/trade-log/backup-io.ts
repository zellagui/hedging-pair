import {
  normalizeChallenge,
  normalizeIdentity,
  normalizePair,
  normalizeSession,
  normalizeTrade,
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
  activeIdentityId?: string | null;
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
): { ok: true; slice: PersistedTradeLogSlice; exportedAt?: string } | { ok: false; error: string } {
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

  const aid = o.activeIdentityId;
  const activeIdentityId =
    aid != null && String(aid).trim() !== "" ? String(aid).trim() : null;

  const slice: PersistedTradeLogSlice = {
    sessions,
    trades,
    pairs,
    challenges,
    identities,
    activeIdentityId,
  };

  return {
    ok: true,
    slice,
    exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : undefined,
  };
}
