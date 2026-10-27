# Padel Tour

Tournament manager for padel: groups + knockout or Americano, live scores, roles (admin / editor / viewer), WhatsApp sharing, and a community marketplace.
Live site: https://minamauricedemian.github.io/PadelTx/ (GitHub Pages; use this address. The old padeltx.netlify.app address is unreachable from Egypt since June 2026.)

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
| `js/schedule.js` | Schedule & scores: table (computer), swipeable time slots (phone), +/− buttons, live bar, printing |
| `js/results.js` | Standings, knockout bracket, final ranking |
| `js/share.js` | Share dialog and WhatsApp messages |
| `js/market.js` | Marketplace: partner search, used gear, coaches & lessons, donation gifts |
| `js/americano.js` | Americano style: rotating partners (no repeats), points-per-match scoring, leaderboard; takes over the shared screens only for Americano tournaments |
| `js/players.js` | Players on teams: up to two per team, a linked profile or a guest name |
| `js/profile.js` | Player profile (created automatically at sign-in): level (self-reported, 0–7 with a level guide), progression, matches, statistics, preferences, partners & opponents, clubs |
| `js/follow.js` | Follow a team or player: highlights their matches and shows their next match |
| `js/info.js` | About & contact and Privacy texts (contact details come from `SITE_CONTACT` in `js/config.js`) |
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

GitHub Pages publishes the repository as it is (no build step). Every commit to `main` updates the live site within about a minute. The repository must stay public for GitHub Pages on the free plan.
1
