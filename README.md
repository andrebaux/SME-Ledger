# Ledger — SME bookkeeping app

A mobile-friendly bookkeeping web app: sales, expenses (with overhead categories),
inventory (with restock/waste tracking), and per-event cost/income tracking.

## Local development

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

## Database

Run the SQL in `supabase.sql` in your Supabase project's SQL editor before first use.

## Deploying

See the step-by-step walkthrough provided alongside this project, or in short:

1. Create a Supabase project and run `supabase.sql`.
2. Push this folder to a GitHub repo.
3. Connect the repo to Netlify (build command `npm run build`, publish dir `dist`).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Netlify.
5. Deploy.

## Accounts

Each person signs in with their own email (password or magic link, both supported).
Every account's data is private — enforced by Supabase Row Level Security, not just
hidden in the UI. Signing in with the same email on another device loads that
person's own ledger there too.

**Before this works in production**, go to Supabase > Authentication > URL
Configuration and set your live Netlify URL as the Site URL (and add it under
Redirect URLs). Otherwise magic links and signup-confirmation emails will try to
redirect back to `localhost`.
