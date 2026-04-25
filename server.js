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
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function mean(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : "";
}

app.get("/", (req, res) => {
  res.send("AI Hedging backend is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is healthy.",
    timestamp: new Date().toISOString(),
    data_dir: DATA_DIR,
    json_files: getJsonFiles().length,
  });
});

app.post("/api/experiment", (req, res) => {
  try {
    const payload = req.body;

    console.log("POST /api/experiment ontvangen");
    console.log("Participant:", payload?.meta?.participant_id || "unknown");

    if (!payload || !payload.meta || !Array.isArray(payload.logs)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid payload structure. Expected { meta, logs: [] }.",
      });
    }

    const participantId = payload.meta.participant_id || "unknown";
    const timestamp = Date.now();
    const fileName = `${safeParticipantId(participantId)}_${timestamp}.json`;
    const filePath = path.join(DATA_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

    console.log("Saved:", fileName);

    return res.status(200).json({
      ok: true,
      message: "Payload saved successfully.",
      file: fileName,
      download_all_url: "/api/download-all",
      trials_csv_url: "/api/download-trials-csv",
      participants_csv_url: "/api/download-participants-csv",
      interviews_csv_url: "/api/download-interviews-csv",
    });
  } catch (error) {
    console.error("Save error:", error);
    return res.status(500).json({
      ok: false,
      message: "Server failed to save payload.",
    });
  }
});

app.get("/api/files", (req, res) => {
  try {
    const files = getJsonFiles();
    return res.status(200).json({
      ok: true,
      count: files.length,
      files,
    });
  } catch (error) {
    console.error("Files error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to list files.",
    });
  }
});

app.get("/api/download-all", (req, res) => {
  try {
    const files = getJsonFiles();
    const allData = files.map((file) => ({
      source_file: file,
      ...readJsonFile(file),
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
  return res.redirect("/api/download-trials-csv");
});

app.get("/api/download-trials-csv", (req, res) => {
  try {
    const files = getJsonFiles();
    const rows = [];

    files.forEach((file) => {
      const session = readJsonFile(file);
      const meta = session.meta || {};
      const logs = Array.isArray(session.logs) ? session.logs : [];

      logs.forEach((log) => {
        rows.push({
          source_file: file,
          participant_id: meta.participant_id || "",
          condition: meta.condition || "",
          condition_label: meta.condition_label || "",
          hedging: meta.hedging ?? "",
          modality: meta.modality ?? "",
          session_start: meta.session_start || "",
          session_end: meta.session_end || "",
          session_status: meta.session_status || "",
          trust_score_mean: meta.trust_score_mean ?? "",
          nasa_tlx_raw_mean: meta.nasa_tlx_raw_mean ?? "",
          interview_consent: meta.interview_consent || "",
          ...log,
        });
      });
    });

    const csv = rowsToCsv(rows, [
      "source_file",
      "participant_id",
      "condition",
      "condition_label",
      "hedging",
      "modality",
      "item_id",
      "block",
      "trial_index",
      "correctness",
      "displayed_answer",
      "hedge_phrase",
      "hedge_type",
      "verify_clicked",
      "verify_count",
      "final_decision",
      "decision_time_ms",
      "final_accuracy",
      "question",
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ai_hedging_trial_data.csv");

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Trial CSV error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate trial CSV.",
    });
  }
});

app.get("/api/download-participants-csv", (req, res) => {
  try {
    const files = getJsonFiles();

    const rows = files.map((file) => {
      const session = readJsonFile(file);
      const meta = session.meta || {};
      const logs = Array.isArray(session.logs) ? session.logs : [];

      const completed = logs.length;
      const accepted = logs.filter((r) => Number(r.final_decision) === 1).length;
      const rejected = logs.filter((r) => Number(r.final_decision) === 0).length;
      const verified = logs.filter((r) => Number(r.verify_clicked) === 1).length;
      const correct = logs.filter((r) => Number(r.final_accuracy) === 1).length;

      return {
        source_file: file,
        participant_id: meta.participant_id || "",
        condition: meta.condition || "",
        condition_label: meta.condition_label || "",
        hedging: meta.hedging ?? "",
        modality: meta.modality ?? "",
        session_start: meta.session_start || "",
        session_end: meta.session_end || "",
        session_status: meta.session_status || "",
        n_trials_completed: completed,
        accepted,
        rejected,
        verified,
        correct,
        accept_rate: completed ? accepted / completed : "",
        reject_rate: completed ? rejected / completed : "",
        verify_rate: completed ? verified / completed : "",
        accuracy_rate: completed ? correct / completed : "",
        mean_decision_time_ms: mean(logs.map((r) => Number(r.decision_time_ms))),
        manipulation_uncertainty: meta.manipulation_uncertainty || "",
        manipulation_certainty: meta.manipulation_certainty || "",
        trust_score_mean: meta.trust_score_mean ?? "",
        nasa_tlx_raw_mean: meta.nasa_tlx_raw_mean ?? "",
        ueq_scale_scores: meta.ueq_scale_scores
          ? JSON.stringify(meta.ueq_scale_scores)
          : "",
        interview_consent: meta.interview_consent || "",
        assignment_mode: meta.assignment_mode || "",
      };
    });

    const csv = rowsToCsv(rows, [
      "source_file",
      "participant_id",
      "condition",
      "condition_label",
      "hedging",
      "modality",
      "session_start",
      "session_end",
      "session_status",
      "n_trials_completed",
      "accepted",
      "rejected",
      "verified",
      "correct",
      "accept_rate",
      "reject_rate",
      "verify_rate",
      "accuracy_rate",
      "mean_decision_time_ms",
      "manipulation_uncertainty",
      "manipulation_certainty",
      "trust_score_mean",
      "nasa_tlx_raw_mean",
      "ueq_scale_scores",
      "interview_consent",
      "assignment_mode",
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ai_hedging_participant_data.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Participant CSV error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate participant CSV.",
    });
  }
});

app.get("/api/download-interviews-csv", (req, res) => {
  try {
    const files = getJsonFiles();

    const rows = files.map((file) => {
      const session = readJsonFile(file);
      const meta = session.meta || {};

      return {
        source_file: file,
        participant_id: meta.participant_id || "",
        condition: meta.condition || "",
        condition_label: meta.condition_label || "",
        hedging: meta.hedging ?? "",
        modality: meta.modality ?? "",
        interview_consent: meta.interview_consent || "",
        interview_strategy: meta.interview_strategy || "",
        interview_hedges: meta.interview_hedges || "",
        interview_modality: meta.interview_modality || "",
        interview_block_changes: meta.interview_block_changes || "",
      };
    });

    const csv = rowsToCsv(rows, [
      "source_file",
      "participant_id",
      "condition",
      "condition_label",
      "hedging",
      "modality",
      "interview_consent",
      "interview_strategy",
      "interview_hedges",
      "interview_modality",
      "interview_block_changes",
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ai_hedging_interview_data.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Interview CSV error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate interview CSV.",
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