# Database Migration Instructions

## Step 1: Apply the Initial Schema Migration

The database schema has been created in `supabase/migrations/20260529001208_initial_schema.sql`.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/wbpxcafugvubyxtpqfls
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260529001208_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run** to execute the migration
7. Verify in the **Table Editor** that all tables were created

### Option B: Using Supabase CLI

If you have your database password:

```bash
# Get your database connection string from Supabase Dashboard > Settings > Database
# It looks like: postgresql://postgres:[PASSWORD]@db.wbpxcafugvubyxtpqfls.supabase.co:5432/postgres

supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.wbpxcafugvubyxtpqfls.supabase.co:5432/postgres"
```

### Option C: Using psql directly

```bash
psql "postgresql://postgres:[PASSWORD]@db.wbpxcafugvubyxtpqfls.supabase.co:5432/postgres" -f supabase/migrations/20260529001208_initial_schema.sql
```

## Step 2: Verify Migration Success

After running the migration, verify the following tables exist in your Supabase project:

- ✅ `identities`
- ✅ `challenges`
- ✅ `trades`
- ✅ `hedge_pairs`
- ✅ `phase_plans`
- ✅ `journal_sessions`
- ✅ `user_journal_settings`

And the following enums:

- ✅ `challenge_status`
- ✅ `trade_direction`
- ✅ `pair_status`
- ✅ `plan_status`
- ✅ `round_mode`

## Step 3: Run Data Migration (After Schema is Applied)

Once the schema is in place, you can migrate your existing data.

### Option A: Using Migration Script (Recommended for Initial Setup)

```bash
# Install tsx if not already installed
npm install -D tsx

# Run the migration script
npx tsx scripts/run-migration.ts "src/lib/backup/trade-log-backup-2026-05-28 (2).json" 9f791123-50ed-4f24-a31e-849e738970da
```

The script will:
1. Read and parse the backup file
2. Verify data integrity
3. Migrate all records to Supabase
4. Verify counts match

### Option B: Using API Endpoint (For Logged-in Users)

1. Start the development server: `npm run dev`
2. Log in as the target user in your browser
3. Open browser console and run:

```javascript
const response = await fetch('/api/migrate-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: await (await fetch('/src/lib/backup/trade-log-backup-2026-05-28 (2).json')).text()
});
const result = await response.json();
console.log(result);
```

Or use curl with session cookie:

```bash
curl -X POST http://localhost:3000/api/migrate-data \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  --data @"src/lib/backup/trade-log-backup-2026-05-28 (2).json"
```

## Troubleshooting

### Error: "type already exists"

If you see errors about types already existing, you may need to drop them first:

```sql
DROP TYPE IF EXISTS public.challenge_status CASCADE;
DROP TYPE IF EXISTS public.trade_direction CASCADE;
DROP TYPE IF EXISTS public.pair_status CASCADE;
DROP TYPE IF EXISTS public.plan_status CASCADE;
DROP TYPE IF EXISTS public.round_mode CASCADE;
```

Then re-run the migration.

### Error: "permission denied"

Make sure you're using a connection with sufficient privileges (the `postgres` role).
