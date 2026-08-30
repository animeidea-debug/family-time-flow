const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'html', 'family-time-flow', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(source => source.trim());
const applicationScript = inlineScripts.at(-1);

test('frontend uses version-locked local assets without CDN dependencies', () => {
    assert.doesNotMatch(html, /<(?:script|link)[^>]+https?:\/\//i);
    for (const asset of [
        'app.min.css',
        'flatpickr.min.css',
        'gsap.min.js',
        'flatpickr.min.js',
        'flatpickr-zh.js'
    ]) {
        assert.match(html, new RegExp(`(?:href|src)=["']\\./assets/${asset.replaceAll('.', '\\.')}`));
        assert.ok(fs.statSync(path.join(__dirname, '..', 'html', 'family-time-flow', 'assets', asset)).size > 0);
    }
    const manifest = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'html', 'family-time-flow', 'assets', 'manifest.json'),
        'utf8'
    ));
    assert.deepEqual(manifest.versions, {
        daisyui: '4.12.14',
        flatpickr: '4.6.13',
        gsap: '3.12.5',
        tailwindcss: '3.4.17'
    });
});

test('all inline scripts parse', () => {
    inlineScripts.forEach((source, index) => {
        assert.doesNotThrow(() => new vm.Script(source), `inline script ${index + 1} should parse`);
    });
});

test('startup has one authoritative bootstrap decision', () => {
    const domReady = applicationScript.slice(applicationScript.indexOf("document.addEventListener('DOMContentLoaded'"));
    assert.match(domReady, /bootstrapApplication\(\)/);
    assert.doesNotMatch(domReady, /syncFromApi\(\)/);
    assert.doesNotMatch(domReady, /checkImmichStatus\(\)/);
    assert.doesNotMatch(domReady, /\/health/);
    const bootstrapBody = applicationScript.slice(
        applicationScript.indexOf('async function bootstrapApplication'),
        applicationScript.indexOf('async function apiGet')
    );
    assert.doesNotMatch(bootstrapBody, /checkImmichStatus|immichGet/);
});

test('active member is stored separately from the legacy profile cache', () => {
    assert.match(applicationScript, /const ACTIVE_MEMBER_KEY/);
    assert.match(applicationScript, /localStorage\.setItem\(ACTIVE_MEMBER_KEY, normalizedId\)/);
    const switchBody = applicationScript.slice(
        applicationScript.indexOf('async function switchUser'),
        applicationScript.indexOf('function updateUserMenu')
    );
    assert.doesNotMatch(switchBody, /saveState\(\)/);
    assert.doesNotMatch(applicationScript, /localStorage\.setItem\(STATE_KEY/);
    assert.match(applicationScript, /localStorage\.removeItem\(STATE_KEY\)/);
    assert.match(applicationScript, /const PREFERENCES_KEY/);
});

test('frontend contains no embedded Immich credential or automatic configuration', () => {
    assert.doesNotMatch(applicationScript, /const IMMICH_KEY/);
    assert.doesNotMatch(applicationScript, /apiPost\('\/immich\/config'/);
});

test('experimental admin and canvas pages are excluded from deployment', () => {
    const deploy = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy', 'legacy-webdav-push.sh'), 'utf8');
    assert.match(deploy, /--exclude "admin\.html"/);
    assert.match(deploy, /--exclude "grid-canvas\.html"/);
});

test('nginx limits FamilyTimeFlow to the home LAN and internal backend network', () => {
    const nginx = fs.readFileSync(path.join(__dirname, '..', 'conf.d', 'family-time-flow.conf'), 'utf8');
    assert.match(nginx, /allow 192\.168\.0\.0\/16;/);
    assert.match(nginx, /deny all;/);
    assert.match(nginx, /proxy_pass http:\/\/ftf-backend:3000;/);
    assert.doesNotMatch(nginx, /172\.17\.0\.1:3000/);
});

test('household home is available without Immich', () => {
    assert.match(html, /id="householdView"/);
    assert.match(applicationScript, /async function showHouseholdView/);
    assert.match(applicationScript, /apiGet\('\/household\/view'\)/);
    const householdSource = applicationScript.slice(
        applicationScript.indexOf('async function showHouseholdView'),
        applicationScript.indexOf('async function bootstrapApplication')
    );
    assert.doesNotMatch(householdSource, /immichGet|checkImmichStatus/);
    assert.match(householdSource, /function createHouseholdMemberAvatar/);
    assert.match(householdSource, /member\.immich && member\.immich\.personId/);
    assert.match(householdSource, /\/immich\/person-thumb\?id=/);
});

test('members without a target do not receive a fabricated countdown', () => {
    assert.match(applicationScript, /targetDate:\s*null/);
    assert.match(applicationScript, /if \(!state\.targetDate\)/);
    assert.match(applicationScript, /label\.textContent = '尚未设置目标'/);
    assert.doesNotMatch(applicationScript, /90 \* 24 \* 60 \* 60 \* 1000/);
});

test('member creation uses an in-page form instead of prompt', () => {
    assert.match(html, /id="onbStep5"/);
    assert.match(applicationScript, /async function submitNewUser/);
    assert.doesNotMatch(applicationScript, /\bprompt\s*\(/);
});

test('Immich onboarding supports multi-select preview with manual fallback', () => {
    for (const id of ['onbPersonList', 'onbPersonSummary', 'onbReviewPeople', 'onbPreviewContent', 'onbImportButton']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    for (const functionName of ['startAddMemberFlow', 'showPersonSelection', 'reviewSelectedPeople', 'confirmOnboarding', 'createNewUser']) {
        assert.match(applicationScript, new RegExp(`function\\s+${functionName}\\s*\\(`));
    }
    assert.equal((html.match(/onclick="startAddMemberFlow\(\)"/g) || []).length, 3);
    const addMemberBody = applicationScript.slice(
        applicationScript.indexOf('async function startAddMemberFlow'),
        applicationScript.indexOf('function showPersonSelection')
    );
    assert.match(addMemberBody, /onboardingOverlay/);
    assert.match(addMemberBody, /onboardingPersonIds = new Set\(\)/);
    assert.match(addMemberBody, /await startOnboarding\(\)/);
    assert.match(applicationScript, /person\.linked === true \|\| initializedIds\.has\(person\.id\)/);
    assert.match(applicationScript, /可选 \$\{selectableCount\} 位 · 已创建 \$\{initializedCount\} 位/);
    assert.match(applicationScript, /Number\(a\.isInitialized\) - Number\(b\.isInitialized\)/);
    assert.match(applicationScript, /\/onboarding\/immich-import/);
    assert.match(applicationScript, /\/onboarding\/immich-import'[\s\S]*timeoutMs:\s*10000/);
    assert.match(html, /id="onboardingSourceHint"/);
    assert.match(html, /id="immichMemoryTitle"/);
    assert.match(applicationScript, /data\.integrations\?\.immich\?\.configured === true/);
    assert.match(applicationScript, /function renderImmichStatus/);
    assert.doesNotMatch(html, /Immich 集成将在 Phase 3 上线/);
    assert.equal([...applicationScript.matchAll(/function\s+updateTicker\s*\(/g)].length, 1);
    assert.match(applicationScript, /人物档案已连接 · 照片回忆功能将在后续版本开放/);
});

test('theme controls preserve readable semantic colors and visible focus', () => {
    assert.match(html, /--secondary-text-color:/);
    assert.match(html, /--muted-text-color:/);
    assert.match(html, /\.btn\.btn-accent\s*\{/);
    assert.match(html, /button:focus-visible/);
    assert.match(applicationScript, /button\.classList\.toggle\('theme-switch-active', isActive\)/);
    assert.match(applicationScript, /button\.setAttribute\('aria-pressed', String\(isActive\)\)/);
});

test('brand navigation stays within the deployed application path', () => {
    assert.match(html, /<a href="\.\/" class="flex items-center gap-2 no-underline">/);
    assert.doesNotMatch(html, /<a href="\/" class="flex items-center gap-2 no-underline">/);
});

test('household events use in-page create, edit, and two-step delete controls', () => {
    assert.match(html, /id="eventFormOverlay"/);
    assert.match(applicationScript, /async function submitEventForm/);
    assert.match(applicationScript, /async function requestDeleteEvent/);
    assert.match(applicationScript, /dataset\.confirm !== 'armed'/);
    assert.doesNotMatch(applicationScript, /\bconfirm\s*\(/);
});

test('settings are separated into member, household, and system panels', () => {
    for (const panel of ['settingsMemberPanel', 'settingsHouseholdPanel', 'settingsSystemPanel']) {
        assert.match(html, new RegExp(`id="${panel}"`));
    }
    assert.match(applicationScript, /function openSettingsTab/);
    assert.match(applicationScript, /async function saveHouseholdConfig/);
    assert.match(applicationScript, /async function refreshSystemStatus/);
    assert.match(applicationScript, /apiPatch\('\/household'/);
});

test('member lifecycle uses color, explicit ordering, and scoped deletion', () => {
    for (const id of ['cfgMemberColor', 'memberDeletePanel', 'confirmDeleteMemberButton']) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(applicationScript, /async function moveMember/);
    assert.match(applicationScript, /apiPatch\('\/users\/order'/);
    assert.match(applicationScript, /async function requestDeleteMember/);
    assert.match(applicationScript, /async function confirmDeleteMember/);
    assert.doesNotMatch(html, /重置所有数据|resetOnboardingData/);
});

test('service failure has an explicit in-page retry path', () => {
    assert.match(html, /id="onbRetryButton"/);
    assert.match(applicationScript, /function showServiceUnavailable/);
    assert.match(applicationScript, /async function retryApplication/);
    const bootstrapBody = applicationScript.slice(
        applicationScript.indexOf('async function bootstrapApplication'),
        applicationScript.indexOf('async function apiGet')
    );
    assert.match(bootstrapBody, /showServiceUnavailable\(\)/);
});
