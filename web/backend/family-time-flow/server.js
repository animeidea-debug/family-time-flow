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
const IMMICH_MEMORIES_ENABLED = IMMICH_ENABLED && process.env.ENABLE_IMMICH_MEMORIES === "1";
const IMMICH_WEEK_HOVER_ENABLED = IMMICH_ENABLED && process.env.ENABLE_IMMICH_WEEK_HOVER === "1";
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
        immich_linked: Boolean(user.immich_person_id),
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
                memoriesEnabled: IMMICH_MEMORIES_ENABLED && Boolean(IMMICH_URL && IMMICH_API_KEY),
                weekHoverEnabled: IMMICH_WEEK_HOVER_ENABLED && Boolean(IMMICH_URL && IMMICH_API_KEY),
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
function immichFailureKind(status) {
    if (status === 401 || status === 403) return "unauthorized";
    return "upstream_error";
}

function sendImmichFailure(res, result, resource) {
    const statusCode = result.kind === "unreachable" || result.kind === "not_configured" ? 503 : 502;
    return res.status(statusCode).json({ error: `Immich ${resource} unavailable`, status: result.kind });
}

async function immichFetch(path, options = {}) {
    const apiKey = getImmichKey();
    const url = getImmichUrl();
    if (!apiKey || !url) return { ok: false, kind: "not_configured", status: null, data: null };
    try {
        const resp = await fetch(`${url}${path}`, {
            method: options.method || "GET",
            headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) {
            return {
                ok: false,
                kind: immichFailureKind(resp.status),
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
        return sendImmichFailure(res, result, "people");
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
// Uses POST /api/search/metadata (Immich 3.x)
app.get("/api/immich/assets", async (req, res) => {
    const { personId, date, limit } = req.query;
    if (personId && !/^[A-Za-z0-9-]{1,100}$/.test(personId)) {
        return res.status(400).json({ error: "invalid person id" });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "invalid date" });
    }
    const parsedLimit = Number.parseInt(limit, 10);
    const size = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 5;
    const body = { page: 1, size, withExif: true, withPeople: true };
    if (personId) body.personIds = [personId];
    if (date) {
        body.takenAfter = `${date}T00:00:00.000Z`;
        body.takenBefore = `${date}T23:59:59.999Z`;
    }
    const result = await immichFetch("/api/search/metadata", { method: "POST", body });
    if (!result.ok) return sendImmichFailure(res, result, "assets");
    const items = (result.data.assets && result.data.assets.items) ? result.data.assets.items : [];
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
});

// GET /api/immich/asset-thumb?id= — Proxy thumbnail from Immich (returns image)
app.get("/api/immich/asset-thumb", async (req, res) => {
    const { id, size } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    if (!/^[A-Za-z0-9-]{1,100}$/.test(id)) return res.status(400).json({ error: "invalid asset id" });
    if (size && !["thumbnail", "preview"].includes(size)) return res.status(400).json({ error: "invalid thumbnail size" });
    const apiKey = getImmichKey();
    if (!apiKey) return res.status(503).json({ error: "Immich thumbnail unavailable", status: "not_configured" });
    try {
        const thumbResp = await fetch(`${getImmichUrl()}/api/assets/${id}/thumbnail?size=${size || 'thumbnail'}`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(5000)
        });
        if (!thumbResp.ok) {
            await thumbResp.arrayBuffer();
            if (thumbResp.status === 404) return res.status(404).json({ error: "thumbnail not found" });
            return sendImmichFailure(res, { kind: immichFailureKind(thumbResp.status) }, "thumbnail");
        }
        const buffer = await thumbResp.arrayBuffer();
        res.set('Content-Type', thumbResp.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch {
        res.status(503).json({ error: "Immich thumbnail unavailable", status: "unreachable" });
    }
});

// GET /api/immich/person-thumb?id= — Proxy person face thumbnail from Immich
app.get("/api/immich/person-thumb", async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    if (!/^[A-Za-z0-9-]{1,100}$/.test(id)) return res.status(400).json({ error: "invalid person id" });
    const apiKey = getImmichKey();
    if (!apiKey) return res.status(503).json({ error: "Immich person thumbnail unavailable", status: "not_configured" });
    try {
        const thumbResp = await fetch(`${getImmichUrl()}/api/people/${id}/thumbnail`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(5000)
        });
        if (!thumbResp.ok) {
            await thumbResp.arrayBuffer();
            if (thumbResp.status === 404) return res.status(404).json({ error: "thumbnail not found" });
            return sendImmichFailure(res, { kind: immichFailureKind(thumbResp.status) }, "person thumbnail");
        }
        const buffer = await thumbResp.arrayBuffer();
        res.set('Content-Type', thumbResp.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch {
        res.status(503).json({ error: "Immich person thumbnail unavailable", status: "unreachable" });
    }
});

// GET /api/members/:id/avatar — Resolve a linked Immich face without exposing its person ID
app.get("/api/members/:id/avatar", async (req, res) => {
    if (!/^[1-9][0-9]{0,11}$/.test(String(req.params.id))) {
        return res.status(400).json({ error: "invalid member id" });
    }
    const member = queryOne("SELECT immich_person_id FROM users WHERE id = ?", [req.params.id]);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const personId = member.immich_person_id && member.immich_person_id.trim();
    if (!personId) return res.status(404).json({ error: "Member avatar not linked" });
    const apiKey = getImmichKey();
    if (!apiKey) return res.status(503).json({ error: "Member avatar unavailable", status: "not_configured" });
    try {
        const thumbResp = await fetch(`${getImmichUrl()}/api/people/${encodeURIComponent(personId)}/thumbnail`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(5000)
        });
        if (!thumbResp.ok) {
            await thumbResp.arrayBuffer();
            if (thumbResp.status === 404) return res.status(404).json({ error: "Member avatar not found" });
            return sendImmichFailure(res, { kind: immichFailureKind(thumbResp.status) }, "member avatar");
        }
        const buffer = await thumbResp.arrayBuffer();
        res.set('Content-Type', thumbResp.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'private, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch {
        res.status(503).json({ error: "Member avatar unavailable", status: "unreachable" });
    }
});

const MEMORY_BURST_WINDOW_MS = 3 * 60 * 1000;

function memoryCaptureTime(asset) {
    const raw = asset.exifInfo && asset.exifInfo.dateTimeOriginal
        ? asset.exifInfo.dateTimeOriginal
        : asset.fileCreatedAt;
    const value = Date.parse(raw || "");
    return Number.isFinite(value) ? value : 0;
}

function compareMemoryCandidates(a, b) {
    return Math.abs(Number(a.dayOffset) || 0) - Math.abs(Number(b.dayOffset) || 0) ||
        Number(Boolean(b.asset.isFavorite)) - Number(Boolean(a.asset.isFavorite)) ||
        b.householdPersonIds.length - a.householdPersonIds.length ||
        b.peopleCount - a.peopleCount ||
        b.captureTime - a.captureTime ||
        String(a.asset.id).localeCompare(String(b.asset.id));
}

function hasSimilarHouseholdPeople(a, b) {
    const smallerSize = Math.min(a.length, b.length);
    if (!smallerSize) return false;
    const bIds = new Set(b);
    const overlap = a.filter(id => bIds.has(id)).length;
    return overlap / smallerSize >= 0.5;
}

function selectPersonFocusedMemories(candidates, linkedPersonIds, limit, earliestCaptureTime = 0) {
    const focused = candidates.flatMap(candidate => {
        const people = Array.isArray(candidate.asset.people) ? candidate.asset.people : [];
        const householdPersonIds = [...new Set(people
            .map(person => person && person.id)
            .filter(id => linkedPersonIds.has(id)))].sort();
        if (!householdPersonIds.length) return [];
        const captureTime = memoryCaptureTime(candidate.asset);
        if (earliestCaptureTime && (!captureTime || captureTime < earliestCaptureTime)) return [];
        return [{
            ...candidate,
            householdPersonIds,
            peopleCount: people.length,
            captureTime
        }];
    }).sort(compareMemoryCandidates);

    const exactKeys = new Set();
    const deduplicated = [];
    for (const candidate of focused) {
        const asset = candidate.asset;
        const identityKeys = [asset.id ? `asset:${asset.id}` : null];
        if (asset.duplicateId) {
            identityKeys.push(`asset:${asset.duplicateId}`, `duplicate:${asset.duplicateId}`);
        }
        if (asset.checksum) identityKeys.push(`checksum:${String(asset.checksum)}`);
        const usableIdentityKeys = identityKeys.filter(Boolean);
        if (usableIdentityKeys.some(key => exactKeys.has(key))) continue;

        const matchesBurst = candidate.captureTime && deduplicated.some(existing =>
            existing.year === candidate.year &&
            existing.captureTime &&
            Math.abs(existing.captureTime - candidate.captureTime) <= MEMORY_BURST_WINDOW_MS &&
            hasSimilarHouseholdPeople(existing.householdPersonIds, candidate.householdPersonIds)
        );
        if (matchesBurst) {
            continue;
        }

        usableIdentityKeys.forEach(key => exactKeys.add(key));
        deduplicated.push(candidate);
    }

    const byYear = new Map();
    for (const candidate of deduplicated) {
        if (!byYear.has(candidate.year)) byYear.set(candidate.year, []);
        byYear.get(candidate.year).push(candidate);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);
    const selected = [];
    while (selected.length < limit) {
        let added = false;
        for (const year of years) {
            const candidate = byYear.get(year).shift();
            if (!candidate) continue;
            selected.push(candidate);
            added = true;
            if (selected.length >= limit) break;
        }
        if (!added) break;
    }

    return {
        selected,
        focusedCount: focused.length,
        deduplicatedCount: deduplicated.length
    };
}

function selectWeeklyPersonMemories(candidates, linkedPersonIds, limit, earliestCaptureTime) {
    const base = selectPersonFocusedMemories(
        candidates,
        linkedPersonIds,
        candidates.length,
        earliestCaptureTime
    );
    const byDay = new Map();
    for (const candidate of base.selected) {
        const dayKey = new Date(candidate.captureTime).toISOString().slice(0, 10);
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey).push(candidate);
    }
    const days = [...byDay.keys()].sort();
    const selected = [];
    while (selected.length < limit) {
        let added = false;
        for (const day of days) {
            const candidate = byDay.get(day).shift();
            if (!candidate) continue;
            selected.push(candidate);
            added = true;
            if (selected.length >= limit) break;
        }
        if (!added) break;
    }
    selected.sort((a, b) => a.captureTime - b.captureTime || String(a.asset.id).localeCompare(String(b.asset.id)));
    return { ...base, selected };
}

function selectHouseholdBalancedMemories(candidates, linkedPersonIds, limit) {
    const base = selectPersonFocusedMemories(candidates, linkedPersonIds, candidates.length);
    const selected = [];
    const selectedIds = new Set();
    const queues = [...linkedPersonIds].map(personId => base.selected.filter(candidate =>
        candidate.householdPersonIds.includes(personId)
    ));
    let added = true;
    while (selected.length < limit && added) {
        added = false;
        for (const queue of queues) {
            while (queue.length && selectedIds.has(queue[0].asset.id)) queue.shift();
            const candidate = queue.shift();
            if (!candidate) continue;
            selected.push(candidate);
            selectedIds.add(candidate.asset.id);
            added = true;
            if (selected.length >= limit) break;
        }
    }
    for (const candidate of base.selected) {
        if (selected.length >= limit) break;
        if (selectedIds.has(candidate.asset.id)) continue;
        selected.push(candidate);
        selectedIds.add(candidate.asset.id);
    }
    return { ...base, selected };
}

function parseDateOnlyUtc(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const date = new Date(timestamp);
    if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 ||
        date.getUTCDate() !== Number(match[3])) return null;
    return date;
}

async function searchImmichMetadataPages(body, { maxPages = 3, maxItems = 300 } = {}) {
    const items = [];
    let page = 1;
    let pages = 0;
    let nextPage = null;
    while (pages < maxPages && items.length < maxItems) {
        const size = Math.min(Number(body.size) || 100, maxItems - items.length);
        const result = await immichFetch("/api/search/metadata", {
            method: "POST",
            body: { ...body, page, size }
        });
        if (!result.ok) return { ...result, items: [], pages };
        const assets = result.data.assets || {};
        const pageItems = Array.isArray(assets.items) ? assets.items : [];
        items.push(...pageItems.slice(0, maxItems - items.length));
        pages += 1;
        nextPage = assets.nextPage;
        if (!nextPage) break;
        const parsedNextPage = Number.parseInt(nextPage, 10);
        if (!Number.isInteger(parsedNextPage) || parsedNextPage <= page) break;
        page = parsedNextPage;
    }
    return {
        ok: true,
        items,
        pages,
        // A remaining cursor means the bounded search intentionally left more
        // Immich results unread (including a defensive stop on an invalid cursor).
        truncated: Boolean(nextPage)
    };
}

function onThisDayStageRanges(year, month, day, stage) {
    const center = Date.UTC(year, month - 1, day);
    const range = (startOffset, endOffset) => ({
        center,
        start: new Date(center + startOffset * 86400000).toISOString().slice(0, 10),
        end: new Date(center + endOffset * 86400000).toISOString().slice(0, 10)
    });
    if (stage === 0) return [range(0, 0)];
    if (stage === 1) return [range(-1, -1), range(1, 1)];
    return [range(-3, -2), range(2, 3)];
}

function toOnThisDayCandidate(asset, center, fallbackYear, start, end) {
    const captureTime = memoryCaptureTime(asset);
    if (!captureTime) return null;
    const captured = new Date(captureTime);
    const captureDate = captured.toISOString().slice(0, 10);
    if (captureDate < start || captureDate > end) return null;
    const captureDay = Date.UTC(captured.getUTCFullYear(), captured.getUTCMonth(), captured.getUTCDate());
    return {
        asset,
        year: captured.getUTCFullYear() || fallbackYear,
        captureTime,
        captureDate,
        dayOffset: Math.round((captureDay - center) / 86400000)
    };
}

// GET /api/immich/on-this-day?month=&day=&limit=5&memberId= — person-focused memories across years
app.get("/api/immich/on-this-day", async (req, res) => {
    if (!IMMICH_MEMORIES_ENABLED) {
        return res.status(503).json({ error: "Immich memories are disabled", status: "disabled" });
    }
    const { month, day, limit, memberId } = req.query;
    const now = new Date();
    const m = month === undefined ? now.getMonth() + 1 : Number.parseInt(month, 10);
    const d = day === undefined ? now.getDate() : Number.parseInt(day, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const lim = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 5;
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 31) {
        return res.status(400).json({ error: "invalid month or day" });
    }
    const referenceDate = new Date(Date.UTC(2000, m - 1, d));
    if (referenceDate.getUTCMonth() !== m - 1 || referenceDate.getUTCDate() !== d) {
        return res.status(400).json({ error: "invalid month or day" });
    }

    const year = now.getFullYear();
    const years = Array.from({ length: 5 }, (_, index) => year - index - 1).filter(y => {
        const candidate = new Date(Date.UTC(y, m - 1, d));
        return candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d;
    });
    let selectionMode = "linked-household-people";
    let linkedPersonIds;
    let earliestCaptureTime = 0;
    if (memberId !== undefined) {
        if (!/^[1-9][0-9]{0,11}$/.test(String(memberId))) {
            return res.status(400).json({ error: "invalid member id" });
        }
        const member = queryOne("SELECT immich_person_id, birth_date FROM users WHERE id = ?", [memberId]);
        if (!member) return res.status(404).json({ error: "Member not found" });
        selectionMode = "linked-member-person";
        linkedPersonIds = new Set(member.immich_person_id && member.immich_person_id.trim()
            ? [member.immich_person_id]
            : []);
        if (/^\d{4}-\d{2}-\d{2}$/.test(member.birth_date || "")) {
            const parsedBirthDate = Date.parse(`${member.birth_date}T00:00:00.000Z`);
            if (Number.isFinite(parsedBirthDate)) earliestCaptureTime = parsedBirthDate;
        }
    } else {
        linkedPersonIds = new Set(queryAll(
            `SELECT immich_person_id FROM users
             WHERE immich_person_id IS NOT NULL AND TRIM(immich_person_id) != ''
             ORDER BY COALESCE(sort_order, id), id`
        ).map(row => row.immich_person_id));
    }
    if (!linkedPersonIds.size) {
        res.set('Cache-Control', 'private, max-age=300');
        return res.json({
            assets: [], month: m, day: d,
            selection: {
                mode: selectionMode,
                linkedPeople: 0,
                candidates: 0,
                personFocused: 0,
                deduplicated: 0
            }
        });
    }
    const candidateSize = Math.min(Math.max(lim * 8, 40), 100);
    const allAssets = [];
    let selection = { selected: [], focusedCount: 0, deduplicatedCount: 0 };
    let firstFailure = null;
    let successfulQueries = 0;
    let searchedWindowDays = 0;
    for (const stage of [0, 1, 3]) {
        const queries = years.flatMap(year => onThisDayStageRanges(year, m, d, stage)
            .map(async ({ center, start, end }) => {
                const result = await immichFetch("/api/search/metadata", {
                    method: "POST",
                    body: {
                        page: 1,
                        size: stage === 0 ? candidateSize : 100,
                        takenAfter: `${start}T00:00:00.000Z`,
                        takenBefore: `${end}T23:59:59.999Z`,
                        type: "IMAGE",
                        withExif: true,
                        withPeople: true
                    }
                });
                return { year, center, start, end, result };
            }));
        const results = await Promise.all(queries);
        successfulQueries += results.filter(entry => entry.result.ok).length;
        firstFailure ||= results.find(entry => !entry.result.ok)?.result || null;
        if (stage === 0 && successfulQueries === 0 && firstFailure) {
            return sendImmichFailure(res, firstFailure, "memories");
        }
        for (const { year: assetYear, center, start, end, result } of results) {
            if (!result.ok) continue;
            const items = (result.data.assets && result.data.assets.items) || [];
            allAssets.push(...items
                .map(asset => toOnThisDayCandidate(asset, center, assetYear, start, end))
                .filter(Boolean));
        }
        selection = memberId === undefined
            ? selectHouseholdBalancedMemories(allAssets, linkedPersonIds, lim)
            : selectPersonFocusedMemories(allAssets, linkedPersonIds, lim, earliestCaptureTime);
        searchedWindowDays = stage;
        if (selection.selected.length >= lim) break;
    }
    const usedWindowDays = selection.selected.reduce(
        (largest, candidate) => Math.max(largest, Math.abs(candidate.dayOffset || 0)),
        0
    );
    res.set('Cache-Control', 'private, max-age=300');
    res.json({
        assets: selection.selected.map(({ asset, year: assetYear, captureDate, dayOffset }) => ({
            id: asset.id,
            fileCreatedAt: asset.fileCreatedAt,
            year: assetYear,
            type: asset.type,
            date: captureDate,
            dayOffset
        })),
        month: m,
        day: d,
        selection: {
            mode: selectionMode,
            linkedPeople: linkedPersonIds.size,
            candidates: allAssets.length,
            personFocused: selection.focusedCount,
            deduplicated: selection.deduplicatedCount,
            windowDays: usedWindowDays,
            searchedWindowDays
        },
        ...(firstFailure ? { partial: true, status: firstFailure.kind } : {})
    });
});

// GET /api/members/:id/weeks/:weekIndex/memories?limit=9 — personal week playback
app.get("/api/members/:id/weeks/:weekIndex/memories", async (req, res) => {
    if (!IMMICH_MEMORIES_ENABLED) {
        return res.status(503).json({ error: "Immich memories are disabled", status: "disabled" });
    }
    if (!/^[1-9][0-9]{0,11}$/.test(String(req.params.id)) || !/^\d{1,5}$/.test(String(req.params.weekIndex))) {
        return res.status(400).json({ error: "invalid member or week" });
    }
    const member = queryOne(
        "SELECT birth_date, expected_age, immich_person_id FROM users WHERE id = ?",
        [req.params.id]
    );
    if (!member) return res.status(404).json({ error: "Member not found" });
    const birthDate = parseDateOnlyUtc(member.birth_date);
    if (!birthDate) return res.status(409).json({ error: "Member birth date required" });
    const weekIndex = Number.parseInt(req.params.weekIndex, 10);
    const totalWeeks = Math.max(1, Number(member.expected_age) || 80) * 52;
    if (weekIndex < 0 || weekIndex >= totalWeeks) {
        return res.status(400).json({ error: "week outside member lifespan" });
    }
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 9) : 9;
    const start = new Date(birthDate.getTime() + weekIndex * 7 * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);
    const personId = member.immich_person_id && member.immich_person_id.trim();
    if (!personId) {
        res.set('Cache-Control', 'private, max-age=300');
        return res.json({
            assets: [], range: { start: startKey, end: endKey },
            selection: {
                mode: "linked-member-week", linkedPeople: 0,
                candidates: 0, personFocused: 0, deduplicated: 0
            }
        });
    }

    const result = await searchImmichMetadataPages({
            size: 100,
            takenAfter: `${startKey}T00:00:00.000Z`,
            takenBefore: `${endKey}T23:59:59.999Z`,
            type: "IMAGE",
            personIds: [personId],
            withExif: true,
            withPeople: true
    }, { maxPages: 3, maxItems: 300 });
    if (!result.ok) return sendImmichFailure(res, result, "week memories");
    const candidates = result.items.map(asset => ({
        asset,
        year: new Date(memoryCaptureTime(asset) || start.getTime()).getUTCFullYear()
    }));
    const selection = selectWeeklyPersonMemories(candidates, new Set([personId]), limit, birthDate.getTime());
    res.set('Cache-Control', 'private, max-age=300');
    res.json({
        assets: selection.selected.map(({ asset, captureTime }) => ({
            id: asset.id,
            fileCreatedAt: asset.fileCreatedAt,
            capturedAt: new Date(captureTime).toISOString(),
            date: new Date(captureTime).toISOString().slice(0, 10),
            type: asset.type
        })),
        range: { start: startKey, end: endKey },
        selection: {
            mode: "linked-member-week",
            linkedPeople: 1,
            candidates: candidates.length,
            personFocused: selection.focusedCount,
            deduplicated: selection.deduplicatedCount,
            pages: result.pages,
            truncated: result.truncated
        }
    });
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
