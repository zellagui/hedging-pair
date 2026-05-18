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
