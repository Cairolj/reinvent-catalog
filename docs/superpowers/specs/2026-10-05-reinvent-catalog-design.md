# Design: re:Invent 2026 Session Catalog

## Objective

Build a static website that collects information from the AWS re:Invent 2026
session catalog
(https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog)
and allows sorting/filtering sessions by location, day, and time.

## Context and Constraints

- The catalog is a SPA: content is loaded via API/JS, not static HTML.
- The catalog requires login with an AWS account, and that account has MFA enabled.
  Therefore, data extraction **cannot be fully automated without human intervention**
  (there is no way to resolve MFA without a human).
- A **semi-manual workflow** is chosen: the user runs a scraping script locally
  when they want to refresh the data, logs in manually (resolving MFA), and the
  script extracts and saves the data. No GitHub Actions are used and credentials
  are not stored anywhere.
- The final site is completely static (HTML/CSS/vanilla JS, no backend, no build
  tools) so it can be hosted on GitHub Pages or opened locally.

## Components

### 1. Scraping script (`scrape.js`)

- Node.js + Playwright (in `headless: false` mode to allow manual login).
- Flow:
  1. Opens a visible Chromium browser.
  2. Navigates to the catalog URL.
  3. Waits for the user to manually log in (including MFA) and reach the loaded
     catalog page. The user is asked to press Enter in the console when the
     catalog is visible.
  4. The catalog paginates its results with a **"Show More"** button at the end
     of the list. The script clicks that button repeatedly (waiting for new items
     to load between each click) until the button is no longer present or no new
     sessions appear, ensuring the complete list is loaded before extracting data.
  5. Intercepts network responses (XHR/fetch) containing the catalog session data,
     or if not possible, extracts data from the already-rendered DOM (including
     everything loaded after "Show More" clicks).
  6. Normalizes the data into a list of session objects (see schema below),
     removing duplicates by `id`.
  7. Writes the result to `data/sessions.json`.
- Documented with clear usage instructions in the README.

### 2. Session data schema

Each session in `sessions.json` will have (when data is available):

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "day": "string (e.g. 'Monday, Nov 30')",
  "startTime": "string (e.g. '10:00 AM')",
  "endTime": "string",
  "location": "string (e.g. 'Venetian, Level 2, Murano 3205')",
  "track": "string (category/track)",
  "level": "string (e.g. '200 - Intermediate')",
  "speakers": ["string"]
}
```

If any field is not available in the actual scraping, it is left as an empty
string or omitted, without breaking the rest of the pipeline.

### 3. Static frontend

- `index.html`: base structure, table/list of sessions, filter and sorting controls.
- `styles.css`: simple and readable styles.
- `app.js`:
  - Loads `data/sessions.json` via `fetch`.
  - Renders sessions in a table.
  - Allows sorting by clicking on column headers (location, day, time).
  - Provides dropdown selectors to filter by location and by day.
  - Provides a free-text search field that filters by title/description/speakers.
  - Combines filters and sorting reactively (without reloading the page).

### 4. Data update flow

1. The user runs `node scrape.js` locally when they want fresh data.
2. They manually log in in the browser window that opens.
3. The script generates/updates `data/sessions.json`.
4. The user commits and pushes the changes.
5. If the site is on GitHub Pages, it updates automatically when pushing to the
   configured branch.

## File structure

```
reinvent/
├── scrape.js
├── package.json
├── data/
│   └── sessions.json       (generated, with initial example data)
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Testing / validation

- No automated tests of the scraper (depends on an external site with manual login);
  it is validated manually by reviewing `sessions.json` makes sense after each run.
- The frontend is validated manually in the browser using example data (placeholder)
  before having the real JSON, verifying that sorting and filters work correctly.

## Out of scope

- Full automation without human intervention (blocked by MFA).
- Backend/own server.
- Authentication or credential storage.
