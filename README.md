# hedging-pair

Prop firm trade journal (Next.js): identities, challenges, trades, hedge pairs, CSV workspace sync, and JSON backup on the **Data** page.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Publish to GitHub (repo name: `hedging-pair`)

With [GitHub CLI](https://cli.github.com/) installed and logged in (`gh auth login`):

```bash
gh repo create hedging-pair --public --source=. --remote=origin --push
```

Or create an empty repo **hedging-pair** on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USER/hedging-pair.git
git push -u origin main
```

## Data Storage

Your journal data is automatically saved to Supabase (PostgreSQL). Each user's data is isolated via Row Level Security (RLS).

### First-Time Setup

1. Create a Supabase project at https://supabase.com
2. Apply the database migration from `supabase/migrations/20260529001208_initial_schema.sql`
3. Configure Supabase Auth redirect URLs for your production domain

See [`MIGRATION_INSTRUCTIONS.md`](MIGRATION_INSTRUCTIONS.md) and [`README_SUPABASE.md`](README_SUPABASE.md) for details.

## Deploy on Vercel

Import this repo in [Vercel](https://vercel.com/new) (framework: Next.js). For a custom domain, add it under Project → **Settings** → **Domains** and set the DNS records Vercel shows at your registrar.

Set these environment variables in your Vercel project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

**Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel** unless you need server-side admin operations. It bypasses Row Level Security.

Copy [`.env.example`](.env.example) to `.env.local` for local development with the same variables.

See [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying) for details.
