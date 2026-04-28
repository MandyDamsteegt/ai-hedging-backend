const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

console.log("Starting AI Hedging backend...");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
  console.log("Created data directory:", DATA_DIR);
}

function safeParticipantId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getJsonFiles() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.toLowerCase().endsWith(".json"));
}

function readJsonFile(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function rowsToCsv(rows, fallbackHeaders = []) {
  const headers = rows.length
    ? Array.from(
        rows.reduce((set, row) => {
          Object.keys(row).forEach((key) => set.add(key));
          return set;
        }, new Set())
      )
    : fallbackHeaders;

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ].join("\n");
}

function mean(values) {
  const nums = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : "";
}

/* -------------------- BASIC -------------------- */

app.get("/", (req, res) => {
  res.send("AI Hedging backend is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    json_files: getJsonFiles().length,
  });
});

/* -------------------- SAVE -------------------- */

app.post("/api/experiment", (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.meta || !Array.isArray(payload.logs)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid payload",
      });
    }

    const participantId = payload.meta.participant_id || "unknown";
    const fileName = `${safeParticipantId(participantId)}_${Date.now()}.json`;

    fs.writeFileSync(
      path.join(DATA_DIR, fileName),
      JSON.stringify(payload, null, 2)
    );

    return res.json({
      ok: true,
      file: fileName,
      endpoints: {
        trials: "/api/download-trials-csv",
        participants: "/api/download-participants-csv",
        interviews: "/api/download-interviews-csv",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

/* -------------------- FILES -------------------- */

app.get("/api/files", (req, res) => {
  res.json({
    ok: true,
    files: getJsonFiles(),
  });
});

/* -------------------- DOWNLOAD ALL -------------------- */

app.get("/api/download-all", (req, res) => {
  const files = getJsonFiles();

  const data = files.map((file) => ({
    source_file: file,
    ...readJsonFile(file),
  }));

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

/* -------------------- TRIAL CSV -------------------- */

app.get("/api/download-trials-csv", (req, res) => {
  const files = getJsonFiles();
  const rows = [];

  files.forEach((file) => {
    const session = readJsonFile(file);
    const meta = session.meta || {};
    const logs = session.logs || [];

    logs.forEach((log) => {
      rows.push({
        participant_id: meta.participant_id,
        condition: meta.condition,
        hedging: meta.hedging,
        modality: meta.modality,
        ...log,
      });
    });
  });

  const csv = rowsToCsv(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=trials.csv");
  res.send(csv);
});

/* -------------------- PARTICIPANT CSV -------------------- */

app.get("/api/download-participants-csv", (req, res) => {
  const files = getJsonFiles();

  const rows = files.map((file) => {
    const session = readJsonFile(file);
    const meta = session.meta || {};
    const logs = session.logs || [];

    return {
      participant_id: meta.participant_id,
      condition: meta.condition,
      trials: logs.length,
      accuracy: mean(logs.map((l) => l.final_accuracy)),
      decision_time: mean(logs.map((l) => l.decision_time_ms)),
      trust: meta.trust_score_mean,
      workload: meta.nasa_tlx_raw_mean,
    };
  });

  const csv = rowsToCsv(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=participants.csv"
  );
  res.send(csv);
});

/* -------------------- INTERVIEW CSV -------------------- */

app.get("/api/download-interviews-csv", (req, res) => {
  const files = getJsonFiles();

  const rows = files.map((file) => {
    const meta = readJsonFile(file).meta || {};

    return {
      participant_id: meta.participant_id,
      condition: meta.condition,
      strategy: meta.interview_strategy,
      hedges: meta.interview_hedges,
      modality: meta.interview_modality,
      block_changes: meta.interview_block_changes,
    };
  });

  const csv = rowsToCsv(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=interviews.csv"
  );
  res.send(csv);
});

/* -------------------- verwijderen -------------------- */
app.delete("/api/clear-data", (req, res) => {
  try {
    const files = getJsonFiles();

    files.forEach((file) => {
      const filePath = path.join(DATA_DIR, file);
      fs.unlinkSync(filePath);
    });

    console.log(`Deleted ${files.length} files`);

    return res.status(200).json({
      ok: true,
      message: `Deleted ${files.length} files`,
    });
  } catch (error) {
    console.error("Clear data error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to clear data",
    });
  }
});
/* -------------------- verwijderen data -------------------- */

/* -------------------- 404 -------------------- */

app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Not found" });
});

/* -------------------- START -------------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});