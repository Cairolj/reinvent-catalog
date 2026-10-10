/**
 * Extract AWS Catalog API credentials automatically from the browser
 * Opens the catalog and captures credentials from the first API request
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function extractCredentials() {
    let browser;
    try {
        console.log('🔍 Opening browser to extract credentials...\n');
        
        browser = await chromium.launch({ headless: false });
        const context = await browser.createBrowserContext();
        const page = await context.newPage();

        // Listen for all requests
        let foundCredentials = false;
        page.on('request', (request) => {
            if (request.url().includes('catalog.awsevents.com/api/sessions')) {
                const headers = request.headers();
                const rfapiprofileid = headers['rfapiprofileid'];
                const rfwidgetid = headers['rfwidgetid'];

                if (rfapiprofileid && rfwidgetid) {
                    if (!foundCredentials) {
                        foundCredentials = true;
                        console.log('\n✅ Credentials found!\n');
                        console.log('Copy these values:\n');
                        console.log(`API_PROFILE_ID: ${rfapiprofileid}`);
                        console.log(`RF_WIDGET_ID:   ${rfwidgetid}\n`);
                        console.log('To use them, run in PowerShell:\n');
                        console.log(`$env:API_PROFILE_ID = "${rfapiprofileid}"`);
                        console.log(`$env:RF_WIDGET_ID = "${rfwidgetid}"`);
                        console.log('npm run fetch\n');
                    }
                }
            }
        });

        console.log('📖 Accessing the catalog...');
        console.log('(Wait for it to load, may take 10-30 seconds)\n');
        
        await page.goto('https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('✓ Page loaded. Waiting for API request to fire...\n');
        
        // Simulates a click or scroll to trigger the request
        console.log('🔄 Applying a filter to trigger the API request...\n');
        
        // Wait 3 seconds then try to find an input to trigger search
        await page.waitForTimeout(3000);
        
        // Try to click an element that triggers the request
        try {
            await page.evaluate(() => {
                // Scroll to trigger lazy loading
                document.body.scrollTop = document.body.scrollHeight;
                window.scrollBy(0, window.innerHeight);
            });
        } catch (e) {
            // Ignore
        }

        // Wait for credentials to be found
        for (let i = 0; i < 20; i++) {
            if (foundCredentials) break;
            await page.waitForTimeout(500);
        }

        if (!foundCredentials) {
            console.log('⚠️  Credentials not found automatically.');
            console.log('Please:');
            console.log('1. Open DevTools (F12)');
            console.log('2. Go to Network tab');
            console.log('3. Look for a POST request to "catalog.awsevents.com/api/sessions"');
            console.log('4. Copy rfapiprofileid and rfwidgetid from Headers');
            console.log('5. Press Enter in this terminal when you have the credentials\n');

            await page.waitForTimeout(60000); // Wait 1 minute
        }

        console.log('ℹ️  Keep the browser open to continue working...');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('net::ERR_TIMED_OUT')) {
            console.log('\nℹ️  Possible issue:');
            console.log('- Check your internet connection');
            console.log('- The page may need VPN authentication');
        }
    } finally {
        // Don't close the browser so the user can see the credentials
        // await browser.close();
    }
}

extractCredentials();
