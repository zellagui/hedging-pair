import { list } from "@vercel/blob";

import {
  getLegacyJournalBlobPath,
  JOURNAL_BLOB_PATH,
} from "@/lib/blob/journal-paths";
import { readBlobJsonText } from "@/lib/blob/read-blob-text";
import {
  parseTradeLogBackupJsonText,
  scoreJournalSliceRichness,
} from "@/models/trade-log/backup-io";

export type DiscoveredJournalBackup = {
  text: string;
  fromLegacy: boolean;
  pathname: string;
};

type ScoredCandidate = DiscoveredJournalBackup & {
  score: number;
  exportedAtMs: number;
};

function exportedAtMs(iso?: string): number {
  if (iso == null || iso === "") return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function toCandidate(
  pathname: string,
  text: string
): ScoredCandidate | null {
  const parsed = parseTradeLogBackupJsonText(text);
  if (!parsed.ok) return null;
  return {
    text,
    pathname,
    fromLegacy: pathname !== JOURNAL_BLOB_PATH,
    score: scoreJournalSliceRichness(parsed.slice),
    exportedAtMs: exportedAtMs(parsed.exportedAt),
  };
}

async function collectPathnameCandidates(
  pathnames: Iterable<string>,
  out: ScoredCandidate[]
): Promise<void> {
  const seen = new Set<string>();
  for (const pathname of pathnames) {
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    const text = await readBlobJsonText(pathname);
    if (text == null) continue;
    const c = toCandidate(pathname, text);
    if (c != null) out.push(c);
  }
}

/**
 * Find the richest journal JSON in the Blob store.
 * Prefers the backup with the most data — empty journal/main.json will not
 * shadow a full trade-log-backup-*.json file.
 */
export async function discoverJournalBackupInBlob(): Promise<DiscoveredJournalBackup | null> {
  const pathnames: string[] = [
    JOURNAL_BLOB_PATH,
    getLegacyJournalBlobPath(),
  ];

  try {
    const backupListed = await list({ prefix: "trade-log-backup", limit: 30 });
    for (const blob of backupListed.blobs) {
      if (blob.pathname.endsWith(".json")) pathnames.push(blob.pathname);
    }

    const journalListed = await list({ prefix: "journal/", limit: 30 });
    for (const blob of journalListed.blobs) {
      if (blob.pathname.endsWith(".json")) pathnames.push(blob.pathname);
    }
  } catch {
    /* list optional */
  }

  const candidates: ScoredCandidate[] = [];
  await collectPathnameCandidates(pathnames, candidates);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.exportedAtMs - a.exportedAtMs;
  });

  const best = candidates[0];
  return {
    text: best.text,
    fromLegacy: best.fromLegacy,
    pathname: best.pathname,
  };
}

export function wrapJournalBackupWithSyncMeta(
  text: string,
  meta: { fromLegacy: boolean; pathname: string }
): string {
  if (!meta.fromLegacy) return text;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    return JSON.stringify({
      ...o,
      journalSyncMeta: { fromLegacy: true, pathname: meta.pathname },
    });
  } catch {
    return text;
  }
}
