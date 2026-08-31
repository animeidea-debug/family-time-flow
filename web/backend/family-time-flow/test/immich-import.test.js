const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const backendPort = 33126;
const immichPort = 33127;
const baseUrl = `http://127.0.0.1:${backendPort}/api`;
const apiKey = 'integration-test-key';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ftf-immich-'));
const people = [
    { id: 'person-1', name: '家人甲', birthDate: '1988-06-01', thumbnailPath: '/thumb/1', isHidden: false, updatedAt: '2026-07-20T00:00:00Z' },
    { id: 'person-2', name: '家人乙', birthDate: null, thumbnailPath: '/thumb/2', isHidden: false, updatedAt: '2026-07-20T00:00:00Z' },
    { id: 'hidden-person', name: '隐藏人物', birthDate: null, thumbnailPath: '/thumb/3', isHidden: true }
];
let backend;
let immich;
let lastSearchBody = null;

async function waitForBackend() {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Integration backend did not become ready');
}

before(async () => {
    immich = http.createServer(async (req, res) => {
        if (req.headers['x-api-key'] !== apiKey) {
            res.writeHead(401, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ error: 'unauthorized' }));
        }
        if (req.url === '/api/server/version') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ major: 3, minor: 0, patch: 2 }));
        }
        if (req.url.startsWith('/api/people?')) {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ people }));
        }
        if (/^\/api\/people\/[^/]+\/thumbnail$/.test(req.url)) {
            res.writeHead(200, { 'content-type': 'image/jpeg' });
            return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        }
        if (req.method === 'POST' && req.url === '/api/search/metadata') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            lastSearchBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (lastSearchBody.personIds?.includes('denied-person') || lastSearchBody.takenAfter?.includes('-12-31T')) {
                res.writeHead(403, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Missing required permission: asset.read' }));
            }
            if (lastSearchBody.takenAfter?.includes('-02-29T')) {
                res.writeHead(200, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ assets: { items: [] } }));
            }
            const personId = lastSearchBody.personIds?.[0] || 'timeline';
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({
                assets: {
                    items: [{
                        id: `asset-${personId}`,
                        originalFileName: 'fixture.jpg',
                        fileCreatedAt: '2024-01-01T12:00:00.000Z',
                        type: 'IMAGE',
                        people: personId === 'timeline' ? [] : [{ id: personId, name: '测试人物' }],
                        exifInfo: { dateTimeOriginal: '2024-01-01T12:00:00.000Z' }
                    }]
                }
            }));
        }
        if (/^\/api\/assets\/denied-asset\/thumbnail\?/.test(req.url)) {
            res.writeHead(403, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ message: 'Missing required permission: asset.view' }));
        }
        if (/^\/api\/assets\/missing-asset\/thumbnail\?/.test(req.url)) {
            res.writeHead(404, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ error: 'not found' }));
        }
        if (/^\/api\/assets\/[^/]+\/thumbnail\?/.test(req.url)) {
            res.writeHead(200, { 'content-type': 'image/jpeg' });
            return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        }
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    await new Promise(resolve => immich.listen(immichPort, '127.0.0.1', resolve));

    backend = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            PORT: String(backendPort),
            DB_PATH: path.join(tempDir, 'fixture.db'),
            ENABLE_IMMICH: '1',
            ENABLE_IMMICH_MEMORIES: '1',
            IMMICH_URL: `http://127.0.0.1:${immichPort}`,
            IMMICH_API_KEY: apiKey
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForBackend();
});

after(async () => {
    if (backend && !backend.killed) backend.kill('SIGTERM');
    if (immich) await new Promise(resolve => immich.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('returns a sanitized, visible and named Immich people preview', async () => {
    const bootstrap = await fetch(`${baseUrl}/bootstrap`).then(response => response.json());
    assert.equal(bootstrap.integrations.immich.memoriesEnabled, true);
    assert.equal(bootstrap.integrations.immich.weekHoverEnabled, false);

    const status = await fetch(`${baseUrl}/immich/status`).then(response => response.json());
    assert.equal(status.status, 'available');
    assert.equal(status.connected, true);

    const response = await fetch(`${baseUrl}/immich/people`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.deepEqual(body.people.map(person => person.id), ['person-1', 'person-2']);
    assert.equal(body.people[0].birthDate, '1988-06-01');
    assert.equal(body.people[1].birthDate, null);
    assert.equal(body.people[0].hasThumbnail, true);
    assert.equal(JSON.stringify(body).includes(apiKey), false);
    assert.equal('thumbnailPath' in body.people[0], false);
});

test('never accepts Immich credentials from the browser', async () => {
    const response = await fetch(`${baseUrl}/immich/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'http://untrusted.invalid', key: 'browser-secret' })
    });
    assert.equal(response.status, 410);
    assert.equal((await response.text()).includes('browser-secret'), false);
});

test('rejects path-like person thumbnail identifiers', async () => {
    const response = await fetch(`${baseUrl}/immich/person-thumb?id=..%2Fserver%2Fversion`);
    assert.equal(response.status, 400);
});

test('queries Immich assets with a personIds array and proxies thumbnails', async () => {
    const response = await fetch(`${baseUrl}/immich/assets?personId=person-1&date=2024-01-01&limit=3`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.assets.length, 1);
    assert.equal(body.assets[0].id, 'asset-person-1');
    assert.deepEqual(lastSearchBody.personIds, ['person-1']);
    assert.equal('personId' in lastSearchBody, false);
    assert.equal(lastSearchBody.withExif, true);
    assert.equal(lastSearchBody.withPeople, true);
    assert.equal(lastSearchBody.takenBefore, '2024-01-01T23:59:59.999Z');

    const thumbnail = await fetch(`${baseUrl}/immich/asset-thumb?id=asset-person-1`);
    assert.equal(thumbnail.status, 200);
    assert.equal(thumbnail.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await thumbnail.arrayBuffer()), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const invalid = await fetch(`${baseUrl}/immich/asset-thumb?id=..%2Fserver%2Fversion`);
    assert.equal(invalid.status, 400);
});

test('surfaces Immich permission errors instead of reporting empty assets', async () => {
    const assets = await fetch(`${baseUrl}/immich/assets?personId=denied-person`);
    assert.equal(assets.status, 502);
    assert.deepEqual(await assets.json(), { error: 'Immich assets unavailable', status: 'unauthorized' });

    const thumbnail = await fetch(`${baseUrl}/immich/asset-thumb?id=denied-asset`);
    assert.equal(thumbnail.status, 502);
    assert.deepEqual(await thumbnail.json(), { error: 'Immich thumbnail unavailable', status: 'unauthorized' });

    const missing = await fetch(`${baseUrl}/immich/asset-thumb?id=missing-asset`);
    assert.equal(missing.status, 404);
});

test('returns bounded on-this-day results and surfaces upstream failure', async () => {
    const invalid = await fetch(`${baseUrl}/immich/on-this-day?month=13&day=1`);
    assert.equal(invalid.status, 400);
    const impossible = await fetch(`${baseUrl}/immich/on-this-day?month=2&day=30`);
    assert.equal(impossible.status, 400);

    const response = await fetch(`${baseUrl}/immich/on-this-day?month=1&day=2&limit=2`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.assets.length, 2);
    assert.equal(body.month, 1);
    assert.equal(body.day, 2);
    assert.equal(body.partial, undefined);
    assert.equal(lastSearchBody.type, 'IMAGE');

    const empty = await fetch(`${baseUrl}/immich/on-this-day?month=2&day=29&limit=6`);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { assets: [], month: 2, day: 29 });

    const denied = await fetch(`${baseUrl}/immich/on-this-day?month=12&day=31`);
    assert.equal(denied.status, 502);
    assert.deepEqual(await denied.json(), { error: 'Immich memories unavailable', status: 'unauthorized' });
});

test('keeps photo memories disabled unless the dedicated flag is enabled', async () => {
    const disabledPort = backendPort + 2;
    const disabledBaseUrl = `http://127.0.0.1:${disabledPort}/api`;
    const disabledBackend = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            PORT: String(disabledPort),
            DB_PATH: path.join(tempDir, 'disabled-fixture.db'),
            ENABLE_IMMICH: '1',
            ENABLE_IMMICH_WEEK_HOVER: '1',
            IMMICH_URL: `http://127.0.0.1:${immichPort}`,
            IMMICH_API_KEY: apiKey
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    try {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            try {
                const response = await fetch(`${disabledBaseUrl}/health`);
                if (response.ok) break;
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        const bootstrap = await fetch(`${disabledBaseUrl}/bootstrap`).then(response => response.json());
        assert.equal(bootstrap.integrations.immich.configured, true);
        assert.equal(bootstrap.integrations.immich.memoriesEnabled, false);
        assert.equal(bootstrap.integrations.immich.weekHoverEnabled, true);
        const memories = await fetch(`${disabledBaseUrl}/immich/on-this-day`);
        assert.equal(memories.status, 503);
        assert.deepEqual(await memories.json(), { error: 'Immich memories are disabled', status: 'disabled' });
    } finally {
        disabledBackend.kill('SIGTERM');
        await new Promise(resolve => disabledBackend.once('exit', resolve));
    }
});

test('keeps household bootstrap available when Immich memories are unreachable', async () => {
    const offlinePort = backendPort + 3;
    const offlineBaseUrl = `http://127.0.0.1:${offlinePort}/api`;
    const offlineBackend = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            PORT: String(offlinePort),
            DB_PATH: path.join(tempDir, 'offline-fixture.db'),
            ENABLE_IMMICH: '1',
            ENABLE_IMMICH_MEMORIES: '1',
            IMMICH_URL: `http://127.0.0.1:${immichPort + 10}`,
            IMMICH_API_KEY: apiKey
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    try {
        const deadline = Date.now() + 10_000;
        let ready = false;
        while (Date.now() < deadline) {
            try {
                const response = await fetch(`${offlineBaseUrl}/health`);
                if (response.ok) {
                    ready = true;
                    break;
                }
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(ready, true);
        const bootstrap = await fetch(`${offlineBaseUrl}/bootstrap`).then(response => response.json());
        assert.equal(bootstrap.state, 'empty');
        assert.equal(bootstrap.integrations.immich.configured, true);
        assert.equal(bootstrap.integrations.immich.memoriesEnabled, true);
        assert.equal(bootstrap.integrations.immich.weekHoverEnabled, false);

        const memories = await fetch(`${offlineBaseUrl}/immich/on-this-day?month=1&day=2`);
        assert.equal(memories.status, 503);
        assert.deepEqual(await memories.json(), { error: 'Immich memories unavailable', status: 'unreachable' });

        const bootstrapAfterFailure = await fetch(`${offlineBaseUrl}/bootstrap`).then(response => response.json());
        assert.equal(bootstrapAfterFailure.state, 'empty');
    } finally {
        offlineBackend.kill('SIGTERM');
        await new Promise(resolve => offlineBackend.once('exit', resolve));
    }
});

test('imports selected people transactionally and is idempotent by Immich person', async () => {
    const payload = {
        people: [
            { personId: 'person-1', name: '家人甲', birthDate: '1988-06-01', profileTemplate: 'worker' },
            { personId: 'person-2', name: '家人乙', birthDate: '2012-03-04', profileTemplate: 'student' }
        ]
    };
    const create = () => fetch(`${baseUrl}/onboarding/immich-import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const first = await create();
    assert.equal(first.status, 201);
    assert.deepEqual((await first.json()).results.map(result => result.created), [true, true]);

    const second = await create();
    assert.equal(second.status, 200);
    assert.deepEqual((await second.json()).results.map(result => result.created), [false, false]);

    const members = await fetch(`${baseUrl}/bootstrap`).then(response => response.json());
    assert.equal(members.members.length, 2);
    assert.deepEqual(members.members.map(member => member.immich.personId), ['person-1', 'person-2']);
});

test('rejects stale or malformed import selections without partial creation', async () => {
    const response = await fetch(`${baseUrl}/onboarding/immich-import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ people: [
            { personId: 'person-1', name: '重复人物' },
            { personId: 'no-longer-present', name: '失效人物' }
        ] })
    });
    assert.equal(response.status, 409);
    const members = await fetch(`${baseUrl}/bootstrap`).then(result => result.json());
    assert.equal(members.members.length, 2);
});
