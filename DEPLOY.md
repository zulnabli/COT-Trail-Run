# VPS setup

## Test on a phone locally

Run `corepack pnpm dev` on the computer. In local mode, `http://localhost:3000` syncs its browser data and then redirects to the computer's detected LAN IP. Open that IP on the phone while both devices are on the same trusted Wi-Fi. The shared file is `data/local-workspace.json` and is ignored by Git.

This unauthenticated local mode is for a trusted LAN only. Do not expose the dev server or port 3000 to the public internet.

## Requirements

- Node.js 22 or newer
- pnpm 12
- Docker Compose
- A domain with HTTPS for Google sign-in in production
- A Google OAuth web client

## Configure

1. Copy `.env.example` to `.env` on the server. Do not commit `.env`.
2. Set `POSTGRES_PASSWORD` to a long random alphanumeric value and use the same value in `DATABASE_URL`.
3. Set `NEXTAUTH_URL` to the public HTTPS origin, `NEXTAUTH_SECRET` to a unique random secret, and add the Google OAuth client ID and secret.
4. Set `NEXT_PUBLIC_SYNC_ENABLED=true` to enable Google login and VPS sync.
5. In Google Cloud Console, add `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI.

Keep PostgreSQL bound to `127.0.0.1`; do not expose port 5432 publicly. The Compose volume persists the database when the container restarts.

## Start

```sh
docker compose up -d db
corepack pnpm install --frozen-lockfile
corepack pnpm db:push
corepack pnpm build
corepack pnpm start
```

Run Next.js behind Nginx or Caddy with HTTPS. For production, run the app with a process manager such as systemd or PM2. Back up the `lepas_cot_postgres` volume regularly.

Each signed-in Google account has a separate workspace. The server uses the authenticated account ID for all reads and writes; CSV files and saved races are stored in PostgreSQL on this VPS.