# Vercel redeploy notes

- Framework preset: `Other`
- Install command: `bun install`
- Build command: `bun run build:vercel`
- Output directory: `.vercel/output`
- Root directory: project root

## Why this is needed

This project's default build is configured for a Cloudflare-style runtime.
For Vercel, the build must switch to Nitro output so Vercel can serve the app
through its function + static output format instead of returning a platform 404.

## Required environment variables in Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

If you use any server-only secrets later, those must also be added to Vercel.