const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

console.log("Starting AI Hedging backend...");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
  console.log("Created data directory:", DATA_DIR);
}

app.get("/", (req, res) => {
  res.send("AI Hedging backend is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is healthy.",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/experiment", (req, res) => {
  try {
    const payload = req.body;

    console.log("POST /api/experiment ontvangen");
    console.log("Participant:", payload?.meta?.participant_id || "unknown");

    if (!payload || !payload.meta || !Array.isArray(payload.logs)) {
      console.log("Ongeldige payload ontvangen");
      return res.status(400).json({
        ok: false,
        message: "Invalid payload structure.",
      });
    }

    const participantId = payload.meta.participant_id || "unknown";
    const timestamp = Date.now();
    const safeParticipantId = String(participantId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeParticipantId}_${timestamp}.json`;
    const filePath = path.join(DATA_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

    console.log("Bestand opgeslagen:", fileName);
    console.log("Aantal logs:", Array.isArray(payload.logs) ? payload.logs.length : 0);

    return res.status(200).json({
      ok: true,
      message: "Payload saved successfully.",
      file: fileName,
    });
  } catch (error) {
    console.error("Save error:", error);
    return res.status(500).json({
      ok: false,
      message: "Server failed to save payload.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route not found.",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});