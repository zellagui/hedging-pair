"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  pickWorkspaceDirectory,
  supportsWorkspaceDirectoryPicker,
} from "@/lib/file-system/workspace-handle";
import {
  downloadTradeLogBackupJson,
  importTradeLogBackupJsonText,
  migrateBackupToDatabase,
  useTradingStore,
} from "@/models/trade-log/store";
import {
  connectCloudJournalFromSavedToken,
  flushTradeLogCloudSyncNow,
  getCloudSyncEnabled,
  getCloudSyncToken,
  getLastCloudSavedIso,
  getLastCloudSyncError,
  pullCloudJournalForce,
  setCloudSyncToken,
  subscribeCloudSyncSaved,
} from "@/models/trade-log/blob-sync";
import {
  flushTradeLogWorkspaceCsvNow,
  getActiveWorkspaceCsvRoot,
  getLastWorkspaceCsvSavedIso,
  linkTradeLogCsvWorkspace,
  subscribeWorkspaceCsvSaved,
  unlinkTradeLogCsvWorkspace,
} from "@/models/trade-log/workspace-csv-sync";

export function DataHub() {
  const router = useRouter();
  const { identities, challenges, trades } = useTradingStore(
    useShallow((s) => ({
      identities: s.identities,
      challenges: s.challenges,
      trades: s.trades,
    }))
  );

  const [supportsFolder, setSupportsFolder] = useState(false);
  const [workspaceLinked, setWorkspaceLinked] = useState(false);
  const [lastSavedIso, setLastSavedIso] = useState<string | null>(() =>
    getLastWorkspaceCsvSavedIso()
  );
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    identities: number;
    challenges: number;
    trades: number;
    pairs: number;
    sessions: number;
    plans: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cloudTokenDraft, setCloudTokenDraft] = useState(() =>
    getCloudSyncToken() ?? ""
  );
  const [cloudEnabled, setCloudEnabled] = useState(() => getCloudSyncEnabled());
  const [lastCloudIso, setLastCloudIso] = useState<string | null>(() =>
    getLastCloudSavedIso()
  );
  const [cloudErr, setCloudErr] = useState<string | null>(() =>
    getLastCloudSyncError()
  );
  const [cloudOk, setCloudOk] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSupportsFolder(supportsWorkspaceDirectoryPicker());
    });
  }, []);

  useEffect(() => {
    function tick() {
      setWorkspaceLinked(getActiveWorkspaceCsvRoot() != null);
    }
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(
    () => subscribeWorkspaceCsvSaved((iso) => setLastSavedIso(iso)),
    []
  );

  useEffect(
    () =>
      subscribeCloudSyncSaved((iso) => {
        setLastCloudIso(iso);
        setCloudErr(null);
      }),
    []
  );

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingText(String(reader.result ?? ""));
      setPendingName(f.name);
      setImportErr(null);
      setImportOpen(true);
    };
    reader.readAsText(f);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your journal data is automatically saved to Supabase. You can download backups 
          or import data from other accounts. Changes are saved to the database immediately.
        </p>
      </div>

      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-orange-600 dark:text-orange-400">⚠️</span>
            Cloud sync (Vercel) - Legacy Feature
          </CardTitle>
          <CardDescription>
            <div className="rounded-md bg-orange-100 dark:bg-orange-900 p-2 mb-3">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Your data now saves automatically to Supabase. Cloud sync is optional and will be removed in a future version.
              </p>
            </div>
            Live cloud file: <code className="text-xs">journal/main.json</code>. Older uploads
            like <code className="text-xs">trade-log-backup-*.json</code> are loaded once and
            migrated automatically. Set <code className="text-xs">journal_sync_secret</code> in
            Vercel (same value here). Blob token:{" "}
            <code className="text-xs">BLOB_READ_WRITE_TOKEN</code> (not{" "}
            <code className="text-xs">blob_token</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cloud-sync-token">Sync secret</Label>
            <Input
              id="cloud-sync-token"
              type="password"
              autoComplete="off"
              placeholder="Paste journal_sync_secret"
              value={cloudTokenDraft}
              disabled={busy}
              onChange={(e) => setCloudTokenDraft(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || cloudTokenDraft.trim() === ""}
              onClick={() =>
                void run(async () => {
                  setCloudSyncToken(cloudTokenDraft.trim());
                  setCloudEnabled(true);
                  setCloudErr(null);
                  setCloudOk(null);
                  const result = await connectCloudJournalFromSavedToken();
                  setLastCloudIso(getLastCloudSavedIso());
                  if (result.ok) {
                    setCloudOk(result.message);
                    setCloudErr(null);
                  } else {
                    setCloudErr(result.message);
                    setCloudOk(null);
                  }
                  router.refresh();
                  if (result.ok && typeof window !== "undefined") {
                    window.alert(
                      `${result.message}\n\nOpen Overview to see your journal.`
                    );
                  }
                })
              }
            >
              Save token
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !cloudEnabled}
              onClick={() =>
                void run(async () => {
                  setCloudSyncToken(null);
                  setCloudTokenDraft("");
                  setCloudEnabled(false);
                  setLastCloudIso(null);
                  setCloudErr(null);
                  setCloudOk(null);
                })
              }
            >
              Clear token
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !cloudEnabled}
              onClick={() =>
                void run(async () => {
                  setCloudErr(null);
                  setCloudOk(null);
                  const result = await flushTradeLogCloudSyncNow();
                  setLastCloudIso(getLastCloudSavedIso());
                  if (result.ok) {
                    setCloudOk(result.message);
                    setCloudErr(null);
                  } else {
                    setCloudErr(result.message);
                    setCloudOk(null);
                  }
                  router.refresh();
                })
              }
            >
              Sync now
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !cloudEnabled}
              onClick={() =>
                void run(async () => {
                  setCloudErr(null);
                  setCloudOk(null);
                  const result = await pullCloudJournalForce();
                  setLastCloudIso(getLastCloudSavedIso());
                  if (result.ok) {
                    setCloudOk(result.message);
                    setCloudErr(null);
                  } else {
                    setCloudErr(result.message);
                    setCloudOk(null);
                  }
                  router.refresh();
                })
              }
            >
              Pull from cloud
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Status:{" "}
            {busy
              ? "Syncing with cloud…"
              : !cloudEnabled
                ? "Not configured"
                : lastCloudIso != null
                  ? `Last synced ${new Date(lastCloudIso).toLocaleString()}`
                  : "No cloud save yet"}
          </p>
          {cloudOk != null ? (
            <p className="text-xs text-green-600 dark:text-green-400">{cloudOk}</p>
          ) : null}
          {cloudErr != null ? (
            <p className="text-xs text-destructive">{cloudErr}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup</CardTitle>
          <CardDescription>
            {identities.length} workspace{identities.length === 1 ? "" : "s"} ·{" "}
            {challenges.length} challenge{challenges.length === 1 ? "" : "s"} ·{" "}
            {trades.length} trade leg{trades.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="sm:flex-1"
            disabled={busy}
            onClick={() => void downloadTradeLogBackupJson()}
          >
            Download (.json)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload (.json)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              onPickFile(e.target.files);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {supportsFolder ? (
        <details className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground flex items-center gap-2">
            <span className="text-orange-600 dark:text-orange-400">⚠️</span>
            Advanced: Local folder sync (deprecated)
          </summary>
          <div className="rounded-md bg-orange-100 dark:bg-orange-900 p-2 mt-2 mb-3">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Your data now saves automatically to Supabase. Folder sync is optional and will be removed in a future version.
            </p>
          </div>
          <p className="mt-2 text-muted-foreground">
            Pick a folder—if it lives in Dropbox or similar, you can share that
            folder with a colleague. Last save wins if you both edit.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || workspaceLinked}
              onClick={() =>
                void run(async () => {
                  const dir = await pickWorkspaceDirectory();
                  if (dir == null) return;
                  await linkTradeLogCsvWorkspace(dir);
                  setWorkspaceLinked(true);
                })
              }
            >
              Link folder
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !workspaceLinked}
              onClick={() =>
                void run(async () => {
                  await unlinkTradeLogCsvWorkspace();
                  setWorkspaceLinked(false);
                  setLastSavedIso(null);
                })
              }
            >
              Unlink
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !workspaceLinked}
              onClick={() =>
                void run(async () => {
                  await flushTradeLogWorkspaceCsvNow();
                  setWorkspaceLinked(getActiveWorkspaceCsvRoot() != null);
                })
              }
            >
              Save now
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Last folder write:{" "}
            {lastSavedIso != null
              ? new Date(lastSavedIso).toLocaleString()
              : "—"}
          </p>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">
          This browser cannot pick a folder for auto-save—use Chrome or Edge, or
          stick to download / upload above.
        </p>
      )}

      <AlertDialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setPendingText(null);
            setPendingName(null);
            setImportErr(null);
            setImportProgress(null);
            setMigrationResult(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import journal to database?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will import your backup data to your Supabase account database.
                  {pendingName != null ? (
                    <>
                      {" "}
                      File:{" "}
                      <span className="font-medium text-foreground">
                        {pendingName}
                      </span>
                    </>
                  ) : null}
                </p>
                {importProgress != null ? (
                  <p className="text-blue-600 dark:text-blue-400">{importProgress}</p>
                ) : null}
                {migrationResult != null ? (
                  <div className="rounded-md bg-green-50 p-3 text-sm dark:bg-green-950">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Migration completed successfully!
                    </p>
                    <ul className="mt-1 text-green-700 dark:text-green-300">
                      <li>• {migrationResult.identities} workspace{migrationResult.identities === 1 ? "" : "s"}</li>
                      <li>• {migrationResult.challenges} challenge{migrationResult.challenges === 1 ? "" : "s"}</li>
                      <li>• {migrationResult.trades} trade{migrationResult.trades === 1 ? "" : "s"}</li>
                      <li>• {migrationResult.pairs} pair{migrationResult.pairs === 1 ? "" : "s"}</li>
                      <li>• {migrationResult.sessions} session{migrationResult.sessions === 1 ? "" : "s"}</li>
                      <li>• {migrationResult.plans} plan{migrationResult.plans === 1 ? "" : "s"}</li>
                    </ul>
                  </div>
                ) : null}
                {importErr != null ? (
                  <p className="text-destructive">{importErr}</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy || pendingText == null || pendingText === "" || migrationResult != null}
              onClick={() =>
                void run(async () => {
                  if (pendingText == null) return;
                  setImportErr(null);
                  setImportProgress("Migrating data to database...");
                  setMigrationResult(null);
                  
                  const r = await migrateBackupToDatabase(pendingText);
                  setImportProgress(null);
                  
                  if (r.ok) {
                    setMigrationResult(r.counts);
                    // Refresh the store from server after successful migration
                    const hydrate = useTradingStore.getState().hydrate;
                    await hydrate();
                  } else {
                    setImportErr(r.error);
                  }
                })
              }
            >
              {migrationResult != null ? "Import Complete" : "Import to Database"}
            </Button>
            
            {migrationResult != null ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportOpen(false);
                  setPendingText(null);
                  setPendingName(null);
                  setMigrationResult(null);
                  router.refresh();
                }}
              >
                Done
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
