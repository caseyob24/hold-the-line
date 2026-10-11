# Hold the Line

A sobriety tracker in the spirit of I Am Sober, with a military-command theme: day counters for every
"front" you're holding against, a daily quote from history's commanders, Outlook calendar sync with
high-risk evening flags, a sponsor role with alerts and notes, workout notes, and a Game Day screen
with live NFL, college football, NHL and MLB scores mapped to DirecTV Las Vegas channels.

It is a mobile-first installable web app (PWA): React + Vite on Netlify, Supabase for login and data,
Netlify Functions for anything that needs a secret.

## What's inside

| Path | What it is |
| --- | --- |
| `src/screens/` | The 14 screens from the approved mockups, plus login, lock and join |
| `src/lib/` | Supabase client, rank math, quote rotation, Outlook + push helpers |
| `src/data/quotes.json` | Daily quotes (`verified: true` = attribution checked against a source) |
| `src/data/directv-lv-channels.json` | Network → DirecTV Las Vegas channel seed map (verify, then edit in Settings) |
| `netlify/functions/` | `scores`, `calendar`, `ms-auth-start`, `ms-auth-callback`, `push-flush`, `notify-message`, `cron` |
| `supabase/migrations/0001_init.sql` | All tables, row level security, triggers and RPCs |
| `public/sw.js` | Service worker: offline shell + push notifications |

## Setup (about 30 minutes, once)

### 1. Supabase (database + login)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of `supabase/migrations/0001_init.sql`, run it.
3. **Authentication → URL Configuration**: set *Site URL* to your Netlify URL (e.g. `https://hold-the-line.netlify.app`)
   and add `https://hold-the-line.netlify.app/**` to *Redirect URLs*. Add `http://localhost:5173/**` too for local dev.
4. **Project Settings → API**: copy the *Project URL*, the *anon* key and the *service_role* key.

### 2. Push notification keys

```bash
npx web-push generate-vapid-keys
```

Keep the public and private key.

### 3. Encryption key for Outlook tokens

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Outlook (Microsoft Entra app)

1. [entra.microsoft.com](https://entra.microsoft.com) → **App registrations → New registration**.
   - Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
   - Redirect URI (Web): `https://YOUR-SITE.netlify.app/api/ms-auth-callback`
2. **Certificates & secrets → New client secret**; copy the *Value*.
3. **API permissions → Add → Microsoft Graph → Delegated**: `Calendars.ReadWrite`, `User.Read`, `offline_access`.
4. Copy the *Application (client) ID* from Overview.

A personal Outlook.com account works right away. A work account (e.g. One Inc) may need an IT admin
to grant consent for `Calendars.ReadWrite`.

### 5. Netlify

1. **Add new site → Import from GitHub →** pick this repo. Build settings come from `netlify.toml`.
2. **Site configuration → Environment variables**, add everything from `.env.example`:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key (secret) |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `MS_CLIENT_ID` / `MS_CLIENT_SECRET` | From the Entra app |
| `MS_TENANT` | `common` |
| `TOKEN_ENCRYPTION_KEY` | The 64-character hex string from step 3 |
| `SCORES_PROVIDER` | `espn` |

3. **Deploys → Trigger deploy**. Every push to `main` redeploys; pull requests get preview URLs.

### 6. On your phone

Open the site in Safari → Share → **Add to Home Screen**, then open it from the home screen and turn on
push in Settings. (iOS only allows web push for apps added to the home screen.)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npx netlify dev              # app + functions at http://localhost:8888
```

`npm run dev` runs the front end alone (functions won't respond). `npm run typecheck` checks both halves.

## How the pieces work

- **Counters** are computed from each front's start date; resetting writes the old streak to `streak_history`.
- **Ranks** (Recruit 1 day → General 2 years) are recorded in `milestones` when the app opens; a database
  trigger alerts sponsors who can see streaks.
- **Sponsor permissions** are enforced in Postgres row level security and the `sponsor_dashboard()` RPC,
  not just hidden in the UI. Urge notes are never shared; check-in notes only with the journal permission.
- **Alerts** (urge, reach-out, missed check-in at 11 am, rank in 3 days) are rows in `alerts`, pushed to the
  sponsor immediately after urges and reach-outs, and by the 15-minute `cron` function otherwise.
- **Outlook**: tokens are encrypted with AES-256-GCM before storage. App-created events carry a hidden
  extended property so the calendar can tell them apart.
- **Live scores** come from ESPN's public scoreboard JSON. It is unofficial and can change without notice;
  everything ESPN-specific is in `netlify/functions/scores.mts`, so a paid feed can replace it there.
  College football shows AP Top 25 games plus the teams you follow.
- **DirecTV channels**: there is no public DirecTV API. The seed numbers in `directv-lv-channels.json`
  need checking against your guide; fix any in Settings → TV provider. Vegas 34 is blank until you fill it in.

## Open items

- Verify DirecTV channel numbers (especially Vegas 34 for Golden Knights games).
- Grow `quotes.json` toward 200+ entries; entries marked `verified: false` are popular attributions that
  haven't been checked against a primary source.
- Health-recovery timeline copy on the Savings screen needs sourced medical content.
