"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { normalizeLedgerPhases } from "./challenge-ledger";
import {
  applyChallengeDrawdownBreachFailure,
  assignPhaseNumbersToPairs,
  challengeAcceptsNewPropTrades,
  getPairsByChallengeId,
  isValidChallengeStatusTransition,
} from "./challenges";
import { parseTradeLogBackupJsonText } from "./backup-io";
import { ensureIdentityConsistency } from "./identity-scope";
import { refreshAllPairs, recomputePair, isValidHedgePairLegs } from "./pairs";
import {
  createTradeLogPersistStorage,
  isTradeLogSkipLocalWrites,
  type PersistedTradeLogSlice,
  persistTradeLogSliceToLocalKeys,
  STORAGE_VERSION,
  TRADE_LOG_ROOT_KEY,
} from "./storage";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
  PairStatus,
} from "./types";

const persistStorage = createTradeLogPersistStorage();

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function repairHydratedPersistedTradeLogSlice(slice: PersistedTradeLogSlice) {
  const personalIds = new Set(slice.pairs.map((pp) => pp.personalTradeId));
  const needsPersonalChallengeClear = slice.trades.some(
    (t) => personalIds.has(t.id) && t.challengeId != null
  );
  const tradesRepaired = needsPersonalChallengeClear
    ? slice.trades.map((t) =>
        personalIds.has(t.id) ? { ...t, challengeId: null } : t
      )
    : slice.trades;

  const ensured = ensureIdentityConsistency({
    identities: slice.identities ?? [],
    challenges: slice.challenges,
    trades: tradesRepaired,
    pairs: slice.pairs,
    activeIdentityId: slice.activeIdentityId ?? null,
    nowIso,
  });

  const challengesAfterBreaches = applyChallengeDrawdownBreachFailure(
    ensured.challenges,
    ensured.trades,
    slice.pairs,
    nowIso
  );

  return {
    identities: ensured.identities,
    trades: ensured.trades,
    challenges: challengesAfterBreaches,
    pairs: slice.pairs,
    activeIdentityId: ensured.activeIdentityId,
    sessions: slice.sessions,
  };
}
function reconcileChallengeAutoStatus(
  challenges: Challenge[],
  trades: LogTrade[],
  pairs: HedgePair[]
): Challenge[] {
  return applyChallengeDrawdownBreachFailure(
    challenges,
    trades,
    pairs,
    nowIso
  );
}

function isSessionClosed(
  sessions: LogSession[],
  sessionId: string | null
): boolean {
  if (sessionId == null) return false;
  const s = sessions.find((x) => x.id === sessionId);
  return s?.closed === true;
}

function tradeInPair(pairs: HedgePair[], tradeId: string): HedgePair | undefined {
  return pairs.find(
    (p) => p.propTradeId === tradeId || p.personalTradeId === tradeId
  );
}

export type TradeLogState = {
  sessions: LogSession[];
  trades: LogTrade[];
  pairs: HedgePair[];
  challenges: Challenge[];
  identities: Identity[];
  /** Overview KPI scope; hydrated from storage or defaulted by repair. */
  activeIdentityId: string | null;

  setActiveIdentityId: (identityId: string | null) => void;
  addIdentity: (
    input: Pick<Identity, "name" | "note">
  ) => string;
  updateIdentity: (
    id: string,
    patch: Partial<Pick<Identity, "name" | "note">>
  ) => void;
  /** Fails when challenges reference this identity or it is the sole workspace. */
  deleteIdentity: (id: string) => boolean;

  addSession: (input: Pick<LogSession, "date" | "notes">) => string;
  updateSession: (
    id: string,
    patch: Partial<Pick<LogSession, "date" | "notes" | "closed">>
  ) => void;
  closeSession: (id: string) => void;

  addChallenge: (
    input: Omit<Challenge, "id" | "createdAt" | "updatedAt">
  ) => string | null;
  updateChallenge: (
    id: string,
    patch: Partial<Omit<Challenge, "id" | "createdAt">>
  ) => void;
  deleteChallenge: (id: string) => boolean;
  /** Removes challenge and all its prop/personal trades and hedge pairs. */
  deleteChallengeCascade: (challengeId: string) => boolean;

  addTrade: (input: Omit<LogTrade, "id" | "createdAt" | "updatedAt">) => string | null;
  updateTrade: (id: string, patch: Partial<Omit<LogTrade, "id">>) => void;
  deleteTrade: (id: string) => void;

  linkPair: (propTradeId: string, personalTradeId: string) => string | null;
  unlinkPair: (pairId: string) => void;
  deleteHedgePairCascade: (pairId: string) => boolean;
  updatePair: (
    id: string,
    patch: { manuallySetStatus?: boolean; status?: PairStatus }
  ) => void;

  getTrade: (id: string) => LogTrade | undefined;
  getSession: (id: string) => LogSession | undefined;
  getChallenge: (id: string) => Challenge | undefined;
  getIdentity: (id: string) => Identity | undefined;
};

export const useTradingStore = create<TradeLogState>()(
  persist(
    (set, get) => ({
      sessions: [],
      trades: [],
      pairs: [],
      challenges: [],
      identities: [],
      activeIdentityId: null,

      setActiveIdentityId(identityId) {
        const st = get();
        if (
          identityId != null &&
          identityId.trim() !== "" &&
          !st.identities.some((x) => x.id === identityId)
        ) {
          return;
        }
        set({
          activeIdentityId:
            identityId == null || identityId.trim() === "" ? null : identityId,
        });
      },

      addIdentity(input) {
        const id = newId();
        const iso = nowIso();
        set((s) => ({
          identities: [
            {
              id,
              name: input.name.trim() || "Untitled workspace",
              note: input.note?.trim() ?? "",
              createdAt: iso,
              updatedAt: iso,
            },
            ...s.identities,
          ],
        }));
        return id;
      },

      updateIdentity(id, patch) {
        const iso = nowIso();
        set((s) => ({
          identities: s.identities.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: iso } : x
          ),
        }));
      },

      deleteIdentity(id) {
        const s = get();
        if (s.identities.length <= 1) return false;
        if (s.challenges.some((c) => c.identityId === id)) return false;
        const identities = s.identities.filter((x) => x.id !== id);
        let activeIdentityId = s.activeIdentityId;
        if (activeIdentityId === id) {
          activeIdentityId = identities[0]?.id ?? null;
        }
        set({
          identities,
          activeIdentityId,
        });
        return true;
      },

      addSession(input) {
        const id = newId();
        const iso = nowIso();
        set((s) => ({
          sessions: [
            {
              id,
              date: input.date,
              notes: input.notes,
              closed: false,
              createdAt: iso,
              updatedAt: iso,
            },
            ...s.sessions,
          ],
        }));
        return id;
      },

      updateSession(id, patch) {
        const iso = nowIso();
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: iso } : x
          ),
        }));
      },

      closeSession(id) {
        const iso = nowIso();
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, closed: true, updatedAt: iso } : x
          ),
        }));
      },

      addChallenge(input) {
        const stBefore = get();
        const wf = input.identityId?.trim() ?? "";
        if (
          wf === "" ||
          !stBefore.identities.some((x) => x.id === wf)
        ) {
          return null;
        }
        const id = newId();
        const iso = nowIso();
        set((s) => {
          let name = input.name?.trim() ?? "";
          if (!name) {
            const idx = s.challenges.length + 1;
            name = `#${String(idx).padStart(4, "0")}`;
          }
          const challenges: Challenge[] = [
            {
              ...input,
              name,
              id,
              createdAt: iso,
              updatedAt: iso,
            },
            ...s.challenges,
          ];
          return {
            challenges: reconcileChallengeAutoStatus(
              challenges,
              s.trades,
              s.pairs
            ),
          };
        });
        return id;
      },

      updateChallenge(id, patch) {
        const prev = get().challenges.find((c) => c.id === id);
        if (!prev) return;
        const iso = nowIso();
        const effectivePatch = { ...patch };
        if (
          patch.status !== undefined &&
          patch.status !== prev.status &&
          !isValidChallengeStatusTransition(prev.status, patch.status)
        ) {
          delete effectivePatch.status;
        }
        if (
          effectivePatch.identityId != null &&
          effectivePatch.identityId.trim() !== "" &&
          !get().identities.some((x) => x.id === effectivePatch.identityId)
        ) {
          delete effectivePatch.identityId;
        }
        set((s) => {
          const next = s.challenges.map((c) =>
            c.id === id ? { ...c, ...effectivePatch, updatedAt: iso } : c
          );
          const self = next.find((c) => c.id === id);
          const identityMoved =
            self != null &&
            prev.identityId !== self.identityId &&
            self.identityId.trim() !== "";
          let trades = s.trades;
          if (identityMoved && self != null) {
            trades = s.trades.map((t) =>
              t.challengeId === id
                ? {
                    ...t,
                    identityId: self.identityId,
                    updatedAt: iso,
                  }
                : t
            );
          }
          const pairs =
            trades !== s.trades
              ? refreshAllPairs(s.pairs, trades)
              : s.pairs;
          return {
            trades,
            pairs,
            challenges: reconcileChallengeAutoStatus(next, trades, pairs),
          };
        });
      },

      deleteChallenge(id) {
        const { trades } = get();
        if (trades.some((t) => t.challengeId === id)) return false;
        set((s) => ({
          challenges: s.challenges.filter((c) => c.id !== id),
        }));
        return true;
      },

      deleteChallengeCascade(challengeId) {
        const s = get();
        const pairsFor = getPairsByChallengeId(challengeId, s.trades, s.pairs);
        const tradeIds = new Set<string>();
        for (const t of s.trades) {
          if (t.challengeId === challengeId) tradeIds.add(t.id);
        }
        for (const p of pairsFor) {
          tradeIds.add(p.personalTradeId);
        }
        for (const tid of tradeIds) {
          const t = s.trades.find((x) => x.id === tid);
          if (t && isSessionClosed(s.sessions, t.sessionId)) return false;
        }
        const pairIds = new Set(pairsFor.map((p) => p.id));
        set((st) => {
          const trades = st.trades.filter((t) => !tradeIds.has(t.id));
          const pairs = refreshAllPairs(
            st.pairs.filter((p) => !pairIds.has(p.id)),
            trades
          );
          const challenges = st.challenges.filter(
            (c) => c.id !== challengeId
          );
          return {
            trades,
            pairs,
            challenges: reconcileChallengeAutoStatus(
              challenges,
              trades,
              pairs
            ),
          };
        });
        return true;
      },

      addTrade(input) {
        const stGate = get();
        if (isSessionClosed(stGate.sessions, input.sessionId)) return null;

        let identityIdResolved = "";
        if (input.challengeId != null) {
          const ch = stGate.challenges.find((c) => c.id === input.challengeId);
          if (!ch || !challengeAcceptsNewPropTrades(ch)) return null;
          identityIdResolved = ch.identityId.trim();
          if (
            identityIdResolved === "" ||
            !stGate.identities.some((x) => x.id === identityIdResolved)
          ) {
            return null;
          }
        } else {
          identityIdResolved = input.identityId?.trim() ?? "";
          if (
            identityIdResolved === "" ||
            !stGate.identities.some((x) => x.id === identityIdResolved)
          ) {
            return null;
          }
        }

        const id = newId();
        const iso = nowIso();
        set((s) => {
          const row: LogTrade = {
            ...input,
            identityId: identityIdResolved,
            id,
            createdAt: iso,
            updatedAt: iso,
          };
          const trades = [row, ...s.trades];
          const pairs = refreshAllPairs(s.pairs, trades);
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            trades,
            pairs
          );
          return { trades, pairs, challenges };
        });
        return id;
      },

      updateTrade(id, patch) {
        const prev = get().trades.find((t) => t.id === id);
        if (!prev) return;
        const nextSessionId =
          patch.sessionId !== undefined ? patch.sessionId : prev.sessionId;
        if (
          isSessionClosed(get().sessions, prev.sessionId) ||
          isSessionClosed(get().sessions, nextSessionId)
        ) {
          return;
        }
        const pairTouch = tradeInPair(get().pairs, id);
        if (
          pairTouch &&
          patch.challengeId !== undefined &&
          patch.challengeId !== prev.challengeId
        ) {
          return;
        }
        const iso = nowIso();
        set((s) => {
          const trades = s.trades.map((t) => {
            if (t.id !== id) return t;
            let nextRow: LogTrade = { ...t, ...patch, updatedAt: iso };
            if (nextRow.challengeId != null) {
              const ch = s.challenges.find((c) => c.id === nextRow.challengeId);
              if (ch) {
                nextRow = { ...nextRow, identityId: ch.identityId };
              }
            }
            return nextRow;
          });
          const pairs = refreshAllPairs(s.pairs, trades);
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            trades,
            pairs
          );
          return { trades, pairs, challenges };
        });
      },

      deleteTrade(id) {
        const prev = get().trades.find((t) => t.id === id);
        if (!prev) return;
        if (isSessionClosed(get().sessions, prev.sessionId)) return;
        set((s) => {
          const trades = s.trades.filter((t) => t.id !== id);
          const pairs = refreshAllPairs(
            s.pairs.filter(
              (p) => p.propTradeId !== id && p.personalTradeId !== id
            ),
            trades
          );
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            trades,
            pairs
          );
          return { trades, pairs, challenges };
        });
      },

      linkPair(propTradeId, personalTradeId) {
        if (propTradeId === personalTradeId) return null;
        const { pairs, trades } = get();
        if (
          pairs.some(
            (p) =>
              p.propTradeId === propTradeId ||
              p.personalTradeId === personalTradeId ||
              p.propTradeId === personalTradeId ||
              p.personalTradeId === propTradeId
          )
        ) {
          return null;
        }
        const pt = trades.find((t) => t.id === propTradeId);
        const ht = trades.find((t) => t.id === personalTradeId);
        if (!pt || !ht || !isValidHedgePairLegs(pt, ht)) return null;
        if (pt.challengeId != null) {
          const ch = get().challenges.find((c) => c.id === pt.challengeId);
          if (!ch || !challengeAcceptsNewPropTrades(ch)) return null;
        }

        const propWsRaw =
          pt.challengeId != null
            ? get().challenges.find((x) => x.id === pt.challengeId)
                ?.identityId ?? ""
            : pt.identityId;
        const propWs = propWsRaw.trim();
        if (propWs === "") return null;

        const perWs = ht.identityId.trim();
        if (perWs !== "" && perWs !== propWs) return null;

        const id = newId();
        const iso = nowIso();
        const phaseNumber =
          pt.challengeId != null
            ? getPairsByChallengeId(pt.challengeId, trades, pairs).length + 1
            : 1;
        const pair: HedgePair = {
          id,
          phaseNumber,
          propTradeId,
          personalTradeId,
          combinedPnl: 0,
          status: "open",
          manuallySetStatus: false,
          createdAt: iso,
          updatedAt: iso,
        };
        set((s) => {
          const tradesSynced = s.trades.map((tr) =>
            tr.id === personalTradeId
              ? { ...tr, identityId: propWs, updatedAt: iso }
              : tr
          );
          const map = new Map(tradesSynced.map((t) => [t.id, t] as const));
          const updated = recomputePair(pair, map);
          const pairsNext = [updated, ...s.pairs];
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            tradesSynced,
            pairsNext
          );
          return { trades: tradesSynced, pairs: pairsNext, challenges };
        });
        return id;
      },

      unlinkPair(pairId) {
        set((s) => {
          const pairs = s.pairs.filter((p) => p.id !== pairId);
          const pairsRefreshed = refreshAllPairs(pairs, s.trades);
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            s.trades,
            pairsRefreshed
          );
          return { pairs: pairsRefreshed, challenges };
        });
      },

      deleteHedgePairCascade(pairId) {
        const pair = get().pairs.find((p) => p.id === pairId);
        if (!pair) return false;
        const propT = get().trades.find((t) => t.id === pair.propTradeId);
        const perT = get().trades.find((t) => t.id === pair.personalTradeId);
        if (
          (propT && isSessionClosed(get().sessions, propT.sessionId)) ||
          (perT && isSessionClosed(get().sessions, perT.sessionId))
        ) {
          return false;
        }
        const propId = pair.propTradeId;
        const perId = pair.personalTradeId;
        set((s) => {
          const trades = s.trades.filter(
            (t) => t.id !== propId && t.id !== perId
          );
          const pairs = refreshAllPairs(
            s.pairs.filter((p) => p.id !== pairId),
            trades
          );
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            trades,
            pairs
          );
          return { trades, pairs, challenges };
        });
        return true;
      },

      updatePair(id, patch) {
        set((s) => {
          const pairs = s.pairs.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p
          );
          const pairsRefreshed = refreshAllPairs(pairs, s.trades);
          const challenges = reconcileChallengeAutoStatus(
            s.challenges,
            s.trades,
            pairsRefreshed
          );
          return { pairs: pairsRefreshed, challenges };
        });
      },

      getTrade(id) {
        return get().trades.find((t) => t.id === id);
      },

      getSession(id) {
        return get().sessions.find((s) => s.id === id);
      },

      getChallenge(id) {
        return get().challenges.find((c) => c.id === id);
      },

      getIdentity(id) {
        return get().identities.find((i) => i.id === id);
      },
    }),
    {
      name: TRADE_LOG_ROOT_KEY,
      storage: createJSONStorage(() => persistStorage),
      partialize: (st) => ({
        sessions: st.sessions,
        trades: st.trades,
        pairs: st.pairs,
        challenges: st.challenges,
        identities: st.identities,
        activeIdentityId: st.activeIdentityId,
      }),
      version: STORAGE_VERSION,
      migrate: (persisted, fromVersion) => {
        const p = persisted as {
          sessions?: unknown;
          trades?: unknown;
          pairs?: unknown;
          challenges?: Challenge[];
          identities?: Identity[];
          activeIdentityId?: string | null;
        };
        let challenges = p.challenges ?? [];
        if (fromVersion < 2) {
          challenges = challenges ?? [];
        }
        if (fromVersion < 3) {
          challenges = challenges.map((c) => ({
            ...c,
            payoutAmount: c.payoutAmount ?? null,
            payoutAt: c.payoutAt ?? null,
          }));
        }
        if (fromVersion < 4) {
          challenges = challenges.map((c) => ({
            ...c,
            disbursementAt: (c as { disbursementAt?: string | null }).disbursementAt ?? null,
            ledgerPhases: normalizeLedgerPhases(
              (c as { ledgerPhases?: unknown }).ledgerPhases
            ),
          }));
        }
        const rawTrades = p.trades;
        let trades: LogTrade[] = Array.isArray(rawTrades)
          ? (rawTrades as LogTrade[])
          : [];
        if (fromVersion < 5) {
          trades = trades.map((t) => ({
            ...t,
            directPnl:
              (t as { directPnl?: number | null }).directPnl !== undefined
                ? (t as { directPnl?: number | null }).directPnl ?? null
                : null,
          }));
        }
        let pairs: HedgePair[] = Array.isArray(p.pairs)
          ? (p.pairs as HedgePair[])
          : [];
        if (fromVersion < 6) {
          pairs = assignPhaseNumbersToPairs(trades, pairs);
        }
        if (fromVersion < 7) {
          const personalIds = new Set(
            pairs.map((x) => x.personalTradeId)
          );
          trades = trades.map((t) =>
            personalIds.has(t.id) ? { ...t, challengeId: null } : t
          );
        }

        const identitiesMigrate: Identity[] = Array.isArray(p.identities)
          ? [...p.identities]
          : [];
        const activeMigrate: string | null =
          typeof p.activeIdentityId === "string"
            ? p.activeIdentityId
            : null;

        const synced = ensureIdentityConsistency({
          identities: identitiesMigrate,
          challenges,
          trades,
          pairs,
          activeIdentityId: activeMigrate,
          nowIso,
        });

        return {
          ...p,
          challenges: synced.challenges,
          trades: synced.trades,
          pairs,
          identities: synced.identities,
          activeIdentityId: synced.activeIdentityId,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error != null || state == null) return;
        hydrateTradeLogFromCsvSlice(state);
      },
    }
  )
);

/** Re-run post-load repairs (same as persisted rehydrate) after CSV imports. */
export function hydrateTradeLogFromCsvSlice(slice: PersistedTradeLogSlice) {
  useTradingStore.setState(repairHydratedPersistedTradeLogSlice(slice));
}

/** Download persisted journal shape as JSON (browser only). */
export async function downloadTradeLogBackupJson(): Promise<void> {
  if (typeof window === "undefined") return;

  let json: string;
  try {
    const st = useTradingStore.getState();
    const payload = {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      sessions: st.sessions,
      trades: st.trades,
      pairs: st.pairs,
      challenges: st.challenges,
      identities: st.identities,
      activeIdentityId: st.activeIdentityId,
    };
    json = JSON.stringify(payload, null, 2);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not serialize journal.";
    window.alert(`Export failed: ${msg}`);
    return;
  }

  const filename = `trade-log-backup-${new Date().toISOString().slice(0, 10)}.json`;

  const win = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };

  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Journal backup",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([json], { type: "application/json;charset=utf-8" }));
      await writable.close();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      /* fall through to download link — e.g. permission or unsupported edge case */
    }
  }

  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.setAttribute("download", filename);
  a.style.cssText = "position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 600);
}

/**
 * Replace the running journal from a JSON backup (same shape as download).
 * Persists to localStorage unless CSV folder sync is active; then flushes the folder.
 */
export async function importTradeLogBackupJsonText(
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseTradeLogBackupJsonText(text);
  if (!parsed.ok) return parsed;

  hydrateTradeLogFromCsvSlice(parsed.slice);

  const st = useTradingStore.getState();
  const slice: PersistedTradeLogSlice = {
    sessions: st.sessions,
    trades: st.trades,
    pairs: st.pairs,
    challenges: st.challenges,
    identities: st.identities,
    activeIdentityId: st.activeIdentityId,
  };

  if (!isTradeLogSkipLocalWrites()) {
    persistTradeLogSliceToLocalKeys(slice);
  }

  const sync = await import("./workspace-csv-sync");
  if (sync.getActiveWorkspaceCsvRoot() != null) {
    const flushed = await sync.flushTradeLogWorkspaceCsvNow();
    if (!flushed) {
      return {
        ok: false,
        error:
          "Backup loaded in this browser, but the linked workspace folder could not be written. Re-open Data and allow folder access, or send the JSON file to your colleague instead.",
      };
    }
  }

  return { ok: true };
}

/** Wipes sessions, trades, pairs, challenges and browser `localStorage` keys for this journal. */
export function resetTradeLogWorkspace() {
  useTradingStore.setState({
    sessions: [],
    trades: [],
    pairs: [],
    challenges: [],
    identities: [],
    activeIdentityId: null,
  });
  useTradingStore.persist.clearStorage();
}

// Alias for plan wording
export type TradingState = TradeLogState;
