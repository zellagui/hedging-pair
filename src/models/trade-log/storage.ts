import type { StateStorage } from "zustand/middleware";

import {
  normalizeChallenge,
  normalizeIdentity,
  normalizePair,
  normalizeSession,
  normalizeTrade,
  normalizePlan,
} from "./normalize";
import type { Challenge, HedgePair, Identity, LogSession, LogTrade, PhasePlan } from "./types";

/**
 * Persists readable keys. Legacy keys (`journal-root`, `accounts`,
 * old blob shapes) are intentionally not read — this app starts from these
 * keys only; malformed rows are dropped during parse (see store hydration).
 */
export const STORAGE_KEY_SESSIONS = "sessions";
export const STORAGE_KEY_TRADES = "trades";
export const STORAGE_KEY_PAIRS = "pairs";
export const STORAGE_KEY_CHALLENGES = "challenges";
export const STORAGE_KEY_IDENTITIES = "identities";
export const STORAGE_KEY_PLANS = "plans";
/** UUID string persisted when Overview scope is chosen. */
export const STORAGE_KEY_ACTIVE_IDENTITY_ID = "journal-active-identity-id";
export const TRADE_LOG_ROOT_KEY = "trade-log-root";
export const STORAGE_VERSION = 14;

export type PersistedTradeLogSlice = {
  sessions: LogSession[];
  trades: LogTrade[];
  pairs: HedgePair[];
  challenges: Challenge[];
  identities: Identity[];
  plans: PhasePlan[];
  activeIdentityId: string | null;
};

/** While a workspace CSV folder is linked and authoritative, skips fragmenting localStorage writes (live sync drives persistence). */
let skipLocalWrites = false;

export function setTradeLogSkipLocalWrites(active: boolean) {
  skipLocalWrites = active;
}

export function isTradeLogSkipLocalWrites() {
  return skipLocalWrites;
}

function safeParseArray<T>(raw: string | null): T[] {
  if (raw == null || raw === "") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function persistTradeLogSliceToLocalKeys(state: PersistedTradeLogSlice) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(state.sessions));
  localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(state.trades));
  localStorage.setItem(STORAGE_KEY_PAIRS, JSON.stringify(state.pairs));
  localStorage.setItem(
    STORAGE_KEY_CHALLENGES,
    JSON.stringify(state.challenges)
  );
  localStorage.setItem(
    STORAGE_KEY_IDENTITIES,
    JSON.stringify(state.identities)
  );
  localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(state.plans));
  localStorage.setItem(
    STORAGE_KEY_ACTIVE_IDENTITY_ID,
    state.activeIdentityId ?? ""
  );
  localStorage.setItem(
    TRADE_LOG_ROOT_KEY,
    JSON.stringify({ version: STORAGE_VERSION, updatedAt: Date.now() })
  );
}

function writeLocalKeys(state: PersistedTradeLogSlice) {
  if (skipLocalWrites) return;
  persistTradeLogSliceToLocalKeys(state);
}

export function createTradeLogPersistStorage(): StateStorage {
  return {
    getItem: (): string | null => {
      if (typeof window === "undefined") return null;

      const sessionsRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_SESSIONS)
      );
      const tradesRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_TRADES)
      );
      const pairsRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_PAIRS)
      );
      const challengesRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_CHALLENGES)
      );
      const identitiesRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_IDENTITIES)
      );
      const plansRaw = safeParseArray<unknown>(
        localStorage.getItem(STORAGE_KEY_PLANS)
      );
      const aid = localStorage.getItem(STORAGE_KEY_ACTIVE_IDENTITY_ID);
      const activeIdentityId =
        aid != null && aid.trim() !== "" ? aid.trim() : null;

      const sessions = sessionsRaw
        .map(normalizeSession)
        .filter((x): x is LogSession => x != null);
      const trades = tradesRaw
        .map(normalizeTrade)
        .filter((x): x is LogTrade => x != null);
      const pairs = pairsRaw
        .map(normalizePair)
        .filter((x): x is HedgePair => x != null);
      const challenges = challengesRaw
        .map(normalizeChallenge)
        .filter((x): x is Challenge => x != null);
      const identities = identitiesRaw
        .map(normalizeIdentity)
        .filter((x): x is Identity => x != null);
      const plans = plansRaw
        .map(normalizePlan)
        .filter((x): x is PhasePlan => x != null);

      if (
        sessions.length === 0 &&
        trades.length === 0 &&
        pairs.length === 0 &&
        challenges.length === 0 &&
        identities.length === 0 &&
        plans.length === 0
      ) {
        return null;
      }

      return JSON.stringify({
        state: {
          sessions,
          trades,
          pairs,
          challenges,
          identities,
          plans,
          activeIdentityId,
        },
        version: STORAGE_VERSION,
      });
    },
    setItem: (_name, value) => {
      if (typeof window === "undefined") return;
      if (skipLocalWrites) return;
      try {
        const parsed = JSON.parse(value) as {
          state: PersistedTradeLogSlice;
        };
        writeLocalKeys(parsed.state);
      } catch {
        /* ignore */
      }
    },
    removeItem: () => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_TRADES);
      localStorage.removeItem(STORAGE_KEY_PAIRS);
      localStorage.removeItem(STORAGE_KEY_CHALLENGES);
      localStorage.removeItem(STORAGE_KEY_IDENTITIES);
      localStorage.removeItem(STORAGE_KEY_PLANS);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_IDENTITY_ID);
      localStorage.removeItem(TRADE_LOG_ROOT_KEY);
    },
  };
}
