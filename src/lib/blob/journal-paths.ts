export const JOURNAL_BLOB_PATH = "journal/main.json";

export const DEFAULT_LEGACY_JOURNAL_BLOB_PATH =
  "trade-log-backup-2026-05-19.json";

export function getLegacyJournalBlobPath(): string {
  const v =
    process.env.journal_legacy_blob_path?.trim() ||
    process.env.JOURNAL_LEGACY_BLOB_PATH?.trim();
  return v != null && v !== "" ? v : DEFAULT_LEGACY_JOURNAL_BLOB_PATH;
}
