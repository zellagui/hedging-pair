"use client";

import {
  clearStoredWorkspaceDirectoryHandle,
  ensureDirectoryHandlePermission,
  getStoredWorkspaceDirectoryHandle,
  saveWorkspaceDirectoryHandle,
} from "@/lib/file-system/workspace-handle";
import {
  CSV_FILE_META,
  filterSliceForExport,
  parseFilesToTradeLogSlice,
  parseMeta,
  serializeTradeLogSliceToFiles,
  type WorkspaceCsvMeta,
} from "@/models/trade-log/csv-io";
import {
  persistTradeLogSliceToLocalKeys,
  type PersistedTradeLogSlice,
  setTradeLogSkipLocalWrites,
  STORAGE_VERSION,
} from "@/models/trade-log/storage";
import {
  hydrateTradeLogFromCsvSlice,
  useTradingStore,
  type TradeLogState,
} from "@/models/trade-log/store";
import {
  readTradeLogCsvFilesFromDirectory,
  writeTradeLogCsvFilesToDirectory,
} from "@/models/trade-log/workspace-fs";

let activeWorkspaceRoot: FileSystemDirectoryHandle | null = null;
let lastWorkspaceCsvSavedIso: string | null = null;

const csvSavedListeners = new Set<(iso: string) => void>();

export function getActiveWorkspaceCsvRoot(): FileSystemDirectoryHandle | null {
  return activeWorkspaceRoot;
}

export function subscribeWorkspaceCsvSaved(cb: (iso: string) => void): () => void {
  csvSavedListeners.add(cb);
  return () => csvSavedListeners.delete(cb);
}

export function getLastWorkspaceCsvSavedIso(): string | null {
  return lastWorkspaceCsvSavedIso;
}

function notifyWorkspaceCsvSaved(iso: string) {
  lastWorkspaceCsvSavedIso = iso;
  csvSavedListeners.forEach((fn) => {
    fn(iso);
  });
}

function pickPersistSlice(
  st: Pick<
    TradeLogState,
    | "sessions"
    | "trades"
    | "pairs"
    | "challenges"
    | "identities"
    | "plans"
    | "activeIdentityId"
  >
): PersistedTradeLogSlice {
  return {
    sessions: st.sessions,
    trades: st.trades,
    pairs: st.pairs,
    challenges: st.challenges,
    identities: st.identities,
    plans: st.plans,
    activeIdentityId: st.activeIdentityId,
  };
}

export function persistedSliceSnapshot(): PersistedTradeLogSlice {
  return pickPersistSlice(useTradingStore.getState());
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

function trustWorkspaceCsvFiles(files: Record<string, string>): boolean {
  const metaOk = parseMeta(files[CSV_FILE_META] ?? "") !== null;
  const slice = parseFilesToTradeLogSlice(files);
  return metaOk || sliceLooksPopulated(slice);
}

export async function flushTradeLogWorkspaceCsvNow(): Promise<boolean> {
  const root = activeWorkspaceRoot;
  if (root == null) return false;

  const granted = await ensureDirectoryHandlePermission(root, "readwrite");
  if (granted !== "granted") {
    activeWorkspaceRoot = null;
    setTradeLogSkipLocalWrites(false);
    return false;
  }

  try {
    const slice = pickPersistSlice(useTradingStore.getState());
    const files = serializeTradeLogSliceToFiles(slice);
    await writeTradeLogCsvFilesToDirectory(root, files);
    const iso = new Date().toISOString();
    notifyWorkspaceCsvSaved(iso);
    return true;
  } catch {
    return false;
  }
}

/** After localStorage hydrate: load linked folder when permission + corpus present. */
export async function bootstrapTradeLogWorkspaceCsv(): Promise<{
  mode: "ls" | "csv";
}> {
  setTradeLogSkipLocalWrites(false);
  activeWorkspaceRoot = null;

  const stored = await getStoredWorkspaceDirectoryHandle();
  if (stored == null) return { mode: "ls" };

  const granted = await ensureDirectoryHandlePermission(stored, "readwrite");
  if (granted !== "granted") return { mode: "ls" };

  const files = await readTradeLogCsvFilesFromDirectory(stored);
  if (!trustWorkspaceCsvFiles(files)) return { mode: "ls" };

  const parsed = parseFilesToTradeLogSlice(files);
  activeWorkspaceRoot = stored;
  setTradeLogSkipLocalWrites(true);
  hydrateTradeLogFromCsvSlice(parsed);
  await flushTradeLogWorkspaceCsvNow();
  return { mode: "csv" };
}

/** User-linked folder via picker; persists handle and enables live CSV sync. */
export async function linkTradeLogCsvWorkspace(
  root: FileSystemDirectoryHandle
): Promise<boolean> {
  const granted = await ensureDirectoryHandlePermission(root, "readwrite");
  if (granted !== "granted") return false;

  await saveWorkspaceDirectoryHandle(root);

  activeWorkspaceRoot = root;
  setTradeLogSkipLocalWrites(true);

  await flushTradeLogWorkspaceCsvNow();
  return true;
}

export async function unlinkTradeLogCsvWorkspace(): Promise<void> {
  activeWorkspaceRoot = null;
  await clearStoredWorkspaceDirectoryHandle();
  persistTradeLogSliceToLocalKeys(persistedSliceSnapshot());
  setTradeLogSkipLocalWrites(false);
}

export function subscribeDebouncedTradeLogWorkspaceCsv(debounceMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleFlush() {
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => void flushTradeLogWorkspaceCsvNow(), debounceMs);
  }

  const unsub = useTradingStore.subscribe((next: TradeLogState, prev: TradeLogState) => {
    if (activeWorkspaceRoot == null) return;
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
    scheduleFlush();
  });

  return () => {
    unsub();
    if (timer != null) clearTimeout(timer);
  };
}

export async function exportScopedCsvToLinkedSubfolder(opts: {
  root: FileSystemDirectoryHandle;
  selectedIdentityIds: string[];
  selectedChallengeIds?: string[];
}): Promise<{ folderName: string } | null> {
  const granted = await ensureDirectoryHandlePermission(opts.root, "readwrite");
  if (granted !== "granted") return null;

  const full = persistedSliceSnapshot();
  const sliced = filterSliceForExport(
    full,
    opts.selectedIdentityIds,
    opts.selectedChallengeIds
  );

  const folderName = `export-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const meta: WorkspaceCsvMeta = {
    version: STORAGE_VERSION,
    activeIdentityId: sliced.activeIdentityId ?? null,
    savedAtIso: new Date().toISOString(),
  };

  const files = serializeTradeLogSliceToFiles(sliced, meta);
  await writeTradeLogCsvFilesToDirectory(opts.root, files, folderName);
  return { folderName };
}

export function serializeScopedCsvFilesForExport(
  selectedIdentityIds: string[],
  selectedChallengeIds?: string[]
): Record<string, string> {
  const full = persistedSliceSnapshot();
  const sliced = filterSliceForExport(
    full,
    selectedIdentityIds,
    selectedChallengeIds
  );
  const meta: WorkspaceCsvMeta = {
    version: STORAGE_VERSION,
    activeIdentityId: sliced.activeIdentityId ?? null,
    savedAtIso: new Date().toISOString(),
  };
  return serializeTradeLogSliceToFiles(sliced, meta);
}
