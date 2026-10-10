# re:Invent 2026 Catalog

A static website that displays the AWS re:Invent 2026 catalog sessions,
allowing you to sort and filter by location, day, and time.

## Requirements

- Node.js 18+

## Installation

```bash
npm install
npx playwright install chromium
```

## View the site locally

Open `index.html` directly in your browser, or serve the folder with
any static server, for example:

```bash
npx serve .
```

## Update catalog data

### ⭐ Automatic Credentials System (Recommended)

The application now **automatically extracts credentials in the background** without any action needed:

1. **When loading the page:**
   - The credential interceptor activates silently
   - Captures any valid credentials from API requests
   - Saves them to the browser's localStorage

2. **To refresh credentials when they expire:**
   - Simply **open the catalog page in another tab**:
     ```
     https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog
     ```
   - Credentials will be extracted **automatically in the background**
   - Return to this page and reload (F5) to use the new credentials

**Benefits:**
- ✅ Completely automatic - no user interaction needed
- ✅ No need to manually copy credentials
- ✅ Credentials are saved and reused for 7 days
- ✅ Works silently without any unusual displays

---

### Option A: Use the public API (if the automatic system fails)

1. Get the `rfapiprofileid` and `rfwidgetid` parameters:
    - Open https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog
    - Log in if necessary
    - Open DevTools (F12) → Network tab
    - Apply a filter in the catalog to trigger a request
    - Look for a POST request to `catalog.awsevents.com/api/sessions`
    - Copy the values of `rfapiprofileid` and `rfwidgetid` from the headers

2. Run the script with those parameters (replace with real values):

    ```bash
    # Windows (PowerShell)
    $env:API_PROFILE_ID = "YOUR_PROFILE_ID"
    $env:RF_WIDGET_ID = "YOUR_WIDGET_ID"
    npm run fetch

    # macOS/Linux (Bash)
    export API_PROFILE_ID="YOUR_PROFILE_ID"
    export RF_WIDGET_ID="YOUR_WIDGET_ID"
    npm run fetch
    ```

3. The script will download all sessions automatically and save them to `data/sessions.json`.

### Option B: Save the HTML manually

1. Log in to the catalog with your AWS account (resolving MFA).
2. Click "Show More" repeatedly until the button no longer appears
   (loads all sessions).
3. Save the complete page (Ctrl+S / Cmd+S) as "Complete web page"
   to `data/html/Event catalog.html` (overwrite the existing file).
4. Run:
    ```bash
    node parse-html.js
    ```
5. This regenerates `data/sessions.json` with all sessions.

### Option C: Automated scraping with Playwright

1. Run `npm run scrape`.
2. A Chromium window will open at the catalog URL.
3. Log in manually with your AWS account (resolve MFA if needed).
4. Navigate until the session catalog is visible on the page.
5. Return to the terminal and press Enter.
6. The script will automatically expand the entire list (clicks on "Show More"),
   extract the data and save it to `data/sessions.json`.

With any of the options, when finished review `data/sessions.json`
and commit/push to publish the updated data (if the site is hosted on
GitHub Pages, it will update automatically).

## My Schedule

From the catalog (`index.html`), each row has a checkbox to add
the session to your personal schedule. The selected IDs are saved in the
browser's `localStorage`, so they persist between reloads (but are
specific to that browser/device).

Click "My Schedule" in the top bar to go to `schedule.html`,
where you'll see a visual calendar with your sessions organized by day and
time. Sessions that overlap in time are highlighted in red with a
warning. Sessions without a day/time assigned (e.g., "Tabletop Experience")
appear in a separate list below the calendar.

## Run tests

```bash
npm test
```
