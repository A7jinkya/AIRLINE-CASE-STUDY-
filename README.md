# Airline Insights - flight status analytics app

Interactive dashboard over the Airline Dataset (98,619 passenger records, 2022).
Static front-end (vanilla JS, SVG charts, no dependencies, no build step) plus one Vercel serverless function.

## Features
- Dashboard: filter by continent, gender, age group and month; KPIs, status donut, status mix by continent and age, monthly volume vs disruption rate, daily volume, age distribution. Light/dark mode.
- Explorer: sortable, searchable tables of departure countries and nationalities.
- Passengers: server-side search and filters across all records (`/api/passengers`).

## Deploy on Vercel
Option A - CLI: `npm i -g vercel`, then run `vercel` in this folder, then `vercel --prod`.
Option B - Git: push this folder to GitHub, then Vercel > Add New > Project > import. Framework preset: Other. Leave build command empty.
No environment variables needed. `vercel.json` sets output directory `public` and bundles `data/passengers.json` into the API function.

## Run locally
- `node scripts/dev-server.js` then open http://localhost:3000
- `node scripts/test.js` runs smoke tests

## Structure
    public/              index.html, style.css, app.js, charts.js, data/cube.json
    api/passengers.js    search/filter endpoint
    data/passengers.json compact record store used by the API (~8.7 MB)
    scripts/build_data.py regenerates data files from the original CSV
    vercel.json, package.json

## Regenerate data
    pip install pandas
    python scripts/build_data.py "Airline Dataset Updated - v2.csv"

## Data notes
- Dates like 06-10-2022 (38,961 rows) are ambiguous and read as day-first; M/D/YYYY dates are unambiguous.
- Arrival Airport "0" is treated as missing.
- Flight status is about one third each and unrelated to other fields, so the data looks synthetic.
