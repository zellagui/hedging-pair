# Trading Journal - Supabase Integration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and add your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://wbpxcafugvubyxtpqfls.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

### 3. Apply Database Schema

See `MIGRATION_INSTRUCTIONS.md` for detailed steps.

**Quick method (Supabase Dashboard):**

1. Go to https://supabase.com/dashboard/project/wbpxcafugvubyxtpqfls/sql
2. Open `supabase/migrations/20260529001208_initial_schema.sql`
3. Copy and paste the entire contents
4. Click "Run"

### 4. Migrate Existing Data (Optional)

If you have existing data to migrate:

```bash
npx tsx scripts/run-migration.ts "path/to/backup.json" <user-id>
```

### 5. Start Development Server

```bash
npm run dev
```

Navigate to http://localhost:3000 and log in.

## Project Structure

### Supabase Integration

```
src/
├── lib/
│   └── supabase/
│       ├── client.ts          # Client-side Supabase client
│       ├── server.ts          # Server-side Supabase client
│       ├── proxy.ts           # Session refresh middleware
│       ├── queries.ts         # Data access layer (CRUD)
│       └── migrate-user-data.ts  # Migration utilities
├── models/
│   └── trade-log/
│       ├── types.ts           # TypeScript types
│       ├── store-supabase.ts  # Supabase-backed Zustand store
│       └── [legacy files]     # Old localStorage code
├── components/
│   ├── providers/
│   │   └── data-sync-provider.tsx  # Data hydration
│   └── auth/
│       ├── login-form.tsx     # Login UI
│       ├── sign-up-form.tsx   # Sign-up UI
│       └── logout-button.tsx  # Logout UI
├── app/
│   ├── auth/                  # Auth pages
│   ├── api/
│   │   └── migrate-data/      # Migration API
│   └── (journal)/             # Protected journal pages
└── supabase/
    └── migrations/
        └── 20260529001208_initial_schema.sql  # Database schema
```

## Data Model

### Tables

- **identities**: User workspaces/trader profiles
- **challenges**: Prop-firm evaluations and funded accounts
- **trades**: Individual trade legs (prop or personal)
- **hedge_pairs**: Links prop + personal legs
- **phase_plans**: Pre-planned hedge strategies
- **journal_sessions**: Daily trading sessions
- **user_journal_settings**: User preferences

### Row Level Security (RLS)

All tables enforce user isolation via RLS policies:

```sql
create policy "users_own_identities" on identities
  for all using (auth.uid() = user_id);
```

Users can only access their own data. Attempting to access another user's data returns empty results.

## Development

### Adding a New Feature

1. **Database Changes**
   - Create a new migration file
   - Add/modify tables, columns, or constraints
   - Apply migration to Supabase

2. **TypeScript Types**
   - Update `src/models/trade-log/types.ts`
   - Add any new types or update existing ones

3. **Queries**
   - Add CRUD functions to `src/lib/supabase/queries.ts`
   - Follow existing patterns for consistency

4. **Store**
   - Add methods to `src/models/trade-log/store-supabase.ts`
   - Implement optimistic updates
   - Handle errors with rollback

5. **UI**
   - Create/update components
   - Use store hooks: `useTradingStore((s) => s.methodName)`

### Common Patterns

#### Fetching Data

```typescript
import { useTradingStore } from '@/lib/trading/store';

function MyComponent() {
  const identities = useTradingStore((s) => s.identities);
  const isLoading = useTradingStore((s) => s.isLoading);

  if (isLoading) return <div>Loading...</div>;
  
  return (
    <ul>
      {identities.map(id => <li key={id.id}>{id.name}</li>)}
    </ul>
  );
}
```

#### Creating Data

```typescript
const addIdentity = useTradingStore((s) => s.addIdentity);

async function handleCreate() {
  const id = await addIdentity({
    name: 'New Workspace',
    note: 'My notes'
  });
  
  if (id) {
    console.log('Created:', id);
  }
}
```

#### Updating Data

```typescript
const updateChallenge = useTradingStore((s) => s.updateChallenge);

async function handleUpdate(challengeId: string) {
  await updateChallenge(challengeId, {
    status: 'passed'
  });
}
```

### Testing

See `TESTING_GUIDE.md` for comprehensive testing procedures.

**Quick smoke test:**

```bash
# Start dev server
npm run dev

# In another terminal, run tests (when implemented)
npm test
```

## Deployment

### Environment Variables

Set in your hosting platform (Vercel, etc.):

```
NEXT_PUBLIC_SUPABASE_URL=https://wbpxcafugvubyxtpqfls.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your_key>
```

### Database

1. Apply migrations to production Supabase project
2. Verify RLS policies are active
3. Set up database backups

### Application

1. Build: `npm run build`
2. Test production build: `npm start`
3. Deploy to hosting platform

## Troubleshooting

### "Auth session missing!"

You're not logged in. Navigate to `/auth/login`.

### Data not loading

1. Check `.env.local` has correct Supabase credentials
2. Check browser console for errors
3. Check Supabase Dashboard > Logs for API errors
4. Verify RLS policies allow access

### Migration fails

1. Ensure database schema is applied first
2. Check user ID is correct
3. Verify backup file format is valid
4. Check Supabase logs for detailed errors

### Store updates not persisting

1. Check network tab for failed requests
2. Verify Supabase connection
3. Check RLS policies
4. Look for error logs in console

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- Project Documentation:
  - `MIGRATION_INSTRUCTIONS.md` - Schema setup
  - `TESTING_GUIDE.md` - Test procedures
  - `SUPABASE_MIGRATION_COMPLETE.md` - Implementation details

## Support

For issues specific to this project:

1. Check existing documentation
2. Check browser console for errors
3. Check Supabase Dashboard logs
4. Check your RLS policies are correct

## License

[Your License Here]
