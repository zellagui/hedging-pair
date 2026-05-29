/**
 * Supabase data access layer for trading journal
 * 
 * All queries automatically filter by user_id via RLS policies.
 * Functions accept a Supabase client instance to work in both
 * server and client contexts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Identity,
  Challenge,
  LogTrade,
  HedgePair,
  LogSession,
  PhasePlan,
} from "@/models/trade-log/types";
import {
  challengeFromDb,
  challengeToDb,
  hedgePairFromDb,
  hedgePairToDb,
  identityFromDb,
  identityToDb,
  patchToDb,
  phasePlanFromDb,
  phasePlanToDb,
  sessionFromDb,
  sessionToDb,
  tradeFromDb,
  tradeToDb,
} from "@/lib/supabase/mappers";

// ============================================================================
// TYPES
// ============================================================================

export type QueryResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export type QueryArrayResult<T> = QueryResult<T[]>;

// Database row types (includes user_id)
export type IdentityRow = Identity & { user_id: string };
export type ChallengeRow = Challenge & { user_id: string };
export type TradeRow = LogTrade & { user_id: string };
export type HedgePairRow = HedgePair & { user_id: string };
export type SessionRow = LogSession & { user_id: string };
export type PhasePlanRow = PhasePlan & { user_id: string };

// Insert types (user_id is injected automatically)
export type IdentityInsert = Omit<IdentityRow, "user_id">;
export type ChallengeInsert = Omit<ChallengeRow, "user_id">;
export type TradeInsert = Omit<TradeRow, "user_id">;
export type HedgePairInsert = Omit<HedgePairRow, "user_id">;
export type SessionInsert = Omit<SessionRow, "user_id">;
export type PhasePlanInsert = Omit<PhasePlanRow, "user_id">;

// ============================================================================
// IDENTITIES (Workspaces)
// ============================================================================

export async function fetchIdentities(
  supabase: SupabaseClient
): Promise<QueryArrayResult<Identity>> {
  const { data, error } = await supabase
    .from("identities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map(identityFromDb), error: null };
}

export async function createIdentity(
  supabase: SupabaseClient,
  identity: IdentityInsert
): Promise<QueryResult<Identity>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("identities")
    .insert(identityToDb(identity, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: identityFromDb(data), error: null };
}

export async function updateIdentity(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Identity, "name" | "note">>
): Promise<QueryResult<Identity>> {
  const { data, error } = await supabase
    .from("identities")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: identityFromDb(data), error: null };
}

export async function deleteIdentity(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("identities").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// CHALLENGES
// ============================================================================

export async function fetchChallenges(
  supabase: SupabaseClient,
  identityId?: string
): Promise<QueryArrayResult<Challenge>> {
  let query = supabase
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false });

  if (identityId) {
    query = query.eq("identity_id", identityId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map(challengeFromDb), error: null };
}

export async function createChallenge(
  supabase: SupabaseClient,
  challenge: ChallengeInsert
): Promise<QueryResult<Challenge>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert(challengeToDb(challenge, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: challengeFromDb(data), error: null };
}

export async function updateChallenge(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<Challenge, "id">>
): Promise<QueryResult<Challenge>> {
  const { data, error } = await supabase
    .from("challenges")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: challengeFromDb(data), error: null };
}

export async function deleteChallenge(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("challenges").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// TRADES
// ============================================================================

export async function fetchTrades(
  supabase: SupabaseClient,
  filters?: {
    identityId?: string;
    challengeId?: string;
    sessionId?: string;
  }
): Promise<QueryArrayResult<LogTrade>> {
  let query = supabase
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.identityId) {
    query = query.eq("identity_id", filters.identityId);
  }
  if (filters?.challengeId) {
    query = query.eq("challenge_id", filters.challengeId);
  }
  if (filters?.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map(tradeFromDb), error: null };
}

export async function createTrade(
  supabase: SupabaseClient,
  trade: TradeInsert
): Promise<QueryResult<LogTrade>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("trades")
    .insert(tradeToDb(trade, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: tradeFromDb(data), error: null };
}

export async function updateTrade(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<LogTrade, "id">>
): Promise<QueryResult<LogTrade>> {
  const { data, error } = await supabase
    .from("trades")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: tradeFromDb(data), error: null };
}

export async function deleteTrade(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("trades").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// HEDGE PAIRS
// ============================================================================

export async function fetchHedgePairs(
  supabase: SupabaseClient,
  challengeId?: string
): Promise<QueryArrayResult<HedgePair>> {
  const { data, error } = await supabase
    .from("hedge_pairs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  let pairs = (data ?? []).map(hedgePairFromDb);

  if (challengeId) {
    const tradesResult = await fetchTrades(supabase, { challengeId });
    if (tradesResult.error || !tradesResult.data) {
      return { data: null, error: tradesResult.error ?? "Failed to load trades" };
    }
    const tradeIds = new Set(tradesResult.data.map((t) => t.id));
    pairs = pairs.filter((p) => tradeIds.has(p.propTradeId));
  }

  return { data: pairs, error: null };
}

export async function createHedgePair(
  supabase: SupabaseClient,
  pair: HedgePairInsert
): Promise<QueryResult<HedgePair>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("hedge_pairs")
    .insert(hedgePairToDb(pair, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: hedgePairFromDb(data), error: null };
}

export async function updateHedgePair(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<HedgePair, "id">>
): Promise<QueryResult<HedgePair>> {
  const { data, error } = await supabase
    .from("hedge_pairs")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: hedgePairFromDb(data), error: null };
}

export async function deleteHedgePair(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("hedge_pairs").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// SESSIONS
// ============================================================================

export async function fetchSessions(
  supabase: SupabaseClient
): Promise<QueryArrayResult<LogSession>> {
  const { data, error } = await supabase
    .from("journal_sessions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map(sessionFromDb), error: null };
}

export async function createSession(
  supabase: SupabaseClient,
  session: SessionInsert
): Promise<QueryResult<LogSession>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("journal_sessions")
    .insert(sessionToDb(session, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: sessionFromDb(data), error: null };
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<LogSession, "id">>
): Promise<QueryResult<LogSession>> {
  const { data, error } = await supabase
    .from("journal_sessions")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: sessionFromDb(data), error: null };
}

export async function deleteSession(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("journal_sessions").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// PHASE PLANS
// ============================================================================

export async function fetchPhasePlans(
  supabase: SupabaseClient,
  challengeId?: string
): Promise<QueryArrayResult<PhasePlan>> {
  let query = supabase
    .from("phase_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (challengeId) {
    query = query.eq("challenge_id", challengeId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map(phasePlanFromDb), error: null };
}

export async function createPhasePlan(
  supabase: SupabaseClient,
  plan: PhasePlanInsert
): Promise<QueryResult<PhasePlan>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("phase_plans")
    .insert(phasePlanToDb(plan, user.user.id))
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: phasePlanFromDb(data), error: null };
}

export async function updatePhasePlan(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<PhasePlan, "id">>
): Promise<QueryResult<PhasePlan>> {
  const { data, error } = await supabase
    .from("phase_plans")
    .update({ ...patchToDb(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: phasePlanFromDb(data), error: null };
}

export async function deletePhasePlan(
  supabase: SupabaseClient,
  id: string
): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from("phase_plans").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// USER SETTINGS
// ============================================================================

export async function fetchUserSettings(
  supabase: SupabaseClient
): Promise<QueryResult<{ active_identity_id: string | null }>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("user_journal_settings")
    .select("active_identity_id")
    .eq("user_id", user.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    return { data: null, error: error.message };
  }

  return {
    data: { active_identity_id: data?.active_identity_id ?? null },
    error: null,
  };
}

export async function updateUserSettings(
  supabase: SupabaseClient,
  activeIdentityId: string | null
): Promise<QueryResult<boolean>> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { data: null, error: "User not authenticated" };
  }

  const { error } = await supabase.from("user_journal_settings").upsert(
    {
      user_id: user.user.id,
      active_identity_id: activeIdentityId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Fetch all user data in one batch (for initial load)
 */
export async function fetchAllUserData(supabase: SupabaseClient): Promise<
  QueryResult<{
    identities: Identity[];
    challenges: Challenge[];
    trades: LogTrade[];
    pairs: HedgePair[];
    sessions: LogSession[];
    plans: PhasePlan[];
    activeIdentityId: string | null;
  }>
> {
  const [
    identitiesResult,
    challengesResult,
    tradesResult,
    pairsResult,
    sessionsResult,
    plansResult,
    settingsResult,
  ] = await Promise.all([
    fetchIdentities(supabase),
    fetchChallenges(supabase),
    fetchTrades(supabase),
    fetchHedgePairs(supabase),
    fetchSessions(supabase),
    fetchPhasePlans(supabase),
    fetchUserSettings(supabase),
  ]);

  if (identitiesResult.error) {
    return { data: null, error: identitiesResult.error };
  }
  if (challengesResult.error) {
    return { data: null, error: challengesResult.error };
  }
  if (tradesResult.error) {
    return { data: null, error: tradesResult.error };
  }
  if (pairsResult.error) {
    return { data: null, error: pairsResult.error };
  }
  if (sessionsResult.error) {
    return { data: null, error: sessionsResult.error };
  }
  if (plansResult.error) {
    return { data: null, error: plansResult.error };
  }
  if (settingsResult.error) {
    console.warn("Could not load user settings:", settingsResult.error);
  }

  return {
    data: {
      identities: identitiesResult.data ?? [],
      challenges: challengesResult.data ?? [],
      trades: tradesResult.data ?? [],
      pairs: pairsResult.data ?? [],
      sessions: sessionsResult.data ?? [],
      plans: plansResult.data ?? [],
      activeIdentityId: settingsResult.data?.active_identity_id ?? null,
    },
    error: null,
  };
}
