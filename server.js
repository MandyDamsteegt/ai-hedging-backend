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

function safeParticipantId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function loadAllJsonFiles() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.toLowerCase().endsWith(".json"));

  return files.map((file) => {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf8");
    return {
      file,
      parsed: JSON.parse(content),
    };
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escapeCell = (value) => {
    const stringValue = value == null ? "" : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(row[header])).join(",")
    ),
  ].join("\n");
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
    const fileName = `${safeParticipantId(participantId)}_${timestamp}.json`;
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

app.get("/api/download-all", (req, res) => {
  try {
    const allData = loadAllJsonFiles().map((entry) => ({
      file: entry.file,
      ...entry.parsed,
    }));

    return res.status(200).json({
      ok: true,
      count: allData.length,
      data: allData,
    });
  } catch (error) {
    console.error("Download-all error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load data.",
    });
  }
});

app.get("/api/download-csv", (req, res) => {
  try {
    const allEntries = loadAllJsonFiles();
    const rows = [];

    allEntries.forEach(({ file, parsed }) => {
      const meta = parsed.meta || {};
      const logs = Array.isArray(parsed.logs) ? parsed.logs : [];

      logs.forEach((log) => {
        rows.push({
          source_file: file,
          participant_id: meta.participant_id || "",
          condition: meta.condition || "",
          condition_label: meta.condition_label || "",
          hedging: meta.hedging ?? "",
          modality: meta.modality ?? "",
          session_status: meta.session_status || "",
          session_start: meta.session_start || "",
          session_end: meta.session_end || "",
          manipulation_uncertainty: meta.manipulation_uncertainty || "",
          manipulation_certainty: meta.manipulation_certainty || "",
          trust_score_mean: meta.trust_score_mean ?? "",
          nasa_tlx_raw_mean: meta.nasa_tlx_raw_mean ?? "",
          interview_consent: meta.interview_consent || "",
          ...log,
        });
      });
    });

    const csv = toCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ai_hedging_data.csv");
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Download-csv error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate CSV.",
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