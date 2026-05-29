"use client";

import { serializeTradeLogBackup } from "@/models/trade-log/backup-io";
import { parseTradeLogBackupJsonText } from "@/models/trade-log/backup-io";
import type { PersistedTradeLogSlice } from "@/models/trade-log/storage";
import { useTradingStore } from "./store-supabase";

/** Re-run post-load repairs after CSV/backup imports into memory. */
export function hydrateTradeLogFromCsvSlice(slice: PersistedTradeLogSlice) {
  useTradingStore.setState({
    sessions: slice.sessions,
    trades: slice.trades,
    pairs: slice.pairs,
    challenges: slice.challenges,
    identities: slice.identities,
    plans: slice.plans,
    activeIdentityId: slice.activeIdentityId,
    isHydrated: true,
    isLoading: false,
    error: null,
  });
}

/** Download current journal state as JSON (browser only). */
export async function downloadTradeLogBackupJson(): Promise<void> {
  if (typeof window === "undefined") return;

  let json: string;
  try {
    const st = useTradingStore.getState();
    json = serializeTradeLogBackup({
      sessions: st.sessions,
      trades: st.trades,
      pairs: st.pairs,
      challenges: st.challenges,
      identities: st.identities,
      plans: st.plans,
      activeIdentityId: st.activeIdentityId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not serialize journal.";
    window.alert(`Export failed: ${msg}`);
    return;
  }

  const filename = `trade-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 600);
}

/** Replace in-memory journal from a JSON backup file. */
export async function importTradeLogBackupJsonText(
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseTradeLogBackupJsonText(text);
  if (!parsed.ok) return parsed;

  hydrateTradeLogFromCsvSlice(parsed.slice);
  return { ok: true };
}

/** Migrate backup JSON to Supabase database via API */
export async function migrateBackupToDatabase(
  text: string
): Promise<{ 
  ok: true; 
  counts: { identities: number; challenges: number; trades: number; pairs: number; sessions: number; plans: number } 
} | { 
  ok: false; 
  error: string 
}> {
  try {
    const response = await fetch("/api/migrate-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: text,
      credentials: "same-origin",
    });

    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || "Migration failed" };
    }

    if (!result.success) {
      return { ok: false, error: result.error || "Migration failed" };
    }

    return { 
      ok: true, 
      counts: result.counts || { identities: 0, challenges: 0, trades: 0, pairs: 0, sessions: 0, plans: 0 }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, error: `Failed to migrate data: ${message}` };
  }
}

/** Clear in-memory journal state. Does not delete Supabase rows. */
export function resetTradeLogWorkspace() {
  useTradingStore.setState({
    sessions: [],
    trades: [],
    pairs: [],
    challenges: [],
    identities: [],
    plans: [],
    activeIdentityId: null,
    isHydrated: true,
    isLoading: false,
    error: null,
  });
}
