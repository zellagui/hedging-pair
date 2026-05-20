import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import {
  getLegacyJournalBlobPath,
  JOURNAL_BLOB_PATH,
} from "@/lib/blob/journal-paths";
import { readBlobJsonText } from "@/lib/blob/read-blob-text";
import { getBlobReadWriteToken, getJournalSyncSecret } from "@/lib/env/journal-sync";
import {
  buildTradeLogBackupPayload,
  parseTradeLogBackupJsonText,
} from "@/models/trade-log/backup-io";

const LEGACY_SOURCE_HEADER = "X-Journal-From-Legacy";

function checkAuth(request: Request):
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string } {
  const expected = getJournalSyncSecret();
  if (expected == null) {
    return {
      ok: false,
      status: 503,
      error:
        "Server sync secret is not set. Add journal_sync_secret (or JOURNAL_SYNC_SECRET) to .env.local / Vercel env, then restart / redeploy.",
    };
  }
  const header = request.headers.get("authorization");
  if (header == null || !header.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Missing sync token. Open Data → Cloud sync, paste your secret, and Save token.",
    };
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.length === 0 || token !== expected) {
    return {
      ok: false,
      status: 401,
      error:
        "Sync token does not match journal_sync_secret on the server. Use the exact same value in Vercel / .env.local and in the Data page.",
    };
  }
  return { ok: true };
}

function blobNotConfigured(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Cloud storage is not configured. Link a Blob store and set BLOB_READ_WRITE_TOKEN (or blob_read_write_token).",
    },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  const auth = checkAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (getBlobReadWriteToken() == null) {
    return blobNotConfigured();
  }

  try {
    let text = await readBlobJsonText(JOURNAL_BLOB_PATH);
    let fromLegacy = false;

    if (text == null) {
      text = await readBlobJsonText(getLegacyJournalBlobPath());
      fromLegacy = text != null;
    }

    if (text == null) {
      return new NextResponse(null, { status: 404 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (fromLegacy) {
      headers[LEGACY_SOURCE_HEADER] = "1";
    }

    return new NextResponse(text, { status: 200, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read cloud journal.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = checkAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (getBlobReadWriteToken() == null) {
    return blobNotConfigured();
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseTradeLogBackupJsonText(text);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const exportedAt = parsed.exportedAt ?? new Date().toISOString();
  const payload = buildTradeLogBackupPayload(parsed.slice, exportedAt);
  const json = JSON.stringify(payload);

  try {
    await put(JOURNAL_BLOB_PATH, json, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return NextResponse.json({ exportedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save cloud journal.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
