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
    const deploy = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy', 'deploy.sh'), 'utf8');
    assert.match(deploy, /--exclude "admin\.html"/);
    assert.match(deploy, /--exclude "grid-canvas\.html"/);
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
});

test('member creation uses an in-page form instead of prompt', () => {
    assert.match(html, /id="onbStep5"/);
    assert.match(applicationScript, /async function submitNewUser/);
    assert.doesNotMatch(applicationScript, /\bprompt\s*\(/);
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
