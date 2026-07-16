const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 33123;
const baseUrl = `http://127.0.0.1:${port}/api`;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ftf-smoke-'));
const dbPath = path.join(tempDir, 'fixture.db');
let server;

async function waitForServer() {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Backend did not become ready');
}

before(async () => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port), DB_PATH: dbPath },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForServer();
});

after(async () => {
    if (server && !server.killed) server.kill('SIGTERM');
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('starts with a clean offline fixture', async () => {
    const health = await fetch(`${baseUrl}/health`).then(response => response.json());
    assert.deepEqual(health.storage, { ready: true, backupEnabled: true });
    const response = await fetch(`${baseUrl}/sync`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.users, []);
    assert.equal(data.config.version, '0.2.0');
});

test('bootstrap returns an explicit empty household without secrets', async () => {
    const response = await fetch(`${baseUrl}/bootstrap?activeMemberId=999`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.state, 'empty');
    assert.equal(data.household.id, 'default');
    assert.deepEqual(data.members, []);
    assert.equal(data.selectedMemberId, null);
    assert.equal(JSON.stringify(data).includes('stage0-test-secret'), false);
});

test('persists a member in the isolated database', async () => {
    const create = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            name: '离线测试成员',
            birth_date: '2014-01-17',
            expected_age: 80,
            identity_tag: 'student',
            school_system: 'shanghai'
        })
    });
    assert.equal(create.status, 201);
    const member = await create.json();
    assert.ok(member.id);

    const response = await fetch(`${baseUrl}/users/${member.id}`);
    assert.equal(response.status, 200);
    const stored = await response.json();
    assert.equal(stored.name, '离线测试成员');
    assert.equal(stored.birth_date, '2014-01-17');
    assert.ok(stored.education);
});

test('bootstrap restores only a valid requested member', async () => {
    const list = await fetch(`${baseUrl}/users`).then(response => response.json());
    const memberId = String(list[0].id);

    const valid = await fetch(`${baseUrl}/bootstrap?activeMemberId=${memberId}`).then(response => response.json());
    assert.equal(valid.state, 'ready');
    assert.equal(valid.selectedMemberId, memberId);
    assert.equal(valid.members[0].birthDate, '2014-01-17');
    assert.equal(valid.members[0].immich.linked, false);
    assert.equal(valid.integrations.immich.status, 'disabled');
    assert.equal('url' in valid.integrations.immich, false);

    const stale = await fetch(`${baseUrl}/bootstrap?activeMemberId=999`).then(response => response.json());
    assert.equal(stale.selectedMemberId, null);
});

test('public member endpoints omit internal persistence fields', async () => {
    const users = await fetch(`${baseUrl}/users`).then(response => response.json());
    const sync = await fetch(`${baseUrl}/sync`).then(response => response.json());
    for (const member of [users[0], sync.users[0]]) {
        assert.equal('creation_key' in member, false);
    }
    assert.equal('immich_url' in sync.config, false);
    assert.equal('immich_api_key' in sync.config, false);
});

test('member creation is idempotent and prevents duplicate Immich links', async () => {
    const body = {
        name: '关联成员',
        birth_date: '1988-06-01',
        immich_person_id: 'immich-person-1'
    };
    const create = () => fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'onboarding-member-1' },
        body: JSON.stringify(body)
    });
    const first = await create();
    const second = await create();
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal((await first.json()).id, (await second.json()).id);

    const duplicateLink = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, name: '重复关联' })
    });
    assert.equal(duplicateLink.status, 409);

    const unlinked = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '待关联成员' })
    }).then(response => response.json());
    const duplicateUpdate = await fetch(`${baseUrl}/users/${unlinked.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ immich_person_id: body.immich_person_id })
    });
    assert.equal(duplicateUpdate.status, 409);
});

test('household view aggregates member summaries and upcoming events', async () => {
    const users = await fetch(`${baseUrl}/users`).then(response => response.json());
    const owner = users[0];
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const created = await fetch(`${baseUrl}/users/${owner.id}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '家庭测试事件', date: future })
    });
    assert.equal(created.status, 201);

    const response = await fetch(`${baseUrl}/household/view`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.members.length >= 1);
    assert.equal(typeof data.members[0].id, 'string');
    assert.equal(data.upcomingEvents.some(event => event.title === '家庭测试事件'), true);
    assert.equal(data.upcomingEvents.find(event => event.title === '家庭测试事件').memberName, owner.name);
});

test('validates and persists household settings', async () => {
    const invalid = await fetch(`${baseUrl}/household`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '   ' })
    });
    assert.equal(invalid.status, 400);

    const update = await fetch(`${baseUrl}/household`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '测试家庭' })
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).name, '测试家庭');

    const household = await fetch(`${baseUrl}/household`).then(response => response.json());
    const bootstrap = await fetch(`${baseUrl}/bootstrap`).then(response => response.json());
    assert.equal(household.name, '测试家庭');
    assert.equal(bootstrap.household.name, '测试家庭');
});

test('updates, clears notes, and deletes a household event safely', async () => {
    const users = await fetch(`${baseUrl}/users`).then(response => response.json());
    const owner = users[0];
    const events = await fetch(`${baseUrl}/users/${owner.id}/events`).then(response => response.json());
    const event = events.find(item => item.title === '家庭测试事件');
    assert.ok(event);

    const update = await fetch(`${baseUrl}/users/${owner.id}/events/${event.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '更新后的家庭事件', notes: null })
    });
    assert.equal(update.status, 200);
    const updated = await update.json();
    assert.equal(updated.title, '更新后的家庭事件');
    assert.equal(updated.notes, null);

    const wrongOwnerDelete = await fetch(`${baseUrl}/users/999/events/${event.id}`, { method: 'DELETE' });
    assert.equal(wrongOwnerDelete.status, 404);
    const remove = await fetch(`${baseUrl}/users/${owner.id}/events/${event.id}`, { method: 'DELETE' });
    assert.equal(remove.status, 200);
    const remaining = await fetch(`${baseUrl}/users/${owner.id}/events`).then(response => response.json());
    assert.equal(remaining.some(item => item.id === event.id), false);
});

test('persists member colors, ordering, and scoped deletion', async () => {
    const users = await fetch(`${baseUrl}/users`).then(response => response.json());
    assert.ok(users.length >= 3);
    assert.ok(users.every(user => /^#[0-9A-Fa-f]{6}$/.test(user.color)));

    const colored = users.at(-1);
    const invalidColor = await fetch(`${baseUrl}/users/${colored.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color: 'blue' })
    });
    assert.equal(invalidColor.status, 400);
    const colorUpdate = await fetch(`${baseUrl}/users/${colored.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color: '#123ABC' })
    });
    assert.equal(colorUpdate.status, 200);
    assert.equal((await colorUpdate.json()).color, '#123ABC');

    const reversedIds = users.map(user => String(user.id)).reverse();
    const reorder = await fetch(`${baseUrl}/users/order`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberIds: reversedIds })
    });
    assert.equal(reorder.status, 200);
    assert.deepEqual((await reorder.json()).map(member => member.id), reversedIds);
    const invalidOrder = await fetch(`${baseUrl}/users/order`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberIds: [reversedIds[0]] })
    });
    assert.equal(invalidOrder.status, 400);

    const event = await fetch(`${baseUrl}/users/${colored.id}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '随成员删除', date: '2030-01-01' })
    });
    assert.equal(event.status, 201);
    const preview = await fetch(`${baseUrl}/users/${colored.id}/delete-preview`).then(response => response.json());
    assert.equal(preview.member.id, String(colored.id));
    assert.equal(preview.impact.eventCount, 1);

    const remove = await fetch(`${baseUrl}/users/${colored.id}`, { method: 'DELETE' });
    assert.equal(remove.status, 200);
    assert.equal((await remove.json()).deletedEvents, 1);
    const stale = await fetch(`${baseUrl}/bootstrap?activeMemberId=${colored.id}`).then(response => response.json());
    assert.equal(stale.selectedMemberId, null);
});

test('creates a startup backup without leaving partial database files', async () => {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port), DB_PATH: dbPath, BACKUP_LIMIT: '2' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForServer();
    const backups = fs.readdirSync(path.join(tempDir, 'backups')).filter(name => name.endsWith('.db'));
    assert.equal(backups.length, 1);
    assert.equal(fs.readdirSync(tempDir).some(name => name.includes('.tmp-')), false);
});

test('refuses to replace a corrupt database with an empty household', async () => {
    const corruptPath = path.join(tempDir, 'corrupt.db');
    const original = Buffer.from('not-a-sqlite-database');
    fs.writeFileSync(corruptPath, original);
    const corruptServer = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port + 1), DB_PATH: corruptPath },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const exitCode = await new Promise(resolve => corruptServer.once('exit', resolve));
    assert.notEqual(exitCode, 0);
    assert.deepEqual(fs.readFileSync(corruptPath), original);
});

test('keeps diagnostics and Immich administration disabled by default', async () => {
    const save = await fetch(`${baseUrl}/immich/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'http://127.0.0.1:1', key: 'must-not-be-saved' })
    });
    assert.equal(save.status, 503);

    const diagnostics = await fetch(`${baseUrl}/debug`);
    assert.equal(diagnostics.status, 404);
    const sync = await fetch(`${baseUrl}/sync`);
    assert.equal(sync.status, 200);
    assert.equal((await sync.text()).includes('must-not-be-saved'), false);
});

test('does not opt arbitrary browser origins into CORS', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: 'https://untrusted.example' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
});
