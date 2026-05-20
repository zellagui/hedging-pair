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
          Download your journal as one file, or load a file someone else exported.
          The rest of the app updates immediately after you load.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cloud sync (Vercel)</CardTitle>
          <CardDescription>
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
        <details className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            Optional: save automatically to a folder (Chrome / Edge)
          </summary>
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
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your journal?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Everything in this browser copy will be replaced: workspaces,
                challenges, trades, pairs, sessions.
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
              {importErr != null ? (
                <p className="text-destructive">{importErr}</p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy || pendingText == null || pendingText === ""}
              onClick={() =>
                void run(async () => {
                  if (pendingText == null) return;
                  setImportErr(null);
                  const r = await importTradeLogBackupJsonText(pendingText);
                  if (r.ok) {
                    setImportOpen(false);
                    setPendingText(null);
                    setPendingName(null);
                    router.refresh();
                    if (typeof window !== "undefined") {
                      window.alert(
                        "Journal loaded. Your data is saved in this browser for next time."
                      );
                    }
                  } else {
                    setImportErr(r.error);
                  }
                })
              }
            >
              Load journal
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
