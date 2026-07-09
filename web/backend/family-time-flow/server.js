// FamilyTimeFlow Backend
// Placeholder — Phase 2 will implement the full API

const express = require("express");
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ status: "FamilyTimeFlow backend is running" });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FamilyTimeFlow backend listening on port ${PORT}`);
});