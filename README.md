# Controlled Practice Lab

A Vercel-ready React app for controlled Physics and Math practice tests.

## Admin Login

Seed admin credentials:

```text
username: admin
password: admin123
```

When Supabase environment variables are configured, users and attempts are stored in Supabase. Without those variables, the app falls back to browser local storage for local testing.

## Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run [supabase/schema.sql](/supabase/schema.sql).
4. Copy your Project URL and anon public key from Project Settings > API.
5. Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

6. In Vercel, add the same environment variables for Production.
7. Redeploy.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy To Vercel

Import this repository into Vercel or run:

```bash
npx vercel --prod
```
