# Naukri Updater 🤖

Automated Playwright suite that logs into Naukri.com and "touches" the profile
(Name, Resume upload, Headline, Key skills, Employment, Education, IT skills)
to keep **Last Active / Last Updated** fresh for recruiters. Runs **every 2 hours**.

## Current state (done ✅)

- [x] Full Playwright suite (`tests/e2e/`) with user-facing locators (`getByRole`/`getByLabel`/…)
- [x] Standalone script (`src/scripts/complete-profile.ts`) with the same flow
- [x] Pushed to GitHub: `https://github.com/skb-nawaz/naukri-updater.git`
- [x] Jenkins pipeline (`Jenkinsfile`, every 2h) — **verified green (3 passed)**
- [x] GitHub Actions cloud schedule (`.github/workflows/naukri-scheduled.yml`, every 2h) — **needs setup below**

## Upcoming steps (do these next 🔜)

### 1. Add GitHub secrets (5 min) — REQUIRED
Repo page → **Settings → Secrets and variables → Actions → New repository secret**.
Copy values from your local `.env` file:

| Secret name | Value from `.env` |
|---|---|
| `NAUKRI_ENCRYPTION_KEY` | `ENCRYPTION_KEY=…` |
| `NAUKRI_EMAIL_ENCRYPTED` | `NAUKRI_EMAIL_ENCRYPTED=…` |
| `NAUKRI_PASSWORD_ENCRYPTED` | `NAUKRI_PASSWORD_ENCRYPTED=…` |

> `.env` itself is git-ignored and never committed — secrets only live in GitHub Settings.

### 2. Test the cloud run — REQUIRED
**Actions** tab → *Naukri updater (every 2h)* → **Run workflow** → wait ~2–3 min.
- **Green (3 passed)** → you're done; PC/Jenkins no longer needed. ✅
- **Red with `bot-wall "Access Denied"`** → GitHub's datacenter IP is flagged by Naukri.
  Fallback: Raspberry Pi at home or Oracle free-tier VM running the suite via cron.

### 3. Disable the Jenkins timer — REQUIRED (after step 2 is green)
Jenkins job page → **Disable Project** (or delete the job).
Never run Jenkins + GitHub timers together — parallel logins on one Naukri
account get blocked.

### 4. Ongoing maintenance (rare)
- **Naukri password changes** → re-run `npm run encrypt:creds -- --email YOU --password NEW --save`
  locally, then update the 3 GitHub secrets with the new values.
- **Resume changes** → replace `SKB_NAWAZ_Resume.pdf`, commit + push (runners check out `main` fresh each run).
- **Check runs occasionally** → Actions tab → green `3 passed` = healthy; artifacts
  (`test-results/`, `playwright-report/`) are kept 14 days per run.

## Local commands (reference)

| Command | Purpose |
|---|---|
| `npx playwright test` | Full suite (setup + login + profile update) |
| `npm run profile:complete` | Standalone single-run script |
| `npm run session:check` | Verify saved session without logging in |
| `npm run login` | Fresh headed login (solves CAPTCHA/OTP manually) |
| `npm run typecheck` | TypeScript check |

## Schedule reference

- GitHub Actions: `0 */2 * * *` (every 2h UTC) in `.github/workflows/naukri-scheduled.yml`
- Jenkins (legacy/backup): `H H/2 * * *` in `Jenkinsfile`
