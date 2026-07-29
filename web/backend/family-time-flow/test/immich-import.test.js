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
    immich = http.createServer((req, res) => {
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
