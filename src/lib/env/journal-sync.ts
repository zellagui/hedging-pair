/** Vercel UI often uses lowercase keys; Next.js still reads either form. */
export function getJournalSyncSecret(): string | undefined {
  const v =
    process.env.JOURNAL_SYNC_SECRET?.trim() ||
    process.env.journal_sync_secret?.trim();
  return v != null && v !== "" ? v : undefined;
}

export function getBlobReadWriteToken(): string | undefined {
  const v =
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.blob_read_write_token?.trim();
  return v != null && v !== "" ? v : undefined;
}
