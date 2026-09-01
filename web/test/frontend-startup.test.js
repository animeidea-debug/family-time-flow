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
    assert.match(applicationScript, /data\.integrations\?\.immich\?\.memoriesEnabled === true/);
    assert.match(applicationScript, /data\.integrations\?\.immich\?\.weekHoverEnabled === true/);
    assert.match(applicationScript, /function renderImmichStatus/);
    assert.doesNotMatch(html, /Immich 集成将在 Phase 3 上线/);
    assert.equal([...applicationScript.matchAll(/function\s+updateTicker\s*\(/g)].length, 1);
    assert.match(applicationScript, /人物档案已连接 · 照片回忆尚未启用/);
});

test('on-this-day memories are feature flagged, retryable, and preview-only', () => {
    for (const id of [
        'immichMemoryStatus', 'immichMemoryGallery', 'immichMemoryRetry',
        'immichMemoryRefresh', 'memoryPreviewOverlay', 'memoryPreviewImage'
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(applicationScript, /async function loadOnThisDayMemories/);
    assert.match(applicationScript, /if \(!immichConfigured \|\| !immichMemoriesEnabled/);
    assert.match(applicationScript, /if \(immichWeekHoverEnabled && immichConnected && state\.immichSync\)/);
    assert.doesNotMatch(applicationScript, /if \(immichMemoriesEnabled && immichConnected && state\.immichSync\)/);
    assert.match(applicationScript, /\/on-this-day\?month=\$\{now\.getMonth\(\) \+ 1\}&day=\$\{now\.getDate\(\)}&limit=6/);
    assert.match(applicationScript, /immichGet\(path, \{ timeoutMs: 10000 \}\)/);
    assert.match(applicationScript, /function openMemoryPreview/);
    assert.match(applicationScript, /&size=preview/);
    assert.match(applicationScript, /function closeMemoryPreview/);
    assert.match(applicationScript, /image\.removeAttribute\('src'\)/);
    assert.match(applicationScript, /memoryPreviewTrigger\.focus\(\)/);
    assert.match(applicationScript, /if \(dateKey !== onThisDayDateKey\) force = true/);
    assert.match(applicationScript, /if \(!force && onThisDayState === 'loaded'\) return/);
    assert.doesNotMatch(applicationScript, /asset-thumb[^\n]+size=original/);
    assert.doesNotMatch(applicationScript, /asset\.download/);
});

test('life grid opens an accessible local-data week detail on pointer and keyboard input', () => {
    for (const id of [
        'weekDetailOverlay', 'weekDetailTitle', 'weekDetailRange', 'weekDetailAge',
        'weekDetailStage', 'weekDetailMilestones', 'weekDetailEvents',
        'weekDetailPrevious', 'weekDetailNext'
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(applicationScript, /<button type="button" class="\$\{cls\}" data-week="\$\{g\}" tabindex=/);
    assert.match(applicationScript, /aria-label="\$\{getWeekAccessibleLabel\(g, milestoneLabels, eventCount\)\}"/);
    assert.match(applicationScript, /wrapper\.addEventListener\('click'/);
    assert.match(applicationScript, /e\.key === 'Enter' \|\| e\.key === ' '/);
    assert.match(applicationScript, /\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'\]/);
    assert.match(applicationScript, /function openWeekDetail/);
    assert.match(applicationScript, /function closeWeekDetail/);
    assert.match(applicationScript, /weekDetailTrigger\.focus\(\)/);
    assert.match(applicationScript, /apiGet\(`\/users\/\$\{normalizedId\}\/events`\)/);
    const weekDetailSource = applicationScript.slice(
        applicationScript.indexOf('function getWeekStageLabel'),
        applicationScript.indexOf('// ==================== COUNTDOWN')
    );
    assert.match(weekDetailSource, /title\.textContent = event\.title/);
    assert.doesNotMatch(weekDetailSource, /immichGet|fetchPhotosForDate|innerHTML\s*=\s*event/);
});

test('life grid legend separates time state from milestone and event shapes', () => {
    for (const className of [
        'week-legend-spent', 'week-legend-current',
        'week-legend-future', 'week-legend-milestone', 'week-legend-event'
    ]) {
        assert.match(html, new RegExp(className));
    }
    assert.match(html, /week-legend-milestone[^>]*><\/span>里程碑/);
    assert.match(html, /week-legend-event[^>]*><\/span>家庭事件/);
    assert.match(html, /\.week-cell\.spent\s*\{[\s\S]*background-color:\s*color-mix\(in srgb, var\(--accent-color\) 48%, var\(--surface-color\)\)/);
    assert.match(html, /\.week-cell\.milestone-dot::after,[\s\S]*transform:\s*translate\(-50%, -50%\) rotate\(45deg\)/);
    assert.match(html, /\.week-cell\.event-marker::before,[\s\S]*height:\s*2px/);
    assert.doesNotMatch(html, /stage-dot|\.week-cell\.stage-[0-5]|milestone-dot\.(?:中考|高考)/);
    assert.match(applicationScript, /const milestoneWeeks = new Map\(\)/);
    assert.match(applicationScript, /milestone\.eventDate\.getTime\(\) - birthMs/);
    assert.match(applicationScript, /里程碑：\$\{milestoneLabels\.join\('、'\)\}/);
    assert.match(applicationScript, /const eventWeeks = new Map\(\)/);
    assert.match(applicationScript, /if \(eventCount\) details\.push\(`\$\{eventCount\} 个家庭事件`\)/);
});

test('life grid focus mode preserves 52-week rows without horizontal scrolling', () => {
    assert.match(applicationScript, /const cols = 52/);
    assert.match(applicationScript, /repeat\(' \+ cols \+ ', minmax\(0, 1fr\)\)'/);
    assert.match(html, /\.week-cell\s*\{[\s\S]*min-width:\s*0;[\s\S]*min-height:\s*0;/);
    assert.match(html, /\.life-grid\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;/);
    assert.match(html, /\.grid-scroll\s*\{[\s\S]*overflow-x:\s*clip;/);
    assert.match(html, /#personalView\.grid-focus-mode #lifeGridSection\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    assert.match(html, /id="gridFocusButton"[^>]*onclick="toggleGridFocus\(\)"[^>]*aria-expanded="false"/);
    assert.match(applicationScript, /function setGridFocus\(expanded, announce = true\)/);
    assert.match(applicationScript, /personalView\.classList\.toggle\('grid-focus-mode', gridFocusExpanded\)/);
    assert.doesNotMatch(html, /id="zoomLevel"|onclick="gridZoom(?:In|Out)\(\)"|overflow-x-auto pb-2 grid-scroll/);
    assert.doesNotMatch(html, /\.life-grid\s*\{\s*min-width:\s*600px|zoom-controls|zoom-btn|zoom-level/);
    assert.doesNotMatch(applicationScript, /ZOOM_LEVELS|ZOOM_PRESETS|gridZoom|initWheelZoom|overrideCols/);
    assert.match(html, /id="locateCurrentWeekButton"[^>]*onclick="locateCurrentWeek\(\)"/);
    assert.match(applicationScript, /function locateCurrentWeek\(\)[\s\S]*\.week-cell\.current[\s\S]*scrollIntoView\(\{ behavior: 'smooth', block: 'center', inline: 'center' \}\)/);
});

test('event markers refresh after the member event request completes', () => {
    assert.match(applicationScript, /if \(Array\.isArray\(events\)\) \{[\s\S]*state\.events = events;[\s\S]*initLifeGrid\(\)/);
    assert.match(applicationScript, /weekDetailTrigger = document\.querySelector\(`\[data-week="\$\{openWeek\}"\]`\)/);
    assert.match(applicationScript, /const wrapper = document\.querySelector\('\.grid-scroll'\)/);
});

test('system settings report current Immich capabilities without stale setup instructions', () => {
    assert.match(html, /id="systemImmichTitle"/);
    assert.match(html, /id="systemImmichDetail"/);
    assert.match(applicationScript, /Immich 已配置（只读）/);
    assert.match(applicationScript, /往年今日\$\{immichMemoriesEnabled/);
    assert.match(applicationScript, /周格照片\$\{immichWeekHoverEnabled/);
    assert.doesNotMatch(html, /Immich 暂停接入|需要新的只读 Key|接入前需确认/);
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
