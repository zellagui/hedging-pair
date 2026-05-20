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

## Deploy on Vercel

Import this repo in [Vercel](https://vercel.com/new) (framework: Next.js). For a custom domain, add it under Project → **Settings** → **Domains** and set the DNS records Vercel shows at your registrar.

See [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying) for details.

### Cloud sync (Vercel Blob)

1. In the Vercel project, open **Storage** and connect a Blob store (e.g. `hedging-pair-blob`).
2. Under **Settings → Environment Variables**, set `journal_sync_secret` to a long random string (Production + Preview). Use `BLOB_READ_WRITE_TOKEN` from the linked Blob store (`blob_read_write_token` or `blob_token` also work). Do not rely on a custom `blob_token` unless it is the real read-write token value.
3. Redeploy after any env change.
4. In the app, go to **Data → Cloud sync**, paste the same secret, and **Save token**. The live file is `journal/main.json`. An older `trade-log-backup-*.json` in Storage is imported once and copied to `journal/main.json`. Use **Pull from cloud** to overwrite this browser from Blob; **Sync now** uploads local data.

Copy [`.env.example`](.env.example) to `.env.local` for local development with the same variables.
