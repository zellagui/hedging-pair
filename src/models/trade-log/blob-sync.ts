"use client";

import {
  parseTradeLogBackupJsonText,
  serializeTradeLogBackup,
} from "@/models/trade-log/backup-io";
import {
  TRADE_LOG_ROOT_KEY,
  type PersistedTradeLogSlice,
} from "@/models/trade-log/storage";
import {
  importTradeLogBackupJsonText,
  useTradingStore,
  type TradeLogState,
} from "@/models/trade-log/store";
import { getActiveWorkspaceCsvRoot } from "@/models/trade-log/workspace-csv-sync";

const CLOUD_SYNC_TOKEN_KEY = "trade-log-cloud-sync-token";

let lastCloudSavedIso: string | null = null;
let applyingCloudSync = false;
let lastCloudSyncError: string | null = null;

const cloudSavedListeners = new Set<(iso: string) => void>();

export function getCloudSyncToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(CLOUD_SYNC_TOKEN_KEY)?.trim();
  return t != null && t !== "" ? t : null;
}

export function getCloudSyncEnabled(): boolean {
  return getCloudSyncToken() != null;
}

export function setCloudSyncToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token == null || token.trim() === "") {
    localStorage.removeItem(CLOUD_SYNC_TOKEN_KEY);
  } else {
    localStorage.setItem(CLOUD_SYNC_TOKEN_KEY, token.trim());
  }
}

export function getLastCloudSavedIso(): string | null {
  return lastCloudSavedIso;
}

export function getLastCloudSyncError(): string | null {
  return lastCloudSyncError;
}

export function subscribeCloudSyncSaved(cb: (iso: string) => void): () => void {
  cloudSavedListeners.add(cb);
  return () => cloudSavedListeners.delete(cb);
}

function notifyCloudSaved(iso: string) {
  lastCloudSavedIso = iso;
  lastCloudSyncError = null;
  cloudSavedListeners.forEach((fn) => fn(iso));
}

function authHeaders(): HeadersInit | null {
  const token = getCloudSyncToken();
  if (token == null) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function sliceLooksPopulated(slice: PersistedTradeLogSlice): boolean {
  return (
    slice.identities.length +
      slice.challenges.length +
      slice.trades.length +
      slice.pairs.length +
      slice.sessions.length >
    0
  );
}

function pickPersistSlice(
  st: Pick<
    TradeLogState,
    | "sessions"
    | "trades"
    | "pairs"
    | "challenges"
    | "identities"
    | "activeIdentityId"
  >
): PersistedTradeLogSlice {
  return {
    sessions: st.sessions,
    trades: st.trades,
    pairs: st.pairs,
    challenges: st.challenges,
    identities: st.identities,
    activeIdentityId: st.activeIdentityId,
  };
}

export function persistedSliceSnapshot(): PersistedTradeLogSlice {
  return pickPersistSlice(useTradingStore.getState());
}

function getLocalUpdatedMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(TRADE_LOG_ROOT_KEY);
  if (raw == null) return 0;
  try {
    const o = JSON.parse(raw) as { updatedAt?: number };
    return typeof o.updatedAt === "number" ? o.updatedAt : 0;
  } catch {
    return 0;
  }
}

function parseExportedAtMs(iso?: string): number {
  if (iso == null || iso === "") return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export async function fetchCloudJournalBackup(): Promise<
  | { ok: true; text: string; exportedAt?: string }
  | { ok: false; status: number; error: string }
> {
  const headers = authHeaders();
  if (headers == null) {
    return { ok: false, status: 401, error: "Cloud sync token is not set." };
  }

  const res = await fetch("/api/journal", { method: "GET", headers });
  if (res.status === 404) {
    return { ok: false, status: 404, error: "No cloud backup yet." };
  }
  if (!res.ok) {
    let error = `Cloud fetch failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) error = body.error;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error };
  }

  const text = await res.text();
  const parsed = parseTradeLogBackupJsonText(text);
  if (!parsed.ok) {
    return { ok: false, status: 500, error: parsed.error };
  }
  return { ok: true, text, exportedAt: parsed.exportedAt };
}

export async function pushCloudJournalBackup(
  slice?: PersistedTradeLogSlice
): Promise<{ ok: true; exportedAt: string } | { ok: false; error: string }> {
  const headers = authHeaders();
  if (headers == null) {
    return { ok: false, error: "Cloud sync token is not set." };
  }

  const snap = slice ?? persistedSliceSnapshot();
  const exportedAt = new Date().toISOString();
  const body = serializeTradeLogBackup(snap, exportedAt);

  const res = await fetch("/api/journal", {
    method: "PUT",
    headers,
    body,
  });

  if (!res.ok) {
    let error = `Cloud save failed (${res.status}).`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) error = j.error;
    } catch {
      /* ignore */
    }
    lastCloudSyncError = error;
    return { ok: false, error };
  }

  let savedAt = exportedAt;
  try {
    const j = (await res.json()) as { exportedAt?: string };
    if (typeof j.exportedAt === "string") savedAt = j.exportedAt;
  } catch {
    /* use exportedAt */
  }

  notifyCloudSaved(savedAt);
  return { ok: true, exportedAt: savedAt };
}

async function applyCloudText(text: string): Promise<boolean> {
  applyingCloudSync = true;
  try {
    const r = await importTradeLogBackupJsonText(text);
    if (!r.ok) {
      lastCloudSyncError = r.error;
      return false;
    }
    return true;
  } finally {
    queueMicrotask(() => {
      applyingCloudSync = false;
    });
  }
}

/** After local hydrate: merge with cloud backup (newer exportedAt / updatedAt wins). */
export async function bootstrapTradeLogCloudSync(): Promise<void> {
  if (getCloudSyncToken() == null) return;
  if (getActiveWorkspaceCsvRoot() != null) return;

  const local = persistedSliceSnapshot();
  const localMs = getLocalUpdatedMs();
  const localPopulated = sliceLooksPopulated(local);

  const cloud = await fetchCloudJournalBackup();
  if (!cloud.ok) {
    if (cloud.status === 404) {
      if (localPopulated) {
        await pushCloudJournalBackup(local);
      }
      return;
    }
    if (cloud.status !== 401) {
      lastCloudSyncError = cloud.error;
    }
    return;
  }

  const cloudMs = parseExportedAtMs(cloud.exportedAt);

  if (!localPopulated) {
    await applyCloudText(cloud.text);
    if (cloud.exportedAt) notifyCloudSaved(cloud.exportedAt);
    return;
  }

  if (cloudMs > localMs) {
    await applyCloudText(cloud.text);
    if (cloud.exportedAt) notifyCloudSaved(cloud.exportedAt);
    return;
  }

  if (localMs > cloudMs) {
    await pushCloudJournalBackup(local);
    return;
  }

  if (cloud.exportedAt) notifyCloudSaved(cloud.exportedAt);
}

export async function flushTradeLogCloudSyncNow(): Promise<boolean> {
  if (getCloudSyncToken() == null) return false;
  if (getActiveWorkspaceCsvRoot() != null) return false;
  const r = await pushCloudJournalBackup();
  return r.ok;
}

export function subscribeDebouncedCloudSync(debounceMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedulePush() {
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => {
      void pushCloudJournalBackup();
    }, debounceMs);
  }

  const unsub = useTradingStore.subscribe((next: TradeLogState, prev: TradeLogState) => {
    if (getCloudSyncToken() == null) return;
    if (applyingCloudSync) return;
    if (getActiveWorkspaceCsvRoot() != null) return;
    if (
      next.sessions === prev.sessions &&
      next.trades === prev.trades &&
      next.pairs === prev.pairs &&
      next.challenges === prev.challenges &&
      next.identities === prev.identities &&
      next.activeIdentityId === prev.activeIdentityId
    ) {
      return;
    }
    schedulePush();
  });

  return () => {
    unsub();
    if (timer != null) clearTimeout(timer);
  };
}
