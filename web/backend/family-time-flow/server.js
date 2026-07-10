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
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ==================== DATABASE SETUP (sql.js) ====================
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "ftf.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const initSqlJs = require("sql.js");
let db;
let SQL;

async function initDb() {
    SQL = await initSqlJs();
    // Try to load existing DB, or create new
    try {
        const buf = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buf);
    } catch {
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
    fs.writeFileSync(DB_PATH, buffer);
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
    saveDb();
}

function lastInsertId() {
    const r = queryOne("SELECT last_insert_rowid() as id");
    return r ? r.id : null;
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
app.get("/api/health", (req, res) => res.json({ status: "ok", version: "0.2.0" }));

app.get("/api/sync", (req, res) => {
    const users = queryAll("SELECT * FROM users ORDER BY id");
    const configRows = queryAll("SELECT key, value FROM app_config");
    const config = {};
    configRows.forEach(c => config[c.key] = c.value);
    res.json({
        config,
        users: users.map(u => ({ ...u, education: getEducationInfo(u.birth_date, u.school_system), milestones: getMilestones(u.birth_date, u.school_system) }))
    });
});

app.get("/api/users", (req, res) => res.json(queryAll("SELECT * FROM users ORDER BY id")));

app.post("/api/users", (req, res) => {
    const { name, birth_date, expected_age, identity_tag, school_system, target_date } = req.body;
    run("INSERT INTO users (name, birth_date, expected_age, identity_tag, school_system, target_date) VALUES (?, ?, ?, ?, ?, ?)",
        [name || '', birth_date || null, expected_age || 80, identity_tag || 'student', school_system || 'shanghai', target_date || null]);
    const user = queryOne("SELECT * FROM users WHERE id = ?", [lastInsertId()]);
    res.status(201).json(user);
});

app.get("/api/users/:id", (req, res) => {
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.education = getEducationInfo(user.birth_date, user.school_system);
    user.milestones = getMilestones(user.birth_date, user.school_system);
    user.events = queryAll("SELECT * FROM events WHERE user_id = ? ORDER BY date", [req.params.id]);
    res.json(user);
});

app.put("/api/users/:id", (req, res) => {
    const existing = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "User not found" });
    const b = req.body;
    run(`UPDATE users SET name=COALESCE(?,name), birth_date=COALESCE(?,birth_date), expected_age=COALESCE(?,expected_age),
         identity_tag=COALESCE(?,identity_tag), school_system=COALESCE(?,school_system), target_date=COALESCE(?,target_date),
         immich_sync=COALESCE(?,immich_sync), updated_at=datetime('now') WHERE id=?`,
        [b.name ?? null, b.birth_date ?? null, b.expected_age ?? null, b.identity_tag ?? null,
        b.school_system ?? null, b.target_date ?? null, b.immich_sync ?? null, req.params.id]);
    const user = queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    user.education = getEducationInfo(user.birth_date, user.school_system);
    user.milestones = getMilestones(user.birth_date, user.school_system);
    res.json(user);
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
    run("INSERT INTO events (user_id, title, date, type, color, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [req.params.id, title, date, type || 'custom', color || '#3B82F6', notes || null]);
    const ev = queryOne("SELECT * FROM events WHERE id = ?", [lastInsertId()]);
    res.status(201).json(ev);
});

app.get("/api/users/:id/events", (req, res) => {
    res.json(queryAll("SELECT * FROM events WHERE user_id = ? ORDER BY date ASC", [req.params.id]));
});

app.delete("/api/users/:id/events/:eid", (req, res) => {
    run("DELETE FROM events WHERE id = ? AND user_id = ?", [req.params.eid, req.params.id]);
    res.json({ status: "deleted" });
});

// ==================== START ====================
initDb().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`FamilyTimeFlow backend v0.2.0 listening on port ${PORT}`);
    });
});