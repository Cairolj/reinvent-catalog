const fs = require("fs");
const path = require("path");
const readline = require("readline");

const API_URL = "https://catalog.awsevents.com/api/sessions";
const OUTPUT_PATH = path.join(__dirname, "data", "sessions.json");
const BATCH_SIZE = 50;

// Try to get from environment variables first, then use defaults
// IMPORTANT: These values expire and need to be updated from browser DevTools
let API_PROFILE_ID = process.env.API_PROFILE_ID;
let RF_WIDGET_ID = process.env.RF_WIDGET_ID;

async function fetchSessionsBatch(from = 0) {
    const params = new URLSearchParams({
        type: "session",
        browserTimezone: "America/Costa_Rica",
        catalogDisplay: "list",
        from: from.toString(),
    });

    console.log(`Fetching batch from=${from}...`);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                rfapiprofileid: API_PROFILE_ID,
                rfwidgetid: RF_WIDGET_ID,
            },
            body: params.toString(),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Check for API-level errors (e.g., missing apiProfile)
        if (data.responseCode && data.responseCode !== "200") {
            throw new Error(
                `API Error: ${data.responseMessage || data.responseCode}`,
            );
        }

        return data;
    } catch (error) {
        console.error(`Error fetching batch from=${from}:`, error.message);
        throw error;
    }
}

function getApiCredentialsInstructions() {
    return `
╔════════════════════════════════════════════════════════════════════╗
║  API Credentials Need to be Updated                               ║
╚════════════════════════════════════════════════════════════════════╝

The apiProfile and rfWidgetId parameters have likely expired.
Follow these steps to get the current values:

1. Open in your browser:
   https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog

2. Log in with your AWS Builder ID (or your AWS account)

3. Once logged in and the catalog loads, open DevTools (F12)

4. Go to the "Network" tab

5. Apply any filter or scroll in the catalog to trigger an API request

6. Look for a POST request to "catalog.awsevents.com/api/sessions"
   (it should be in blue/highlighted)

7. Click on that request

8. Go to the "Request" section and find "Form data"

9. Copy the value of:
   - apiProfile: (example: "mSEPBdEOSHwzxJwd7H8MfSWVylSYQsS4")
   - rfWidgetId: (example: "nbNFIlUhukEGI22KvPEwpPdWgK6FoPsi")

10. Set these as environment variables and retry:
    
    On Windows (PowerShell):
    \$env:API_PROFILE_ID = "YOUR_API_PROFILE_ID"
    \$env:RF_WIDGET_ID = "YOUR_RF_WIDGET_ID"
    node fetch-catalog.js

    On macOS/Linux (Bash):
    export API_PROFILE_ID="YOUR_API_PROFILE_ID"
    export RF_WIDGET_ID="YOUR_RF_WIDGET_ID"
    node fetch-catalog.js
`;
}

async function promptForCredentials() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(
            "Enter apiProfile ID (or press Enter to skip and use instructions): ",
            (profile) => {
                if (!profile.trim()) {
                    rl.close();
                    resolve(null);
                    return;
                }
                rl.question(
                    "Enter rfWidgetId (or press Enter to skip): ",
                    (widget) => {
                        rl.close();
                        if (widget.trim()) {
                            resolve({
                                profile: profile.trim(),
                                widget: widget.trim(),
                            });
                        } else {
                            resolve(null);
                        }
                    },
                );
            },
        );
    });
}

async function main() {
    // If no credentials in env, try to prompt or show instructions
    if (!API_PROFILE_ID || !RF_WIDGET_ID) {
        console.log(
            "\n⚠️  apiProfile and rfWidgetId not found in environment variables.\n",
        );

        const userInput = await promptForCredentials();

        if (userInput) {
            API_PROFILE_ID = userInput.profile;
            RF_WIDGET_ID = userInput.widget;
            console.log("Using provided credentials...\n");
        } else {
            console.log(getApiCredentialsInstructions());
            process.exit(1);
        }
    }

    console.log("🔄 Starting catalog download from public API...\n");

    const allSessions = [];
    let from = 0;
    let batchCount = 0;
    let previousBatchSize = 0;

    try {
        while (true) {
            const batchData = await fetchSessionsBatch(from);

            // Handle different response formats
            const sessionsBatch = Array.isArray(batchData)
                ? batchData
                : batchData.sessions || [];

            if (sessionsBatch.length === 0) {
                console.log(
                    `✓ No more sessions at from=${from}. Stopping pagination.\n`,
                );
                break;
            }

            allSessions.push(...sessionsBatch);
            batchCount++;
            previousBatchSize = sessionsBatch.length;

            console.log(
                `  ✓ Batch ${batchCount}: ${sessionsBatch.length} sessions (total: ${allSessions.length})`,
            );

            // Wait a bit between requests to not overload the server
            await new Promise((resolve) => setTimeout(resolve, 500));

            from += BATCH_SIZE;

            // Safety limit to avoid infinite loops
            if (batchCount > 100) {
                console.warn("⚠️  Reached batch limit (100). Stopping.");
                break;
            }
        }

        // Deduplicate by ID
        const seen = new Map();
        for (const session of allSessions) {
            if (session.id && !seen.has(session.id)) {
                seen.set(session.id, session);
            }
        }
        const sessions = Array.from(seen.values());

        // Create directory if it doesn't exist
        const dataDir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Save to JSON
        fs.writeFileSync(
            OUTPUT_PATH,
            JSON.stringify(sessions, null, 2),
            "utf-8",
        );

        console.log(
            `✓ Downloaded and saved ${sessions.length} sessions to ${OUTPUT_PATH}`,
        );
        console.log(`  Files deduplicated by ID.\n`);
    } catch (error) {
        console.error("✗ Error during download:", error.message);
        console.log(getApiCredentialsInstructions());
        process.exit(1);
    }
}

main();
