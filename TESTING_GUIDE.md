# Supabase Migration Testing Guide

## Prerequisites

1. Database schema must be applied (see `MIGRATION_INSTRUCTIONS.md`)
2. User must be authenticated
3. Development server running: `npm run dev`

## Step 1: Verify Database Schema

Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wbpxcafugvubyxtpqfls

### Check Tables
Navigate to **Table Editor** and verify these tables exist:
- ✅ `identities`
- ✅ `challenges`
- ✅ `trades`
- ✅ `hedge_pairs`
- ✅ `phase_plans`
- ✅ `journal_sessions`
- ✅ `user_journal_settings`

### Check RLS Policies
Navigate to **Authentication > Policies** and verify RLS is enabled on all tables with policies like:
- `users_own_identities`
- `users_own_challenges`
- `users_own_trades`
- etc.

## Step 2: Test Authentication Integration

1. Open http://localhost:3000
2. You should be redirected to `/auth/login` (if not authenticated)
3. Log in with: `localhost.upstroke865@passmail.net` (or your test account)
4. After login, you should be redirected to the journal

## Step 3: Test Data Migration

### Option A: Using the Migration Script

```bash
npx tsx scripts/run-migration.ts "src/lib/backup/trade-log-backup-2026-05-28 (2).json" 9f791123-50ed-4f24-a31e-849e738970da
```

Expected output:
```
============================================================
Data Migration Script
============================================================
Backup file: src/lib/backup/trade-log-backup-2026-05-28 (2).json
Target user: 9f791123-50ed-4f24-a31e-849e738970da
...
✅ Migration completed! Verifying...
✅ All counts verified!
```

### Option B: Using the API

```bash
# Get your session cookie from browser dev tools
curl -X POST http://localhost:3000/api/migrate-data \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-wbpxcafugvubyxtpqfls-auth-token=YOUR_TOKEN_HERE" \
  --data @"src/lib/backup/trade-log-backup-2026-05-28 (2).json"
```

### Verify Migration in Supabase

Go to **Table Editor** and check row counts:
- `identities`: Should have 2 rows (Zela, Walid)
- `challenges`: Should have 59 rows
- `trades`: Should have 1,352 rows
- `hedge_pairs`: Should have 657 rows
- `journal_sessions`: Should have 1 row
- `phase_plans`: Should have 51 rows

## Step 4: Test CRUD Operations

### Test 1: Create Identity (Workspace)

1. Navigate to http://localhost:3000/journal
2. Open browser console
3. Run:
```javascript
const store = window.__ZUSTAND_DEVTOOLS_GLOBAL__?.states?.get('trade-log-root');
// Or directly access useTradingStore if available

// Check current state
console.log('Current identities:', store.identities);

// Test create
await store.addIdentity({ name: 'Test Workspace', note: 'Testing' });

// Verify in Supabase
```

4. Check in Supabase Table Editor that the new identity was created
5. Verify `user_id` matches your logged-in user

### Test 2: Create Challenge

```javascript
const identityId = store.identities[0].id;
const challengeId = await store.addChallenge({
  identityId,
  name: 'Test Challenge',
  fee: 100,
  balance: 50000,
  currentProfitTarget: 3000,
  maxDrawdown: 2000,
  dailyLossCap: 1000,
  status: 'evaluation',
  note: 'Test challenge',
  payoutAmount: null,
  payoutAt: null,
  disbursementAt: null,
  ledgerPhases: [null, null, null, null, null, null],
});

console.log('Created challenge:', challengeId);
```

Verify in Supabase Table Editor.

### Test 3: Create Trade

```javascript
const tradeId = await store.addTrade({
  identityId: store.identities[0].id,
  challengeId: null,
  sessionId: null,
  symbol: 'ES',
  direction: 'long',
  size: 1,
  entryPrice: 5000,
  exitPrice: 5010,
  directPnl: 50,
  currentPrice: null,
  stopLoss: 4990,
  takeProfit: 5020,
  fees: 2.50,
  notes: 'Test trade',
  screenshot: null,
});

console.log('Created trade:', tradeId);
```

### Test 4: Update Entity

```javascript
const identity = store.identities[0];
await store.updateIdentity(identity.id, { name: 'Updated Name' });

// Verify update
console.log('Updated identity:', store.getIdentity(identity.id));
```

### Test 5: Delete Entity

```javascript
// Create a test identity to delete
const testId = await store.addIdentity({ name: 'To Delete', note: '' });

// Delete it
const deleted = await store.deleteIdentity(testId);
console.log('Deleted:', deleted);

// Verify it's gone from both store and Supabase
```

## Step 5: Test RLS (Row Level Security)

### Test User Isolation

1. Log in as user A (e.g., `localhost.upstroke865@passmail.net`)
2. Create some data (identity, challenge, trade)
3. Note the IDs
4. Log out
5. Log in as a different user (or create a new account)
6. Verify you CANNOT see user A's data
7. Try to query user A's data directly via Supabase client:

```javascript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Try to fetch another user's identity
const { data, error } = await supabase
  .from('identities')
  .select('*')
  .eq('id', 'OTHER_USER_IDENTITY_ID');

// Should return empty or error due to RLS
console.log('RLS test:', { data, error });
```

### Test Direct Database Access

Open Supabase SQL Editor and run:

```sql
-- Switch to user context
SET request.jwt.claims = '{"sub": "9f791123-50ed-4f24-a31e-849e738970da"}';

-- Should return data for this user only
SELECT * FROM identities;

-- Switch to different user
SET request.jwt.claims = '{"sub": "different-user-id"}';

-- Should return empty
SELECT * FROM identities WHERE id = 'identity-from-first-user';
```

## Step 6: Test Real-time Updates (Optional)

Open two browser windows side by side, both logged in as the same user:

1. In window 1: Create a new identity
2. In window 2: Refresh and verify the identity appears

(Note: Real-time subscriptions are not implemented yet, so manual refresh is required)

## Step 7: Test Error Handling

### Test Network Errors

1. Open browser DevTools > Network tab
2. Throttle to "Offline"
3. Try to create an identity
4. Should show error state in UI
5. Restore network
6. Try again - should work

### Test Validation Errors

```javascript
// Try to create challenge without required fields
await store.addChallenge({
  identityId: 'non-existent-id',
  name: 'Invalid',
  // Missing required fields
});
// Should return null and log error
```

## Step 8: Performance Testing

### Test Large Dataset

1. Create 100+ trades in a loop
2. Measure response times
3. Check Supabase Dashboard > Database > Performance Insights
4. Verify indexes are being used

```javascript
const start = Date.now();
for (let i = 0; i < 100; i++) {
  await store.addTrade({
    identityId: store.identities[0].id,
    challengeId: null,
    sessionId: null,
    symbol: 'ES',
    direction: 'long',
    size: 1,
    entryPrice: 5000 + i,
    exitPrice: 5010 + i,
    directPnl: 50,
    currentPrice: null,
    stopLoss: null,
    takeProfit: null,
    fees: 2.50,
    notes: `Perf test ${i}`,
    screenshot: null,
  });
}
const elapsed = Date.now() - start;
console.log(`Created 100 trades in ${elapsed}ms (${(elapsed / 100).toFixed(2)}ms per trade)`);
```

## Step 9: Test Data Consistency

1. Create a challenge
2. Create multiple trades for that challenge
3. Create hedge pairs linking the trades
4. Delete the challenge (cascade)
5. Verify all related data is deleted from both store and database

## Step 10: Test Backup/Export (Legacy)

The old JSON export should still work for backups:

```javascript
import { downloadTradeLogBackupJson } from '@/models/trade-log/store';

// Download current state as JSON
await downloadTradeLogBackupJson();
```

## Common Issues & Solutions

### Issue: "Auth session missing!"

**Solution:** Make sure you're logged in. Check `localStorage` for auth tokens.

### Issue: Migration fails with "permission denied"

**Solution:** Verify RLS policies are correct and the user has proper permissions.

### Issue: Data not appearing after migration

**Solution:** 
1. Check Supabase Table Editor - is the data there?
2. Verify `user_id` matches your logged-in user
3. Check browser console for errors
4. Try manually calling `hydrate()`: `useTradingStore.getState().hydrate()`

### Issue: Changes not persisting

**Solution:**
1. Check network tab for failed requests
2. Verify Supabase connection in `.env.local`
3. Check if optimistic updates are rolling back (indicates server error)

## Success Criteria

- ✅ All database tables created with correct schema
- ✅ RLS policies active and enforcing user isolation
- ✅ Migration completes with correct counts
- ✅ Can create, read, update, delete all entity types
- ✅ Changes persist across page refreshes
- ✅ Different users cannot see each other's data
- ✅ Cascade deletes work correctly
- ✅ Error handling graceful
- ✅ Performance acceptable (< 500ms per operation)
- ✅ No data loss or corruption

## Next Steps

After successful testing:

1. Apply migration to production database
2. Enable real-time subscriptions (optional)
3. Set up database backups
4. Monitor performance in production
5. Deprecate old localStorage/Blob code
