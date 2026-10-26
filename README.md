# Padel Tour

Tournament manager for padel: groups + knockout, live scores, roles (admin / editor / viewer), WhatsApp sharing, and a community marketplace.
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

Netlify publishes the repository as it is (no build step). Every commit to `main` updates the live site.
