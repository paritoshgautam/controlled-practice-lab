# Controlled Practice Lab

A Vercel-ready React app for controlled Physics and Math practice tests.

## Admin Login

Seed admin credentials:

```text
username: admin
password: admin123
```

The current admin console uses browser local storage so it can run as a static Vercel app. That is useful for a parent-managed single browser, but true multi-device student tracking should use a hosted database/auth provider such as Supabase, Firebase, or Vercel Postgres.

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
