/**
 * Data migration utilities to import existing JSON backup into Supabase
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  challengeToDb,
  hedgePairToDb,
  identityToDb,
  phasePlanToDb,
  sessionToDb,
  tradeToDb,
} from "@/lib/supabase/mappers";
import type { PersistedTradeLogSlice } from "@/models/trade-log/storage";

export type MigrationResult = {
  success: boolean;
  counts?: {
    identities: number;
    challenges: number;
    trades: number;
    pairs: number;
    sessions: number;
    plans: number;
  };
  skipped?: {
    plans: number;
  };
  warnings?: string[];
  error?: string;
};

const BATCH_SIZE = 500;

function sanitizeBackupForMigration(backup: PersistedTradeLogSlice): {
  slice: PersistedTradeLogSlice;
  warnings: string[];
  skippedPlans: number;
} {
  const challengeIds = new Set(backup.challenges.map((c) => c.id));
  const pairIds = new Set(backup.pairs.map((p) => p.id));
  const warnings: string[] = [];

  const plans = backup.plans
    .filter((plan) => {
      if (!challengeIds.has(plan.challengeId)) {
        warnings.push(
          `Skipped plan ${plan.id}: challenge ${plan.challengeId} is missing from backup`
        );
        return false;
      }
      return true;
    })
    .map((plan) => ({
      ...plan,
      hedgePairId:
        plan.hedgePairId != null && !pairIds.has(plan.hedgePairId)
          ? null
          : plan.hedgePairId,
    }));

  const skippedPlans = backup.plans.length - plans.length;

  return {
    slice: { ...backup, plans },
    warnings,
    skippedPlans,
  };
}

export async function migrateUserDataFromBackup(
  supabase: SupabaseClient,
  backup: PersistedTradeLogSlice,
  userId: string
): Promise<MigrationResult> {
  try {
    const { slice, warnings, skippedPlans } = sanitizeBackupForMigration(backup);
    const { error: identitiesError } = await supabase
      .from("identities")
      .upsert(
        slice.identities.map((identity) => identityToDb(identity, userId)),
        { onConflict: "id" }
      );

    if (identitiesError) {
      return { success: false, error: `Failed to insert identities: ${identitiesError.message}` };
    }

    const { error: sessionsError } = await supabase
      .from("journal_sessions")
      .upsert(
        slice.sessions.map((session) => sessionToDb(session, userId)),
        { onConflict: "id" }
      );

    if (sessionsError) {
      return { success: false, error: `Failed to insert sessions: ${sessionsError.message}` };
    }

    const { error: challengesError } = await supabase
      .from("challenges")
      .upsert(
        slice.challenges.map((challenge) => challengeToDb(challenge, userId)),
        { onConflict: "id" }
      );

    if (challengesError) {
      return { success: false, error: `Failed to insert challenges: ${challengesError.message}` };
    }

    const tradeRows = slice.trades.map((trade) => tradeToDb(trade, userId));
    for (let i = 0; i < tradeRows.length; i += BATCH_SIZE) {
      const batch = tradeRows.slice(i, i + BATCH_SIZE);
      const { error: tradesError } = await supabase
        .from("trades")
        .upsert(batch, { onConflict: "id" });

      if (tradesError) {
        return {
          success: false,
          error: `Failed to insert trades batch ${i / BATCH_SIZE + 1}: ${tradesError.message}`,
        };
      }
    }

    const pairRows = slice.pairs.map((pair) => hedgePairToDb(pair, userId));
    for (let i = 0; i < pairRows.length; i += BATCH_SIZE) {
      const batch = pairRows.slice(i, i + BATCH_SIZE);
      const { error: pairsError } = await supabase
        .from("hedge_pairs")
        .upsert(batch, { onConflict: "id" });

      if (pairsError) {
        return {
          success: false,
          error: `Failed to insert hedge pairs batch ${i / BATCH_SIZE + 1}: ${pairsError.message}`,
        };
      }
    }

    if (slice.plans.length > 0) {
      const { error: plansError } = await supabase
        .from("phase_plans")
        .upsert(
          slice.plans.map((plan) => phasePlanToDb(plan, userId)),
          { onConflict: "id" }
        );

      if (plansError) {
        return { success: false, error: `Failed to insert phase plans: ${plansError.message}` };
      }
    }

    if (slice.activeIdentityId) {
      await supabase.from("user_journal_settings").upsert(
        {
          user_id: userId,
          active_identity_id: slice.activeIdentityId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    return {
      success: true,
      counts: {
        identities: slice.identities.length,
        challenges: slice.challenges.length,
        trades: slice.trades.length,
        pairs: slice.pairs.length,
        sessions: slice.sessions.length,
        plans: slice.plans.length,
      },
      skipped: skippedPlans > 0 ? { plans: skippedPlans } : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Migration failed: ${message}` };
  }
}

export async function verifyMigration(
  supabase: SupabaseClient,
  expectedCounts: {
    identities: number;
    challenges: number;
    trades: number;
    pairs: number;
    sessions: number;
    plans: number;
  }
): Promise<{
  verified: boolean;
  actual: typeof expectedCounts;
  mismatches: string[];
}> {
  const [
    identitiesCount,
    challengesCount,
    tradesCount,
    pairsCount,
    sessionsCount,
    plansCount,
  ] = await Promise.all([
    supabase.from("identities").select("id", { count: "exact", head: true }),
    supabase.from("challenges").select("id", { count: "exact", head: true }),
    supabase.from("trades").select("id", { count: "exact", head: true }),
    supabase.from("hedge_pairs").select("id", { count: "exact", head: true }),
    supabase.from("journal_sessions").select("id", { count: "exact", head: true }),
    supabase.from("phase_plans").select("id", { count: "exact", head: true }),
  ]);

  const actual = {
    identities: identitiesCount.count ?? 0,
    challenges: challengesCount.count ?? 0,
    trades: tradesCount.count ?? 0,
    pairs: pairsCount.count ?? 0,
    sessions: sessionsCount.count ?? 0,
    plans: plansCount.count ?? 0,
  };

  const mismatches: string[] = [];
  for (const [key, expected] of Object.entries(expectedCounts)) {
    const actualCount = actual[key as keyof typeof actual];
    if (actualCount !== expected) {
      mismatches.push(`${key}: expected ${expected}, got ${actualCount}`);
    }
  }

  return { verified: mismatches.length === 0, actual, mismatches };
}
