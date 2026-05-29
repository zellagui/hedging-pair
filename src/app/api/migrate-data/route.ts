import { createClient } from "@/lib/supabase/server";
import { migrateUserDataFromBackup, verifyMigration } from "@/lib/supabase/migrate-user-data";
import { parseTradeLogBackupJsonText } from "@/models/trade-log/backup-io";
import { NextResponse } from "next/server";

/**
 * API endpoint to migrate JSON backup data to Supabase
 * POST /api/migrate-data
 * 
 * Body: JSON backup file contents
 * 
 * Response: Migration result with counts
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in first" },
        { status: 401 }
      );
    }

    // Parse request body
    const text = await request.text();
    const parsed = parseTradeLogBackupJsonText(text);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: `Invalid backup file: ${parsed.error}` },
        { status: 400 }
      );
    }

    console.log(`Starting migration for user ${user.id}`);
    console.log(`Backup contains:`);
    console.log(`  - ${parsed.slice.identities.length} identities`);
    console.log(`  - ${parsed.slice.challenges.length} challenges`);
    console.log(`  - ${parsed.slice.trades.length} trades`);
    console.log(`  - ${parsed.slice.pairs.length} pairs`);
    console.log(`  - ${parsed.slice.sessions.length} sessions`);
    console.log(`  - ${parsed.slice.plans.length} plans`);

    // Run migration
    const result = await migrateUserDataFromBackup(
      supabase,
      parsed.slice,
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Verify migration
    if (result.counts) {
      const verification = await verifyMigration(supabase, result.counts);
      
      if (!verification.verified) {
        console.warn("Migration count mismatch:", verification.mismatches);
        return NextResponse.json(
          {
            success: true,
            message: "Migration completed with warnings",
            counts: result.counts,
            actualCounts: verification.actual,
            warnings: verification.mismatches,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Migration completed successfully",
        counts: result.counts,
      },
      { status: 200 }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: `Migration failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate-data
 * 
 * Returns migration status/instructions
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/migrate-data",
    method: "POST",
    description: "Migrate JSON backup data to Supabase",
    authentication: "Required - User must be logged in",
    body: "JSON backup file contents",
    example: `
curl -X POST http://localhost:3000/api/migrate-data \\
  -H "Content-Type: application/json" \\
  -H "Cookie: YOUR_SESSION_COOKIE" \\
  --data @backup.json
    `.trim(),
  });
}
