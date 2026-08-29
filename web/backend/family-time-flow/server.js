// FamilyTimeFlow Backend v0.2.0 — Phase 2
// Express + sql.js REST API (pure JS SQLite, no native compilation needed)
//
// Endpoints:
//   GET    /api/health
//   GET    /api/sync                    — config + all users (for frontend hydration)
//   GET    /api/users                   — list all users
//   POST   /api/users                   — create user
//   GET    /api/users/:id               — get user profile + computed info
//   PUT    /api/users/:id               — update profile
//   GET    /api/users/:id/milestones    — get milestones (computed)
//   GET    /api/users/:id/education     — get education info (computed)
//   POST   /api/users/:id/events        — create custom event
//   GET    /api/users/:id/events        — list events
//   DELETE /api/users/:id/events/:eid   — delete event

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
if (process.env.SERVE_FRONTEND === "1") {
    app.use(express.static(path.join(__dirname, "..", "..", "html", "family-time-flow")));
}

// ==================== DATABASE SETUP (sql.js) ====================
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "ftf.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(dbDir, "backups");
const BACKUP_LIMIT = Math.max(1, Number.parseInt(process.env.BACKUP_LIMIT || "7", 10) || 7);
const DIAGNOSTICS_ENABLED = process.env.ENABLE_DIAGNOSTICS === "1";
const IMMICH_ENABLED = process.env.ENABLE_IMMICH === "1";
const IMMICH_URL = (process.env.IMMICH_URL || "").replace(/\/+$/, "").replace(/\/api$/, "");
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || "";

const initSqlJs = require("sql.js");
let db;
let SQL;

async function initDb() {
    SQL = await initSqlJs();
    // A corrupt database must never be mistaken for a new household. Keep the
    // original file untouched and fail startup so an operator can restore it.
    if (fs.existsSync(DB_PATH)) {
        const buf = fs.readFileSync(DB_PATH);
        try {
            db = new SQL.Database(buf);
            createStartupBackup();
        } catch (error) {
            throw new Error(`Cannot open database at ${DB_PATH}; original file was preserved`, { cause: error });
        }
    } else {
        db = new SQL.Database();
    }
    db.run("PRAGMA journal_mode=WAL");

    // Create tables
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      expected_age INTEGER DEFAULT 80,
      identity_tag TEXT DEFAULT 'student',
      school_system TEXT DEFAULT 'shanghai',
      target_date TEXT,
      immich_sync INTEGER DEFAULT 0,
      immich_person_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    const userColumns = queryAll("PRAGMA table_info(users)").map(column => column.name);
    if (!userColumns.includes("creation_key")) {
        db.run("ALTER TABLE users ADD COLUMN creation_key TEXT");
    }
    if (!userColumns.includes("color")) {
        db.run("ALTER TABLE users ADD COLUMN color TEXT");
    }
    if (!userColumns.includes("sort_order")) {
        db.run("ALTER TABLE users ADD COLUMN sort_order INTEGER");
        db.run("UPDATE users SET sort_order = id WHERE sort_order IS NULL");
    }
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_creation_key ON users(creation_key) WHERE creation_key IS NOT NULL");
    db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT DEFAULT 'custom',
      color TEXT DEFAULT '#3B82F6',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);

    // Insert defaults
    db.run("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)", ["version", "0.2.0"]);
    saveDb();
    console.log("DB ready at", DB_PATH);
}

function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    const temporaryPath = `${DB_PATH}.tmp-${process.pid}`;
    try {
        fs.writeFileSync(temporaryPath, buffer, { mode: 0o600 });
        fs.renameSync(temporaryPath, DB_PATH);
    } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
}

function createStartupBackup() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `ftf-${timestamp}.db`));
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(name => /^ftf-.*\.db$/.test(name))
        .sort()
        .reverse();
    backups.slice(BACKUP_LIMIT).forEach(name => fs.unlinkSync(path.join(BACKUP_DIR, name)));
}

// Helper: run query returning array of objects
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function queryOne(sql, params = []) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
    db.run(sql, params);
    // sql.js export() can reset connection-local metadata such as
    // last_insert_rowid(), so capture it before persisting the database.
    const insertedId = lastInsertId();
    saveDb();
    return insertedId;
}

function runTransaction(operations) {
    db.run("BEGIN");
    try {
        operations.forEach(({ sql, params = [] }) => db.run(sql, params));
        db.run("COMMIT");
        saveDb();
    } catch (error) {
        db.run("ROLLBACK");
        throw error;
    }
}

function runTransactionWithResult(callback) {
    db.run("BEGIN");
    try {
        const result = callback();
        db.run("COMMIT");
        saveDb();
        return result;
    } catch (error) {
        db.run("ROLLBACK");
        throw error;
    }
}

function lastInsertId() {
    const r = queryOne("SELECT last_insert_rowid() as id");
    return r ? r.id : null;
}

// Only expose configuration that is safe for an unauthenticated household UI.
// Secrets remain server-side; clients only need to know whether they exist.
function getPublicConfig() {
    const rows = queryAll("SELECT key, value FROM app_config");
    const config = {};
    rows.forEach(({ key, value }) => {
        if (key === "immich_api_key") {
            config.immich_api_key_configured = Boolean(value);
            return;
        }
        if (key === "immich_url") {
            config.immich_url_configured = Boolean(value);
            return;
        }
        config[key] = value;
    });
    return config;
}

function toLegacyUserDto(user) {
    return {
        id: user.id,
        name: user.name,
        birth_date: user.birth_date,
        expected_age: user.expected_age,
        identity_tag: user.identity_tag,
        school_system: user.school_system,
        target_date: user.target_date,
        immich_sync: user.immich_sync,
        immich_person_id: user.immich_person_id,
        color: user.color || "#3B82F6",
        sort_order: user.sort_order ?? user.id,
        created_at: user.created_at,
        updated_at: user.updated_at
    };
}

function toMemberDto(user) {
    return {
        id: String(user.id),
        name: user.name,
        birthDate: user.birth_date,
        expectedAge: user.expected_age,
        profileTemplate: user.identity_tag,
        schoolSystem: user.school_system,
        targetDate: user.target_date,
        color: user.color || "#3B82F6",
        sortOrder: user.sort_order ?? user.id,
        immich: {
            linked: Boolean(user.immich_person_id),
            personId: user.immich_person_id || null,
            syncEnabled: Boolean(user.immich_sync)
        },
        createdAt: user.created_at,
        updatedAt: user.updated_at
    };
}

function getHouseholdDto() {
    const name = queryOne("SELECT value FROM app_config WHERE key = 'household_name'");
    return {
        id: "default",
        name: name ? name.value : "家庭时光",
        defaultView: "household"
    };
}

// ==================== EDUCATION HELPERS ====================
function getGradeFromAge(ageYears, system = 'shanghai') {
    const y = Math.floor(ageYears);
    if (system === 'shanghai') {
        if (y < 3) return { stage: '学龄前', grade: '婴幼儿 (0-2岁)' };
        if (y < 6) return { stage: '学龄前', grade: `幼儿园 ${['小班', '中班', '大班'][y - 3]}` };
        if (y < 11) return { stage: '小学', grade: `小学 ${['一', '二', '三', '四', '五'][y - 6]}年级` };
        if (y < 12) return { stage: '预初', grade: '预初年级' };
        if (y < 15) return { stage: '初中', grade: `初中 ${['一', '二', '三'][y - 12]}年级` };
        if (y < 18) return { stage: '高中', grade: `高中 ${['一', '二', '三'][y - 15]}年级` };
        if (y < 22) return { stage: '大学', grade: `大学 ${['一', '二', '三', '四'][y - 18]}年级` };
        return { stage: '已毕业', grade: '已毕业' };
    }
    // National
    if (y < 3) return { stage: '学龄前', grade: '婴幼儿' };
    if (y < 6) return { stage: '学龄前', grade: `幼儿园 ${['小班', '中班', '大班'][y - 3]}` };
    if (y < 12) return { stage: '小学', grade: `小学 ${['一', '二', '三', '四', '五', '六'][y - 6]}年级` };
    if (y < 15) return { stage: '初中', grade: `初中 ${['一', '二', '三'][y - 12]}年级` };
    if (y < 18) return { stage: '高中', grade: `高中 ${['一', '二', '三'][y - 15]}年级` };
    if (y < 22) return { stage: '大学', grade: `大学 ${['一', '二', '三', '四'][y - 18]}年级` };
    return { stage: '已毕业', grade: '已毕业' };
}

function getMilestones(birthDate, system = 'shanghai') {
    if (!birthDate) return [];
    const birth = new Date(birthDate);
    const now = new Date();
    const base = system === 'shanghai'
        ? [
            { label: '🎒 上小学', age: 6 }, { label: '📐 上预初', age: 11 },
            { label: '📚 上初中', age: 12 }, { label: '🎯 中考', age: 15 },
            { label: '🏆 高考', age: 18 }, { label: '🎓 上大学', age: 18 },
            { label: '💼 大学毕业', age: 22 }, { label: '🎉 30而立', age: 30 },
            { label: '🏠 40不惑', age: 40 }, { label: '🧘 50知天命', age: 50 }
        ]
        : [
            { label: '🎒 上小学', age: 6 }, { label: '📐 上初中', age: 12 },
            { label: '🎯 中考', age: 15 }, { label: '🏆 高考', age: 18 },
            { label: '🎓 上大学', age: 18 }, { label: '💼 大学毕业', age: 22 },
            { label: '🎉 30而立', age: 30 }, { label: '🏠 40不惑', age: 40 },
            { label: '🧘 50知天命', age: 50 }
        ];
    return base.map(m => {
        const msAge = m.age * 365.25 * 24 * 60 * 60 * 1000;
        const eventDate = new Date(birth.getTime() + msAge);
        const diffDays = Math.ceil((eventDate - now) / (24 * 60 * 60 * 1000));
        const isPast = diffDays < 0;
        return {
            ...m,
            eventDate: eventDate.toISOString().split('T')[0],
            diffDays: Math.abs(diffDays),
            isPast,
            remaining: isPast ? '已过' : diffDays <= 7 ? '🔥 即将到来!' : `${diffDays} 天后`
        };
    });
}

function getEducationInfo(birthDate, system = 'shanghai') {
    if (!birthDate) return null;
    const now = new Date();
    const birth = new Date(birthDate);
    const ageYears = (now - birth) / (365.25 * 24 * 60 * 60 * 1000);
    const grade = getGradeFromAge(ageYears, system);
    const m = now.getMonth();
    const y = now.getFullYear();
    const isSummer = (m >= 6 && m <= 7);
    const semester = (m >= 8 || m <= 0) ? '上学期' : (m >= 1 && m <= 1) ? '寒假' : (m >= 2 && m <= 5) ? '下学期' : '暑假中';
    const semesterLabel = isSummer ? `暑假 (${grade.grade}结束)` : semester;
    const syStart = new Date(m >= 8 ? y : y - 1, 8, 1);
    const syEnd = new Date(m >= 8 ? y + 1 : y, 7, 31);
    const pct = Math.min(Math.max((now - syStart) / (syEnd - syStart), 0), 1) * 100;
    const milestones = getMilestones(birthDate, system);
    return {
        grade: grade.grade, stage: grade.stage, semester: semesterLabel,
        schoolYearProgress: Math.round(pct),
        nextMilestone: milestones.find(m => !m.isPast) || null,
        zhongkao: milestones.find(m => m.label.includes('中考')) || null,
        gaokao: milestones.find(m => m.label.includes('高考')) || null,
    };
}

// ==================== ROUTES ====================
app.get("/api/health", (req, res) => res.json({
    status: "ok",
    version: "0.2.0",
    storage: { ready: Boolean(db), backupEnabled: true }
}));

// Single, side-effect-free application startup contract.
app.get("/api/bootstrap", (req, res) => {
    const users = queryAll("SELECT * FROM users ORDER BY COALESCE(sort_order, id), id");
    const members = users.map(toMemberDto);
    const requestedId = req.query.activeMemberId ? String(req.query.activeMemberId) : null;
    const selectedMemberId = requestedId && members.some(member => member.id === requestedId)
        ? requestedId
        : null;
    const publicConfig = getPublicConfig();

    res.json({
        apiVersion: "1",
        schemaVersion: publicConfig.version || "0.2.0",
        state: members.length === 0 ? "empty" : "ready",
        household: getHouseholdDto(),
        members,
        selectedMemberId,
        integrations: {
            immich: {
                configured: Boolean(IMMICH_URL && IMMICH_API_KEY),
                status: IMMICH_ENABLED
                    ? (IMMICH_URL && IMMICH_API_KEY ? "unchecked" : "not_configured")
                    : "disabled"
            }
        }
    });
});

app.get("/api/household/view", (req, res) => {
    const users = queryAll("SELECT * FROM users ORDER BY COALESCE(sort_order, id), id");
    const today = new Date().toISOString().slice(0, 10);
    const events = queryAll(`
        SELECT events.*, users.name AS member_name
        FROM events
        JOIN users ON users.id = events.user_id
        WHERE events.date >= ?
        ORDER BY events.date ASC
        LIMIT 12
    `, [today]);

    const members = users.map(user => {
        const education = user.identity_tag === "student"
            ? getEducationInfo(user.birth_date, user.school_system)
            : null;
        const nextLifeMilestone = getMilestones(user.birth_date, user.school_system)
            .find(milestone => !milestone.isPast) || null;
        const profileLabel = user.identity_tag === "worker"
            ? "职场"
            : user.identity_tag === "family" ? "家庭" : null;
        const birth = user.birth_date ? new Date(user.birth_date) : null;
        const age = birth && !Number.isNaN(birth.getTime())
            ? Math.max(0, Math.floor((Date.now() - birth.getTime()) / 31557600000))
            : null;
        return {
            ...toMemberDto(user),
            age,
            stageLabel: education ? education.grade : profileLabel,
            nextMilestone: education ? education.nextMilestone : nextLifeMilestone
        };
    });

    res.json({
        household: getHouseholdDto(),
        members,
        upcomingEvents: events.map(event => ({
            id: String(event.id),
            memberId: String(event.user_id),
            memberName: event.member_name,
            title: event.title,
            date: event.date,
            type: event.type,
            color: event.color,
            notes: event.notes
        }))
    });
});

app.get("/api/household", (req, res) => res.json(getHouseholdDto()));

app.patch("/api/household", (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "household name required" });
    if (name.length > 60) return res.status(400).json({ error: "household name too long" });
    run("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)", ["household_name", name]);
    res.json(getHouseholdDto());
});

app.get("/api/sync", (req, res) => {
    const users = queryAll("SELECT * FROM users ORDER BY COALESCE(sort_order, id), id");
    res.json({
        config: getPublicConfig(),
        users: users.map(user => ({
            ...toLegacyUserDto(user),
            education: getEducationInfo(user.birth_date, user.school_system),
            milestones: getMilestones(user.birth_date, user.school_system)
        }))
    });
});

app.get("/api/users", (req, res) => res.json(
    queryAll("SELECT * FROM users ORDER BY COALESCE(sort_order, id), id").map(toLegacyUserDto)
));

app.post("/api/users", (req, res) => {
    const { name, birth_date, expected_age, identity_tag, school_system, target_date, immich_person_id, color } = req.body;
    const creationKey = req.get("Idempotency-Key") || null;
    if (creationKey) {
        const previous = queryOne("SELECT * FROM users WHERE creation_key = ?", [creationKey]);
        if (previous) return res.status(200).json(toLegacyUserDto(previous));
    }
    if (immich_person_id) {
        const linked = queryOne("SELECT id FROM users WHERE immich_person_id = ?", [immich_person_id]);
        if (linked) return res.status(409).json({ error: "Immich person already linked", memberId: String(linked.id) });
    }
    const palette = ["#3B82F6", "#F97316", "#8B5CF6", "#10B981", "#EC4899", "#F59E0B"];
    const count = queryOne("SELECT COUNT(*) AS count FROM users").count;
    const memberColor = /^#[0-9A-Fa-f]{6}$/.test(color || "") ? color : palette[count % palette.length];
    const nextOrder = queryOne("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM users").value;
    const id = run("INSERT INTO users (name, birth_date, expected_age, identity_tag, school_system, target_date, immich_person_id, creation_key, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [name || '', birth_date || null, expected_age || 80, identity_tag || 'student', school_system || 'shanghai', target_date || null, immich_person_id || null, creationKey, memberColor, nextOrder]);
    const user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
    res.status(201).json(toLegacyUserDto(user));
});

app.get("/api/users/:id", (req, res) => {
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
        ...toLegacyUserDto(user),
        education: getEducationInfo(user.birth_date, user.school_system),
        milestones: getMilestones(user.birth_date, user.school_system),
        events: queryAll("SELECT * FROM events WHERE user_id = ? ORDER BY date", [req.params.id])
    });
});

app.put("/api/users/:id", (req, res) => {
    const existing = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "User not found" });
    const b = req.body;
    if (b.immich_person_id) {
        const linked = queryOne("SELECT id FROM users WHERE immich_person_id = ? AND id != ?", [b.immich_person_id, req.params.id]);
        if (linked) return res.status(409).json({ error: "Immich person already linked", memberId: String(linked.id) });
    }
    if (b.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(b.color)) {
        return res.status(400).json({ error: "invalid color" });
    }
    const targetDate = Object.prototype.hasOwnProperty.call(b, "target_date")
        ? (b.target_date || null)
        : existing.target_date;
    run(`UPDATE users SET name=COALESCE(?,name), birth_date=COALESCE(?,birth_date), expected_age=COALESCE(?,expected_age),
         identity_tag=COALESCE(?,identity_tag), school_system=COALESCE(?,school_system), target_date=?,
         immich_sync=COALESCE(?,immich_sync), immich_person_id=COALESCE(?,immich_person_id), color=COALESCE(?,color), updated_at=datetime('now') WHERE id=?`,
        [b.name ?? null, b.birth_date ?? null, b.expected_age ?? null, b.identity_tag ?? null,
        b.school_system ?? null, targetDate, b.immich_sync ?? null, b.immich_person_id ?? null,
        b.color ?? null, req.params.id]);
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    res.json({
        ...toLegacyUserDto(user),
        education: getEducationInfo(user.birth_date, user.school_system),
        milestones: getMilestones(user.birth_date, user.school_system)
    });
});

app.get("/api/users/:id/milestones", (req, res) => {
    const u = queryOne("SELECT birth_date, school_system FROM users WHERE id = ?", [req.params.id]);
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json(getMilestones(u.birth_date, u.school_system));
});

app.get("/api/users/:id/education", (req, res) => {
    const u = queryOne("SELECT birth_date, school_system FROM users WHERE id = ?", [req.params.id]);
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json(getEducationInfo(u.birth_date, u.school_system));
});

app.post("/api/users/:id/events", (req, res) => {
    const { title, date, type, color, notes } = req.body;
    if (!title || !date) return res.status(400).json({ error: "title and date required" });
    if (!queryOne("SELECT id FROM users WHERE id = ?", [req.params.id])) {
        return res.status(404).json({ error: "User not found" });
    }
    const id = run("INSERT INTO events (user_id, title, date, type, color, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [req.params.id, title, date, type || 'custom', color || '#3B82F6', notes || null]);
    const ev = queryOne("SELECT * FROM events WHERE id = ?", [id]);
    res.status(201).json(ev);
});

app.get("/api/users/:id/events", (req, res) => {
    res.json(queryAll("SELECT * FROM events WHERE user_id = ? ORDER BY date ASC", [req.params.id]));
});

app.put("/api/users/:id/events/:eid", (req, res) => {
    const existing = queryOne("SELECT * FROM events WHERE id = ? AND user_id = ?", [req.params.eid, req.params.id]);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    const { title, date, type, color, notes } = req.body;
    if (title !== undefined && !String(title).trim()) return res.status(400).json({ error: "title cannot be empty" });
    if (date !== undefined && !String(date).trim()) return res.status(400).json({ error: "date cannot be empty" });
    run(`UPDATE events SET title=COALESCE(?,title), date=COALESCE(?,date), type=COALESCE(?,type),
         color=COALESCE(?,color), notes=? WHERE id=? AND user_id=?`,
        [title ?? null, date ?? null, type ?? null, color ?? null,
        notes === undefined ? existing.notes : notes, req.params.eid, req.params.id]);
    res.json(queryOne("SELECT * FROM events WHERE id = ?", [req.params.eid]));
});

app.delete("/api/users/:id/events/:eid", (req, res) => {
    const existing = queryOne("SELECT id FROM events WHERE id = ? AND user_id = ?", [req.params.eid, req.params.id]);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    run("DELETE FROM events WHERE id = ? AND user_id = ?", [req.params.eid, req.params.id]);
    res.json({ status: "deleted" });
});

app.patch("/api/users/order", (req, res) => {
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
    const existingIds = queryAll("SELECT id FROM users").map(row => String(row.id));
    if (memberIds.length !== existingIds.length || new Set(memberIds).size !== memberIds.length ||
        existingIds.some(id => !memberIds.includes(id))) {
        return res.status(400).json({ error: "memberIds must contain every member exactly once" });
    }
    runTransaction(memberIds.map((id, index) => ({
        sql: "UPDATE users SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        params: [index + 1, id]
    })));
    res.json(queryAll("SELECT * FROM users ORDER BY sort_order, id").map(toMemberDto));
});

app.get("/api/users/:id/delete-preview", (req, res) => {
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const eventCount = queryOne("SELECT COUNT(*) AS count FROM events WHERE user_id = ?", [req.params.id]).count;
    res.json({
        member: toMemberDto(user),
        impact: { eventCount, immichLinked: Boolean(user.immich_person_id) }
    });
});

app.delete("/api/users/:id", (req, res) => {
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const eventCount = queryOne("SELECT COUNT(*) AS count FROM events WHERE user_id = ?", [req.params.id]).count;
    runTransaction([
        { sql: "DELETE FROM events WHERE user_id = ?", params: [req.params.id] },
        { sql: "DELETE FROM users WHERE id = ?", params: [req.params.id] }
    ]);
    res.json({ status: "deleted", memberId: String(user.id), deletedEvents: eventCount });
});

// GET /api/debug — Full database state (for admin panel)
app.get("/api/debug", (req, res) => {
    if (!DIAGNOSTICS_ENABLED) return res.status(404).json({ error: "Not found" });
    const users = queryAll("SELECT * FROM users");
    const config = getPublicConfig();
    res.json({
        server: { version: "0.2.0", time: new Date().toISOString() },
        users,
        config,
        counts: { users: users.length, config: Object.keys(config).length }
    });
});

// ==================== IMMICH INTEGRATION (Phase 3) ====================
// All Immich routes added here - no existing code modified.
// Immich access via internal LAN: http://192.168.6.108:2283/api
// API Key stored in app_config table (never in git)

app.use("/api/immich", (req, res, next) => {
    if (!IMMICH_ENABLED) return res.status(503).json({ error: "Immich integration is disabled" });
    next();
});

// Credentials are injected at process start. The database may contain legacy
// values from old releases, but they are deliberately ignored.
function getImmichUrl() {
    return IMMICH_URL;
}

function getImmichKey() {
    return IMMICH_API_KEY || null;
}

// Helper: proxy request to Immich API
async function immichFetch(path) {
    const apiKey = getImmichKey();
    const url = getImmichUrl();
    if (!apiKey || !url) return { ok: false, kind: "not_configured", status: null, data: null };
    try {
        const resp = await fetch(`${url}${path}`, {
            headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) {
            return {
                ok: false,
                kind: resp.status === 401 || resp.status === 403 ? "unauthorized" : "upstream_error",
                status: resp.status,
                data: null
            };
        }
        return { ok: true, kind: "available", status: resp.status, data: await resp.json() };
    } catch {
        return { ok: false, kind: "unreachable", status: null, data: null };
    }
}

// Legacy browser-based credential configuration is permanently retired.
app.post("/api/immich/config", (req, res) => {
    res.status(410).json({ error: "Configure Immich with server environment variables" });
});

// Legacy alias: credentials must never be accepted from a browser.
app.post("/api/immich/set-key", (req, res) => {
    res.status(410).json({ error: "Configure Immich with server environment variables" });
});

// GET /api/immich/status — Check Immich connectivity
app.get("/api/immich/status", async (req, res) => {
    const version = await immichFetch("/api/server/version");
    res.json({
        configured: Boolean(getImmichUrl() && getImmichKey()),
        connected: version.ok,
        status: version.kind,
        version: version.ok ? version.data : null
    });
});

// GET /api/immich/people — List named people only (filter out unnamed)
app.get("/api/immich/people", async (req, res) => {
    const result = await immichFetch("/api/people?page=1&size=100&withHidden=false");
    if (!result.ok) {
        const statusCode = result.kind === "unauthorized" ? 502 : 503;
        return res.status(statusCode).json({ error: "Immich people unavailable", status: result.kind });
    }
    const data = result.data;
    // Extract people array from response
    let peopleList = [];
    if (Array.isArray(data)) {
        peopleList = data;
    } else if (data.people && Array.isArray(data.people)) {
        peopleList = data.people;
    }
    // Filter: only include people with a real name
    const linkedIds = new Set(queryAll("SELECT immich_person_id FROM users WHERE immich_person_id IS NOT NULL").map(row => row.immich_person_id));
    const named = peopleList.filter(p => p.name && p.name !== '未命名' && p.name.trim() !== '' && !p.isHidden);
    res.json({
        total: named.length,
        people: named.map(p => ({
            id: p.id,
            name: p.name.trim(),
            birthDate: p.birthDate ? String(p.birthDate).slice(0, 10) : null,
            hasThumbnail: Boolean(p.thumbnailPath),
            thumbnailUrl: `/api/immich/person-thumb?id=${encodeURIComponent(p.id)}`,
            linked: linkedIds.has(p.id),
            updatedAt: p.updatedAt || null
        }))
    });
});

app.post("/api/onboarding/immich-import", async (req, res) => {
    if (!IMMICH_ENABLED) return res.status(503).json({ error: "Immich integration is disabled" });
    const entries = Array.isArray(req.body.people) ? req.body.people : [];
    if (entries.length < 1 || entries.length > 30) {
        return res.status(400).json({ error: "select between 1 and 30 people" });
    }
    const personIds = entries.map(entry => typeof entry.personId === "string" ? entry.personId.trim() : "");
    if (personIds.some(id => !id) || new Set(personIds).size !== personIds.length) {
        return res.status(400).json({ error: "invalid or duplicate Immich person" });
    }
    for (const entry of entries) {
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        if (!name || name.length > 40) return res.status(400).json({ error: "invalid member name" });
        if (entry.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(entry.birthDate)) {
            return res.status(400).json({ error: "invalid birth date" });
        }
        if (entry.profileTemplate && !["student", "worker", "family"].includes(entry.profileTemplate)) {
            return res.status(400).json({ error: "invalid profile template" });
        }
    }

    const peopleResult = await immichFetch("/api/people?page=1&size=100&withHidden=false");
    if (!peopleResult.ok) {
        return res.status(503).json({ error: "Immich unavailable", status: peopleResult.kind });
    }
    const upstreamPeople = Array.isArray(peopleResult.data)
        ? peopleResult.data
        : (Array.isArray(peopleResult.data.people) ? peopleResult.data.people : []);
    const availableIds = new Set(upstreamPeople.filter(person => person.name && !person.isHidden).map(person => person.id));
    if (personIds.some(id => !availableIds.has(id))) {
        return res.status(409).json({ error: "Immich person changed; refresh preview" });
    }

    const palette = ["#3B82F6", "#F97316", "#8B5CF6", "#10B981", "#EC4899", "#F59E0B"];
    const created = runTransactionWithResult(() => {
        let nextOrder = Number(queryOne("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM users").value);
        return entries.map((entry, index) => {
            const existing = queryOne("SELECT * FROM users WHERE immich_person_id = ?", [entry.personId]);
            if (existing) return { member: toMemberDto(existing), created: false };
            db.run(`INSERT INTO users
                (name, birth_date, expected_age, identity_tag, school_system, immich_person_id, immich_sync, creation_key, color, sort_order)
                VALUES (?, ?, 80, ?, 'shanghai', ?, 0, ?, ?, ?)`, [
                entry.name.trim(), entry.birthDate || null, entry.profileTemplate || "family",
                entry.personId, `immich:${entry.personId}`, palette[(nextOrder - 1 + index) % palette.length], nextOrder + index
            ]);
            const member = queryOne("SELECT * FROM users WHERE immich_person_id = ?", [entry.personId]);
            return { member: toMemberDto(member), created: true };
        });
    });
    res.status(created.some(item => item.created) ? 201 : 200).json({ results: created });
});

// GET /api/immich/assets?personId=&date=&limit=3 — Query assets
// Uses POST /api/search/metadata (Immich v2.7)
app.get("/api/immich/assets", async (req, res) => {
    const { personId, date, limit } = req.query;
    const apiKey = getImmichKey();
    if (!apiKey) return res.json({ assets: [] });
    const url = getImmichUrl();
    try {
        const body = { page: 1, size: parseInt(limit) || 5 };
        if (personId) body.personId = personId;
        if (date) {
            body.takenAfter = `${date}T00:00:00.000Z`;
            body.takenBefore = `${date}T23:59:59.000Z`;
        }
        const resp = await fetch(`${url}/api/search/metadata`, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) return res.json({ assets: [] });
        const data = await resp.json();
        const items = (data.assets && data.assets.items) ? data.assets.items : [];
        res.json({
            assets: items.map(a => ({
                id: a.id,
                originalFileName: a.originalFileName,
                fileCreatedAt: a.fileCreatedAt,
                type: a.type,
                people: (a.people || []).map(p => ({ id: p.id, name: p.name })),
                exifInfo: a.exifInfo ? { dateTimeOriginal: a.exifInfo.dateTimeOriginal } : null
            }))
        });
    } catch {
        res.json({ assets: [] });
    }
});

// GET /api/immich/asset-thumb?id= — Proxy thumbnail from Immich (returns image)
app.get("/api/immich/asset-thumb", async (req, res) => {
    const { id, size } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    const apiKey = getImmichKey();
    if (!apiKey) return res.status(401).json({ error: "no api key" });
    try {
        const thumbResp = await fetch(`${getImmichUrl()}/api/assets/${id}/thumbnail?size=${size || 'thumbnail'}`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(5000)
        });
        if (!thumbResp.ok) return res.status(404).json({ error: "thumbnail not found" });
        const buffer = await thumbResp.arrayBuffer();
        res.set('Content-Type', thumbResp.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch {
        res.status(500).json({ error: "failed to fetch thumbnail" });
    }
});

// GET /api/immich/person-thumb?id= — Proxy person face thumbnail from Immich
app.get("/api/immich/person-thumb", async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    if (!/^[A-Za-z0-9-]{1,100}$/.test(id)) return res.status(400).json({ error: "invalid person id" });
    const apiKey = getImmichKey();
    if (!apiKey) return res.status(401).json({ error: "no api key" });
    try {
        const thumbResp = await fetch(`${getImmichUrl()}/api/people/${id}/thumbnail`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(5000)
        });
        if (!thumbResp.ok) return res.status(404).json({ error: "thumbnail not found" });
        const buffer = await thumbResp.arrayBuffer();
        res.set('Content-Type', thumbResp.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch {
        res.status(500).json({ error: "failed to fetch thumbnail" });
    }
});

// GET /api/immich/on-this-day?month=&day=&limit=5 — "On This Day" across years
app.get("/api/immich/on-this-day", async (req, res) => {
    const { month, day, limit } = req.query;
    const m = parseInt(month) || (new Date().getMonth() + 1);
    const d = parseInt(day) || new Date().getDate();
    const lim = parseInt(limit) || 5;
    const apiKey = getImmichKey();
    if (!apiKey) return res.json({ assets: [] });
    const url = getImmichUrl();

    const allAssets = [];
    const pad = n => n.toString().padStart(2, '0');
    const year = new Date().getFullYear();

    for (let y = year - 5; y <= year; y++) {
        const dateStr = `${y}-${pad(m)}-${pad(d)}`;
        try {
            const resp = await fetch(`${url}/api/search/metadata`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    page: 1, size: lim,
                    takenAfter: `${dateStr}T00:00:00.000Z`,
                    takenBefore: `${dateStr}T23:59:59.000Z`
                }),
                signal: AbortSignal.timeout(5000)
            });
            if (resp.ok) {
                const data = await resp.json();
                const items = (data.assets && data.assets.items) || [];
                items.slice(0, lim).forEach(a => {
                    allAssets.push({
                        id: a.id,
                        originalFileName: a.originalFileName,
                        fileCreatedAt: a.fileCreatedAt,
                        year: y,
                        type: a.type,
                        people: (a.people || []).map(p => ({ id: p.id, name: p.name }))
                    });
                });
            }
        } catch { }
        if (allAssets.length >= lim) break;
    }
    res.json({ assets: allAssets.slice(0, lim) });
});

// ==================== START ====================
let server;
initDb().then(() => {
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`FamilyTimeFlow backend v0.2.0 listening on port ${PORT}`);
    });
}).catch(error => {
    console.error("FamilyTimeFlow failed to start:", error.message);
    process.exitCode = 1;
});

function shutdown(signal) {
    console.log(`${signal} received; closing FamilyTimeFlow cleanly`);
    const finish = () => {
        if (db) db.close();
        process.exit(0);
    };
    if (server) server.close(finish);
    else finish();
    setTimeout(() => process.exit(1), 5000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
