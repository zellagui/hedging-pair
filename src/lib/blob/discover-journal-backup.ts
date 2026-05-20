import { list } from "@vercel/blob";

import {
  getLegacyJournalBlobPath,
  JOURNAL_BLOB_PATH,
} from "@/lib/blob/journal-paths";
import { readBlobJsonText } from "@/lib/blob/read-blob-text";

export type DiscoveredJournalBackup = {
  text: string;
  fromLegacy: boolean;
  pathname: string;
};

/** Find the best journal JSON in the linked Blob store. */
export async function discoverJournalBackupInBlob(): Promise<DiscoveredJournalBackup | null> {
  const canonical = await readBlobJsonText(JOURNAL_BLOB_PATH);
  if (canonical != null) {
    return { text: canonical, fromLegacy: false, pathname: JOURNAL_BLOB_PATH };
  }

  const legacyPath = getLegacyJournalBlobPath();
  const legacy = await readBlobJsonText(legacyPath);
  if (legacy != null) {
    return { text: legacy, fromLegacy: true, pathname: legacyPath };
  }

  try {
    const backupListed = await list({ prefix: "trade-log-backup", limit: 30 });
    const backupBlobs = [...backupListed.blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
    for (const blob of backupBlobs) {
      if (!blob.pathname.endsWith(".json")) continue;
      const text = await readBlobJsonText(blob.pathname);
      if (text != null) {
        return { text, fromLegacy: true, pathname: blob.pathname };
      }
    }

    const journalListed = await list({ prefix: "journal/", limit: 30 });
    const journalBlobs = [...journalListed.blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
    for (const blob of journalBlobs) {
      if (!blob.pathname.endsWith(".json")) continue;
      const text = await readBlobJsonText(blob.pathname);
      if (text != null) {
        return {
          text,
          fromLegacy: blob.pathname !== JOURNAL_BLOB_PATH,
          pathname: blob.pathname,
        };
      }
    }
  } catch {
    /* list may fail if token missing — caller handles null */
  }

  return null;
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
