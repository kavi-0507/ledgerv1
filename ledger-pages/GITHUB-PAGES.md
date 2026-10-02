# Deploy Ledger with GitHub Pages and Supabase

GitHub Pages hosts Ledger's static interface. Supabase Auth and Postgres store each signed-in person's workspace. The example month works before accounts are configured. No CSV file is stored by the app; imported transactions are saved in the user's workspace.

## 1. Set up Supabase

Ledger Pages uses Supabase project `mlbhshcwtsaqbipptmoq`, configured in `ledger-pages/.env.production`. The [repository migration](../supabase/migrations/20261002150000_ledger_workspaces.sql) has already been applied to that project. It adds the workspace table, row-level security policies, and an atomic save function. The function compares the supplied revision before writing; a stale tab receives a conflict instead of silently replacing newer data. Existing original-app data is not automatically converted to the new workspace format.

In this project's **Authentication → URL Configuration**, add `https://kavi-0507.github.io/ledgerv1/` as an allowed redirect URL. Keep email sign-in enabled. `ledger-pages/.env.production` contains this project's URL and active browser-safe publishable key; ignored `.env.local` uses the same values for local work. The repository root's `.env` belongs to the original app and is not used by Ledger Pages. Never use a secret or service-role key in this site.

## 2. Enable Pages in the existing GitHub repository

This app lives in `ledger-pages/` within the existing `kavi-0507/ledgerv1` repository. The original Lovable source remains in the repository. Never commit bank CSVs, account exports, or the local `.env` file. A Pages website is public even if the repository is private.

The build reads `ledger-pages/.env.production`; no GitHub Actions variables are required. It contains only the URL and publishable key, both of which are embedded in public browser code. Supabase row-level security, rather than key secrecy, protects each user's data.

Open **Settings → Pages** and choose **GitHub Actions** as the build source. Push the changes to `main`. The repository-root [Pages workflow](../.github/workflows/pages.yml) builds `ledger-pages/out/` and deploys it under `/ledgerv1/`.

## 3. Verify the deployed app

Open the Pages URL and check that the example loads. Choose **Use my own money**, request an email sign-in link, and follow it. Import a small CSV, categorize an uncertain merchant, set a budget, add and link a bill, reload, and confirm the data persisted. In two tabs, save in one and then try saving stale data in the other; Ledger should ask for a reload.

The previous private Site's D1 workspaces and the original Lovable app's Supabase tables are **not** migrated by publishing this app. Keep them available until any required export and account-by-account migration is complete. ChatGPT sign-in IDs do not automatically map to Supabase Auth IDs.

## Local development

Use Node.js 22.13 or later. Work from `ledger-pages/`. Its ignored `.env.local` is already populated for this checkout. For another checkout, copy `.env.example` to `.env.local` and use the same project URL and publishable key as `.env.production`. Add `http://localhost:3000/` to Supabase Auth's allowed redirect URLs if testing sign-in locally. Run `npm ci`, `npm run dev`, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. The static export appears in `out/`.

Ledger retains its v2 workspace format. [`lib/ledger.ts`](lib/ledger.ts) upgrades old workspace JSON, and [`lib/state-schema.ts`](lib/state-schema.ts) validates saves before the database call. [`lib/cloud-workspace.ts`](lib/cloud-workspace.ts) uses the official Supabase client for email-link sign-in, session refresh, scoped loads, and revision-checked saves. The browser stores only the Supabase authentication session locally; financial workspace data lives in Supabase.
