/**
 * Supabase-backed Zustand store for trading journal
 * 
 * This replaces localStorage persistence with Supabase database operations.
 * State is kept in memory for fast reads, with background syncs to Supabase.
 */

"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAllUserData,
  createIdentity,
  updateIdentity,
  deleteIdentity,
  createSession,
  updateSession,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  createTrade,
  updateTrade,
  deleteTrade,
  createHedgePair,
  updateHedgePair,
  deleteHedgePair,
  createPhasePlan,
  updatePhasePlan,
  deletePhasePlan,
  updateUserSettings,
} from "@/lib/supabase/queries";

import {
  assignPhaseNumbersToPairs,
  challengeAcceptsNewPropTrades,
  getPairsByChallengeId,
  isValidChallengeStatusTransition,
} from "./challenges";
import { refreshAllPairs, recomputePair, isValidHedgePairLegs } from "./pairs";
import {
  processLoadedJournalData,
  type LoadedJournalData,
} from "@/lib/trading/process-loaded-journal-data";
import { clearLegacyTradeLogLocalStorage } from "./storage";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
  PairStatus,
  PhasePlan,
  PhasePlanCreateInput,
} from "./types";

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
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
  // Data
  sessions: LogSession[];
  trades: LogTrade[];
  pairs: HedgePair[];
  challenges: Challenge[];
  identities: Identity[];
  plans: PhasePlan[];
  activeIdentityId: string | null;

  // Loading states
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  // Initialization
  hydrate: () => Promise<void>;
  seedFromServer: (data: LoadedJournalData) => void;

  // Identity operations
  setActiveIdentityId: (identityId: string | null) => Promise<void>;
  addIdentity: (input: Pick<Identity, "name" | "note">) => Promise<string | null>;
  updateIdentity: (
    id: string,
    patch: Partial<Pick<Identity, "name" | "note">>
  ) => Promise<void>;
  deleteIdentity: (id: string) => Promise<boolean>;

  // Session operations
  addSession: (input: Pick<LogSession, "date" | "notes">) => Promise<string | null>;
  updateSession: (
    id: string,
    patch: Partial<Pick<LogSession, "date" | "notes" | "closed">>
  ) => Promise<void>;
  closeSession: (id: string) => Promise<void>;

  // Challenge operations
  addChallenge: (
    input: Omit<Challenge, "id" | "createdAt" | "updatedAt"> & {
      createdAt?: string;
    }
  ) => Promise<string | null>;
  updateChallenge: (
    id: string,
    patch: Partial<Omit<Challenge, "id">>
  ) => Promise<void>;
  deleteChallenge: (id: string) => Promise<boolean>;
  deleteChallengeCascade: (challengeId: string) => Promise<boolean>;

  // Trade operations
  addTrade: (input: Omit<LogTrade, "id" | "createdAt" | "updatedAt">) => Promise<string | null>;
  updateTrade: (id: string, patch: Partial<Omit<LogTrade, "id">>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;

  // Pair operations
  linkPair: (propTradeId: string, personalTradeId: string) => Promise<string | null>;
  unlinkPair: (pairId: string) => Promise<void>;
  deleteHedgePairCascade: (pairId: string) => Promise<boolean>;
  updatePair: (
    id: string,
    patch: { manuallySetStatus?: boolean; status?: PairStatus }
  ) => Promise<void>;

  // Plan operations
  addPlan: (input: PhasePlanCreateInput) => Promise<string | null>;
  updatePlan: (id: string, patch: Partial<Omit<PhasePlan, "id">>) => Promise<void>;
  deletePlan: (id: string) => Promise<boolean>;
  linkPlanToHedgePair: (planId: string, hedgePairId: string) => Promise<void>;

  // Getters
  getTrade: (id: string) => LogTrade | undefined;
  getSession: (id: string) => LogSession | undefined;
  getChallenge: (id: string) => Challenge | undefined;
  getIdentity: (id: string) => Identity | undefined;
  getPlan: (id: string) => PhasePlan | undefined;
};

let hydrateInFlight: Promise<void> | null = null;

export const useTradingStore = create<TradeLogState>((set, get) => ({
  // Initial state
  sessions: [],
  trades: [],
  pairs: [],
  challenges: [],
  identities: [],
  plans: [],
  activeIdentityId: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  seedFromServer: (data) => {
    clearLegacyTradeLogLocalStorage();
    const processed = processLoadedJournalData(data);
    set({
      identities: processed.identities,
      challenges: processed.challenges,
      trades: processed.trades,
      pairs: processed.pairs,
      sessions: processed.sessions,
      plans: processed.plans,
      activeIdentityId: processed.activeIdentityId,
      isHydrated: true,
      isLoading: false,
      error: null,
    });
  },

  // Hydrate store from Supabase (client fallback / manual refresh)
  hydrate: async () => {
    if (get().isHydrated && !get().error) return;
    if (hydrateInFlight) return hydrateInFlight;

    hydrateInFlight = (async () => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch("/api/journal/data", {
          credentials: "same-origin",
        });

        if (response.ok) {
          const payload = (await response.json()) as { data: LoadedJournalData };
          get().seedFromServer(payload.data);
          return;
        }

        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          set({
            error: authError?.message ?? "Not authenticated",
            isLoading: false,
            isHydrated: true,
          });
          return;
        }

        const result = await fetchAllUserData(supabase);

        if (result.error || !result.data) {
          set({
            error: result.error ?? "Failed to load data",
            isLoading: false,
            isHydrated: true,
          });
          return;
        }

        get().seedFromServer(result.data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load data";
        set({ error: message, isLoading: false, isHydrated: true });
      } finally {
        hydrateInFlight = null;
        const state = get();
        if (state.isLoading) {
          set({ isLoading: false, isHydrated: true });
        }
      }
    })();

    return hydrateInFlight;
  },

  setActiveIdentityId: async (identityId) => {
    const st = get();
    if (
      identityId != null &&
      identityId.trim() !== "" &&
      !st.identities.some((x) => x.id === identityId)
    ) {
      return;
    }

    const normalized = identityId == null || identityId.trim() === "" ? null : identityId;
    
    const supabase = createClient();
    const result = await updateUserSettings(supabase, normalized);
    
    if (result.error) {
      console.error("Failed to update active identity:", result.error);
      return;
    }

    set({ activeIdentityId: normalized });
  },

  addIdentity: async (input) => {
    const id = newId();
    const iso = nowIso();
    const newIdentity: Identity = {
      id,
      name: input.name.trim() || "Untitled workspace",
      note: input.note?.trim() ?? "",
      createdAt: iso,
      updatedAt: iso,
    };

    // Optimistic update
    set((s) => ({
      identities: [newIdentity, ...s.identities],
    }));

    const supabase = createClient();
    const result = await createIdentity(supabase, newIdentity);

    if (result.error) {
      // Rollback
      set((s) => ({
        identities: s.identities.filter((x) => x.id !== id),
      }));
      console.error("Failed to create identity:", result.error);
      return null;
    }

    // Replace optimistic with server data
    set((s) => ({
      identities: s.identities.map((x) => (x.id === id ? result.data! : x)),
    }));

    return id;
  },

  updateIdentity: async (id, patch) => {
    const iso = nowIso();
    const prev = get().identities.find((x) => x.id === id);
    if (!prev) return;

    // Optimistic update
    set((s) => ({
      identities: s.identities.map((x) =>
        x.id === id ? { ...x, ...patch, updatedAt: iso } : x
      ),
    }));

    const supabase = createClient();
    const result = await updateIdentity(supabase, id, patch);

    if (result.error) {
      // Rollback
      set((s) => ({
        identities: s.identities.map((x) => (x.id === id ? prev : x)),
      }));
      console.error("Failed to update identity:", result.error);
    }
  },

  deleteIdentity: async (id) => {
    const s = get();
    if (s.identities.length <= 1) return false;

    const challengeIds = new Set(
      s.challenges.filter((c) => c.identityId === id).map((c) => c.id)
    );

    const tradeIds = new Set<string>();
    for (const t of s.trades) {
      if (t.identityId === id) tradeIds.add(t.id);
      if (t.challengeId != null && challengeIds.has(t.challengeId)) {
        tradeIds.add(t.id);
      }
    }

    for (const p of s.pairs) {
      if (tradeIds.has(p.propTradeId) || tradeIds.has(p.personalTradeId)) {
        tradeIds.add(p.propTradeId);
        tradeIds.add(p.personalTradeId);
      }
    }

    const pairIds = new Set(
      s.pairs
        .filter(
          (p) =>
            tradeIds.has(p.propTradeId) || tradeIds.has(p.personalTradeId)
        )
        .map((p) => p.id)
    );

    const identities = s.identities.filter((x) => x.id !== id);
    const defaultIdentityId = identities[0]?.id;
    if (!defaultIdentityId) return false;

    const supabase = createClient();
    const tradeIdList = Array.from(tradeIds);

    if (tradeIdList.length > 0) {
      const { error: tradesError } = await supabase
        .from("trades")
        .delete()
        .in("id", tradeIdList);

      if (tradesError) {
        console.error("Failed to delete workspace trades:", tradesError.message);
        return false;
      }
    }

    const result = await deleteIdentity(supabase, id);

    if (result.error) {
      console.error("Failed to delete identity:", result.error);
      return false;
    }

    const trades = s.trades.filter((t) => !tradeIds.has(t.id));
    const pairs = refreshAllPairs(
      s.pairs.filter((p) => !pairIds.has(p.id)),
      trades
    );
    const challenges = s.challenges.filter((c) => c.identityId !== id);
    const plans = s.plans.filter((p) => !challengeIds.has(p.challengeId));

    let activeIdentityId = s.activeIdentityId;
    if (activeIdentityId === id) {
      activeIdentityId = defaultIdentityId;
      await get().setActiveIdentityId(defaultIdentityId);
    }

    set({
      identities,
      challenges,
      trades,
      pairs,
      plans,
      activeIdentityId,
    });
    return true;
  },

  addSession: async (input) => {
    const id = newId();
    const iso = nowIso();
    const newSession: LogSession = {
      id,
      date: input.date,
      notes: input.notes,
      closed: false,
      createdAt: iso,
      updatedAt: iso,
    };

    set((s) => ({
      sessions: [newSession, ...s.sessions],
    }));

    const supabase = createClient();
    const result = await createSession(supabase, newSession);

    if (result.error) {
      set((s) => ({
        sessions: s.sessions.filter((x) => x.id !== id),
      }));
      console.error("Failed to create session:", result.error);
      return null;
    }

    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? result.data! : x)),
    }));

    return id;
  },

  updateSession: async (id, patch) => {
    const iso = nowIso();
    const prev = get().sessions.find((x) => x.id === id);
    if (!prev) return;

    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id ? { ...x, ...patch, updatedAt: iso } : x
      ),
    }));

    const supabase = createClient();
    const result = await updateSession(supabase, id, patch);

    if (result.error) {
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === id ? prev : x)),
      }));
      console.error("Failed to update session:", result.error);
    }
  },

  closeSession: async (id) => {
    await get().updateSession(id, { closed: true });
  },

  addChallenge: async (input) => {
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
    const createdAt =
      typeof input.createdAt === "string" && input.createdAt.trim() !== ""
        ? input.createdAt.trim()
        : iso;

    let name = input.name?.trim() ?? "";
    if (!name) {
      const idx = stBefore.challenges.length + 1;
      name = `#${String(idx).padStart(4, "0")}`;
    }

    const newChallenge: Challenge = {
      ...input,
      name,
      id,
      createdAt,
      updatedAt: iso,
    };

    set((s) => ({
      challenges: [newChallenge, ...s.challenges],
    }));

    const supabase = createClient();
    const result = await createChallenge(supabase, newChallenge);

    if (result.error) {
      set((s) => ({
        challenges: s.challenges.filter((x) => x.id !== id),
      }));
      console.error("Failed to create challenge:", result.error);
      return null;
    }

    set((s) => ({
      challenges: s.challenges.map((x) => (x.id === id ? result.data! : x)),
    }));

    return id;
  },

  updateChallenge: async (id, patch) => {
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

    set((s) => ({
      challenges: s.challenges.map((c) =>
        c.id === id ? { ...c, ...effectivePatch, updatedAt: iso } : c
      ),
    }));

    const supabase = createClient();
    const result = await updateChallenge(supabase, id, effectivePatch);

    if (result.error) {
      set((s) => ({
        challenges: s.challenges.map((c) => (c.id === id ? prev : c)),
      }));
      console.error("Failed to update challenge:", result.error);
    }
  },

  deleteChallenge: async (id) => {
    const { trades } = get();
    if (trades.some((t) => t.challengeId === id)) return false;

    const supabase = createClient();
    const result = await deleteChallenge(supabase, id);

    if (result.error) {
      console.error("Failed to delete challenge:", result.error);
      return false;
    }

    set((s) => ({
      challenges: s.challenges.filter((c) => c.id !== id),
    }));

    return true;
  },

  deleteChallengeCascade: async (challengeId) => {
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

    // Delete via API (cascade handled by DB)
    const supabase = createClient();
    const result = await deleteChallenge(supabase, challengeId);

    if (result.error) {
      console.error("Failed to delete challenge cascade:", result.error);
      return false;
    }

    // Update local state
    const trades = s.trades.filter((t) => !tradeIds.has(t.id));
    const pairs = s.pairs.filter((p) => !pairsFor.some((pf) => pf.id === p.id));
    const challenges = s.challenges.filter((c) => c.id !== challengeId);

    set({ trades, pairs, challenges });
    return true;
  },

  addTrade: async (input) => {
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
    const newTrade: LogTrade = {
      ...input,
      identityId: identityIdResolved,
      id,
      createdAt: iso,
      updatedAt: iso,
    };

    set((s) => ({
      trades: [newTrade, ...s.trades],
    }));

    const supabase = createClient();
    const result = await createTrade(supabase, newTrade);

    if (result.error) {
      set((s) => ({
        trades: s.trades.filter((t) => t.id !== id),
      }));
      console.error("Failed to create trade:", result.error);
      return null;
    }

    set((s) => ({
      trades: s.trades.map((t) => (t.id === id ? result.data! : t)),
    }));

    return id;
  },

  updateTrade: async (id, patch) => {
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
    let nextRow: LogTrade = { ...prev, ...patch, updatedAt: iso };
    
    if (nextRow.challengeId != null) {
      const ch = get().challenges.find((c) => c.id === nextRow.challengeId);
      if (ch) {
        nextRow = { ...nextRow, identityId: ch.identityId };
      }
    }

    set((s) => ({
      trades: s.trades.map((t) => (t.id === id ? nextRow : t)),
    }));

    const supabase = createClient();
    const result = await updateTrade(supabase, id, patch);

    if (result.error) {
      set((s) => ({
        trades: s.trades.map((t) => (t.id === id ? prev : t)),
      }));
      console.error("Failed to update trade:", result.error);
    }
  },

  deleteTrade: async (id) => {
    const prev = get().trades.find((t) => t.id === id);
    if (!prev) return;
    if (isSessionClosed(get().sessions, prev.sessionId)) return;

    const supabase = createClient();
    const result = await deleteTrade(supabase, id);

    if (result.error) {
      console.error("Failed to delete trade:", result.error);
      return;
    }

    set((s) => ({
      trades: s.trades.filter((t) => t.id !== id),
      pairs: s.pairs.filter(
        (p) => p.propTradeId !== id && p.personalTradeId !== id
      ),
    }));
  },

  linkPair: async (propTradeId, personalTradeId) => {
    if (propTradeId === personalTradeId) return null;
    const { pairs, trades, challenges } = get();

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
      const ch = challenges.find((c) => c.id === pt.challengeId);
      if (!ch || !challengeAcceptsNewPropTrades(ch)) return null;
    }

    const propWsRaw =
      pt.challengeId != null
        ? challenges.find((x) => x.id === pt.challengeId)?.identityId ?? ""
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

    const newPair: HedgePair = {
      id,
      phaseNumber,
      propTradeId,
      personalTradeId,
      combinedPnl: 0,
      status: "open",
      manuallySetStatus: false,
      planId: null,
      createdAt: iso,
      updatedAt: iso,
    };

    set((s) => ({
      pairs: [newPair, ...s.pairs],
    }));

    const supabase = createClient();
    const result = await createHedgePair(supabase, newPair);

    if (result.error) {
      set((s) => ({
        pairs: s.pairs.filter((p) => p.id !== id),
      }));
      console.error("Failed to create hedge pair:", result.error);
      return null;
    }

    set((s) => ({
      pairs: s.pairs.map((p) => (p.id === id ? result.data! : p)),
    }));

    return id;
  },

  unlinkPair: async (pairId) => {
    const supabase = createClient();
    const result = await deleteHedgePair(supabase, pairId);

    if (result.error) {
      console.error("Failed to unlink pair:", result.error);
      return;
    }

    set((s) => ({
      pairs: s.pairs.filter((p) => p.id !== pairId),
    }));
  },

  deleteHedgePairCascade: async (pairId) => {
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

    const supabase = createClient();
    const result = await deleteHedgePair(supabase, pairId);

    if (result.error) {
      console.error("Failed to delete hedge pair cascade:", result.error);
      return false;
    }

    const propId = pair.propTradeId;
    const perId = pair.personalTradeId;

    set((s) => ({
      trades: s.trades.filter((t) => t.id !== propId && t.id !== perId),
      pairs: s.pairs.filter((p) => p.id !== pairId),
    }));

    return true;
  },

  updatePair: async (id, patch) => {
    const prev = get().pairs.find((p) => p.id === id);
    if (!prev) return;

    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p
      ),
    }));

    const supabase = createClient();
    const result = await updateHedgePair(supabase, id, patch);

    if (result.error) {
      set((s) => ({
        pairs: s.pairs.map((p) => (p.id === id ? prev : p)),
      }));
      console.error("Failed to update pair:", result.error);
    }
  },

  addPlan: async (input) => {
    const stGate = get();
    const challenge = stGate.challenges.find((c) => c.id === input.challengeId);
    if (!challenge || !challengeAcceptsNewPropTrades(challenge)) return null;

    if (input.propTpUsd <= 0 || input.propSlUsd <= 0) return null;
    if (input.personalTargetProfit <= 0 || input.personalPointValue <= 0)
      return null;
    if (input.lotStep <= 0 || input.minLot <= 0) return null;

    const id = newId();
    const iso = nowIso();
    const newPlan: PhasePlan = {
      ...input,
      id,
      createdAt: iso,
      updatedAt: iso,
    };

    set((s) => ({
      plans: [newPlan, ...s.plans],
    }));

    const supabase = createClient();
    const result = await createPhasePlan(supabase, newPlan);

    if (result.error) {
      set((s) => ({
        plans: s.plans.filter((p) => p.id !== id),
      }));
      console.error("Failed to create plan:", result.error);
      return null;
    }

    set((s) => ({
      plans: s.plans.map((p) => (p.id === id ? result.data! : p)),
    }));

    return id;
  },

  updatePlan: async (id, patch) => {
    const iso = nowIso();
    const prev = get().plans.find((p) => p.id === id);
    if (!prev) return;

    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: iso } : p
      ),
    }));

    const supabase = createClient();
    const result = await updatePhasePlan(supabase, id, patch);

    if (result.error) {
      set((s) => ({
        plans: s.plans.map((p) => (p.id === id ? prev : p)),
      }));
      console.error("Failed to update plan:", result.error);
    }
  },

  deletePlan: async (id) => {
    const supabase = createClient();
    const result = await deletePhasePlan(supabase, id);

    if (result.error) {
      console.error("Failed to delete plan:", result.error);
      return false;
    }

    set((s) => ({
      plans: s.plans.filter((p) => p.id !== id),
    }));

    return true;
  },

  linkPlanToHedgePair: async (planId, hedgePairId) => {
    const iso = nowIso();

    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? { ...p, hedgePairId, status: "open" as const, updatedAt: iso }
          : p
      ),
      pairs: s.pairs.map((pair) =>
        pair.id === hedgePairId ? { ...pair, planId, updatedAt: iso } : pair
      ),
    }));

    const supabase = createClient();
    await Promise.all([
      updatePhasePlan(supabase, planId, { hedgePairId, status: "open" }),
      updateHedgePair(supabase, hedgePairId, { planId }),
    ]);
  },

  getTrade: (id) => get().trades.find((t) => t.id === id),
  getSession: (id) => get().sessions.find((s) => s.id === id),
  getChallenge: (id) => get().challenges.find((c) => c.id === id),
  getIdentity: (id) => get().identities.find((i) => i.id === id),
  getPlan: (id) => get().plans.find((p) => p.id === id),
}));

export type TradingState = TradeLogState;
