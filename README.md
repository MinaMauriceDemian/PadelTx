# Padel Tour

Tournament manager for padel: groups + knockout or Americano, live scores, roles (admin / editor / viewer), WhatsApp sharing, and a community marketplace.
Live site: https://padeltx.netlify.app

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout only (no logic) |
| `css/styles.css` | All styling: Sporty Bold theme (day + night colors are variables at the end of the file), phone layout |
| `js/theme.js` | Day / night mode switch (remembers each person's choice) |
| `js/config.js` | Firebase settings |
| `js/app.js` | App shell: state, roles, home page (start page for everyone), optional login, account, access requests |
| `js/engine.js` | Tournament rules: groups, round robin, courts & hours, schedule, knockout, best-of, standings, final ranking |
| `js/setup.js` | Setup card: settings, courts editor, teams, team count, style, visibility |
| `js/schedule.js` | Schedule & scores: table (computer), match cards (phone), +/− buttons, live "now" marker, printing |
| `js/results.js` | Standings, knockout bracket, final ranking |
| `js/share.js` | Share dialog and WhatsApp messages |
| `js/market.js` | Marketplace: partner search, used gear, coaches & lessons, donation gifts |
| `js/americano.js` | Americano style: rotating partners (no repeats), points-per-match scoring, leaderboard; takes over the shared screens only for Americano tournaments |
| `js/players.js` | Players on teams: up to two per team, a linked profile or a guest name |
| `js/profile.js` | Player profile (created automatically at sign-in): level (self-reported, 0–7 with a level guide), progression, matches, statistics, preferences, partners & opponents, clubs |
| `js/main.js` | Starts the app |
| `js/cloud.js` | Firebase login and live database sync |
| `firestore.rules` | Database security rules (paste into Firebase → Firestore → Rules) |
| `tests/run.js` | Automated tests |

The scripts are loaded in the order listed in `index.html`; they share functions with each other, so keep that order.

## Run the tests

Needs Node.js 18 or newer.

```
npm install
npm test
```

The tests load the site in a simulated browser (Local mode, no Firebase) and play complete tournaments for 4–16 teams,
check courts and hours, best-of settings, the phone view, the live marker and WhatsApp messages.

## Deploy

Netlify publishes the repository as it is (no build step), through GitHub Actions:

| Workflow | When | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | Push to any branch except `Master` | Runs `npm test` on Node 20 and 22 |
| `.github/workflows/deploy.yml` | Pull request into `Master` | Tests, then a preview at `https://pr-<number>--padeltx.netlify.app` |
| `.github/workflows/deploy.yml` | Push to `Master` | Tests → staging (`https://staging--padeltx.netlify.app`) + smoke test → production + smoke test |

If the tests or the staging smoke test fail, the live site isn't changed.

One-time setup:
1. Netlify → User settings → Applications → create a personal access token. Netlify → Site configuration → General → copy the Site ID.
2. GitHub → Settings → Secrets and variables → Actions → add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
3. Netlify → Site configuration → Build & deploy → Continuous deployment → **Stop builds**, so only the workflow publishes.
4. GitHub → Settings → Rules → Rulesets → New ruleset → **Import a ruleset** → choose `.github/rulesets/protect-master.json`.
   From then on, changes reach `Master` only through a pull request whose tests and staging deploy are green; direct pushes, force pushes and deleting the branch are blocked.
5. Optional: GitHub → Settings → Environments → `production` → add yourself under Required reviewers to approve each release.

### Making a change

```
git checkout -b my-change
# edit, then
git commit -am "Describe the change"
git push -u origin my-change
```

Open the pull request from the link Git prints. Merge it once all checks are green.
