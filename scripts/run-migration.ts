#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { migrateUserDataFromBackup, verifyMigration } from "../src/lib/supabase/migrate-user-data";
import { parseTradeLogBackupJsonText } from "../src/models/trade-log/backup-io";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/run-migration.ts <backup-file-path> <user-id>");
    process.exit(1);
  }

  const [backupPath, userId] = args;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseKey = serviceRoleKey ?? publishableKey;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing Supabase environment variables in .env.local");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL");
    console.error("Required: SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY not set. Migration may fail due to RLS.");
    console.warn("Add it from Supabase Dashboard > Project Settings > API > service_role key");
  }

  const backupFilePath = resolve(process.cwd(), backupPath);
  const backupText = readFileSync(backupFilePath, "utf-8");
  const parsed = parseTradeLogBackupJsonText(backupText);

  if (!parsed.ok) {
    console.error(`Error: Invalid backup file - ${parsed.error}`);
    process.exit(1);
  }

  console.log("Backup summary:");
  console.log(`  Identities: ${parsed.slice.identities.length}`);
  console.log(`  Challenges: ${parsed.slice.challenges.length}`);
  console.log(`  Trades: ${parsed.slice.trades.length}`);
  console.log(`  Hedge Pairs: ${parsed.slice.pairs.length}`);
  console.log(`  Sessions: ${parsed.slice.sessions.length}`);
  console.log(`  Phase Plans: ${parsed.slice.plans.length}`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await migrateUserDataFromBackup(supabase, parsed.slice, userId);

  if (!result.success) {
    console.error(`Migration failed: ${result.error}`);
    process.exit(1);
  }

  if (result.warnings?.length) {
    console.warn("\nWarnings:");
    for (const w of result.warnings) console.warn(`  - ${w}`);
  }
  if (result.skipped?.plans) {
    console.warn(`Skipped ${result.skipped.plans} orphan phase plan(s).`);
  }

  if (result.counts) {
    const verification = await verifyMigration(supabase, result.counts);
    console.log("Verification:", verification.actual);
    if (!verification.verified) {
      console.warn("Count mismatches:", verification.mismatches);
    }
  }

  console.log("Migration completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
