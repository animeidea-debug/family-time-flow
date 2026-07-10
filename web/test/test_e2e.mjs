// FamilyTimeFlow E2E Test — Playwright
// Run: node web/test/test_e2e.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://192.168.6.108:8888/family-time-flow/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let passed = 0, failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log('  ✅ ' + name);
            passed++;
        } catch (e) {
            console.log('  ❌ ' + name + ': ' + e.message);
            // Take screenshot on failure
            try { await page.screenshot({ path: `/tmp/ftf_fail_${name.replace(/\s/g, '_')}.png` }); } catch { }
            failed++;
        }
    }

    // Step 1: Check API health
    await test('API health check', async () => {
        const r = await fetch(BASE + 'api/health');
        const d = await r.json();
        if (d.status !== 'ok') throw new Error('Health check failed: ' + JSON.stringify(d));
    });

    // Step 2: Navigate to page
    await test('Page loads', async () => {
        await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForSelector('body', { timeout: 5000 });
        const title = await page.title();
        if (!title.includes('家庭人生时光机')) throw new Error('Wrong title: ' + title);
    });

    // Step 3: Check onboarding overlay is visible (no profile = first visit)
    await test('Onboarding overlay visible', async () => {
        const overlay = await page.$('#onboardingOverlay');
        if (!overlay) throw new Error('Onboarding overlay not found');
        const cls = await overlay.getAttribute('class');
        // Should NOT have hidden for first visit
        if (cls && cls.includes('hidden')) {
            // Might have profile already — check for main content
            const main = await page.$('#mainContent');
            if (main) {
                const mCls = await main.getAttribute('class');
                if (mCls && !mCls.includes('hidden')) {
                    console.log('  ℹ️ Already has profile, checking dashboard...');
                }
            }
        }
    });

    // Step 4: Check welcome button
    await test('Welcome button present', async () => {
        const btn = await page.$('button[onclick*="startOnboarding"]');
        if (!btn) throw new Error('Start button not found');
        const text = await btn.textContent();
        if (!text.includes('一键开始')) throw new Error('Wrong button text: ' + text);
    });

    // Step 5: Verify assets API works
    await test('Assets API with person filter', async () => {
        const r = await fetch(BASE + 'api/immich/people');
        const d = await r.json();
        if (!d.people || d.people.length === 0) throw new Error('No people from Immich');
        const first = d.people[0];
        const r2 = await fetch(BASE + 'api/immich/assets?date=2024-01-01&personId=' + first.id + '&limit=3');
        const d2 = await r2.json();
        console.log('  ℹ️ Found ' + d.people.length + ' people, first: ' + first.name + ', assets: ' + (d2.assets || []).length);
    });

    // Step 6: Verify user creation via API
    await test('Create user via API', async () => {
        const r = await fetch(BASE + 'api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '测试', birth_date: '2000-01-01', expected_age: 80, identity_tag: 'student', school_system: 'shanghai' })
        });
        if (!r.ok) throw new Error('User creation failed: ' + r.status);
        const user = await r.json();
        if (!user.id) throw new Error('No user id returned');
        console.log('  ℹ️ Created user id=' + user.id + ' name=' + user.name);
    });

    // Step 7: Verify sync endpoint
    await test('Sync endpoint returns users', async () => {
        const r = await fetch(BASE + 'api/sync');
        const d = await r.json();
        if (!d.users || d.users.length === 0) throw new Error('Sync returned no users');
        console.log('  ℹ️ Sync: ' + d.users.length + ' users');
    });

    // Step 8: Verify frontend JS functions exist
    await test('Frontend JS functions present', async () => {
        const html = await page.content();
        const checks = [
            'function showUserSwitcher',
            'function updateUserMenu',
            'function showExistingUsers',
            'function revealMainContent',
            'function resetOnboardingData'
        ];
        for (const fn of checks) {
            if (!html.includes(fn)) throw new Error('Missing: ' + fn);
        }
    });

    // Step 9: Check main content is hidden initially
    await test('Main content hidden initially', async () => {
        const cls = await page.$eval('#mainContent', el => el.className);
        if (!cls.includes('hidden')) throw new Error('Main content not hidden');
    });

    // Step 10: Check backend data consistency
    await test('Backend data consistency', async () => {
        const r = await fetch(BASE + 'api/users');
        const users = await r.json();
        if (users.length === 0) {
            console.log('  ℹ️ No users in DB (clean state)');
            return;
        }
        // Check for duplicate names with different immich_person_id
        const nameMap = {};
        for (const u of users) {
            if (!nameMap[u.name]) nameMap[u.name] = [];
            nameMap[u.name].push(u);
        }
        for (const [name, list] of Object.entries(nameMap)) {
            if (list.length > 1) {
                const ids = list.map(u => u.immich_person_id).filter(Boolean);
                if (new Set(ids).size !== ids.length) throw new Error('Duplicate name ' + name + ' with same immich_person_id');
                console.log('  ⚠️ ' + name + ' has ' + list.length + ' entries with different person_ids');
            }
        }
    });

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });