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
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function rowsToCsv(rows) {
  if (!rows.length) {
    return "participant_id,condition,condition_label\n";
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ];

  return lines.join("\n");
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
    console.log("Aantal logs:", payload.logs.length);

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
    const files = getJsonFiles();
    const allData = files.map((file) => ({
      file,
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
          participant_blinded_to_condition_meaning:
            meta.participant_blinded_to_condition_meaning ?? "",
          assignment_mode: meta.assignment_mode || "",
          offer_interview: meta.offer_interview ?? "",

          session_status: meta.session_status || "",
          session_start: meta.session_start || "",
          session_end: meta.session_end || "",
          n_trials_completed: meta.n_trials_completed ?? "",
          main_trials_planned: meta.main_trials_planned ?? "",
          practice_trials_completed: meta.practice_trials_completed ?? "",

          manipulation_uncertainty: meta.manipulation_uncertainty || "",
          manipulation_certainty: meta.manipulation_certainty || "",

          trust_score_mean: meta.trust_score_mean ?? "",
          nasa_tlx_raw_mean: meta.nasa_tlx_raw_mean ?? "",
          ueq_scale_scores: meta.ueq_scale_scores
            ? JSON.stringify(meta.ueq_scale_scores)
            : "",

          interview_consent: meta.interview_consent || "",
          interview_strategy: meta.interview_strategy || "",
          interview_hedges: meta.interview_hedges || "",
          interview_modality: meta.interview_modality || "",
          interview_block_changes: meta.interview_block_changes || "",

          ...log,
        });
      });
    });

    const csv = rowsToCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ai_hedging_trial_data.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Download-csv error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate CSV.",
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

      const completedLogs = logs.length;
      const accepted = logs.filter((r) => r.final_decision === 1).length;
      const rejected = logs.filter((r) => r.final_decision === 0).length;
      const verified = logs.filter((r) => r.verify_clicked === 1).length;
      const correct = logs.filter((r) => r.final_accuracy === 1).length;

      const meanDecisionTime =
        completedLogs > 0
          ? Math.round(
              logs.reduce((sum, r) => sum + Number(r.decision_time_ms || 0), 0) /
                completedLogs
            )
          : "";

      return {
        source_file: file,

        participant_id: meta.participant_id || "",
        condition: meta.condition || "",
        condition_label: meta.condition_label || "",
        hedging: meta.hedging ?? "",
        modality: meta.modality ?? "",
        participant_blinded_to_condition_meaning:
          meta.participant_blinded_to_condition_meaning ?? "",
        assignment_mode: meta.assignment_mode || "",
        offer_interview: meta.offer_interview ?? "",

        session_status: meta.session_status || "",
        session_start: meta.session_start || "",
        session_end: meta.session_end || "",
        n_trials_completed: meta.n_trials_completed ?? completedLogs,
        main_trials_planned: meta.main_trials_planned ?? "",
        practice_trials_completed: meta.practice_trials_completed ?? "",

        accepted,
        rejected,
        verified,
        correct,
        accept_rate: completedLogs ? accepted / completedLogs : "",
        verify_rate: completedLogs ? verified / completedLogs : "",
        accuracy_rate: completedLogs ? correct / completedLogs : "",
        mean_decision_time_ms: meanDecisionTime,

        manipulation_uncertainty: meta.manipulation_uncertainty || "",
        manipulation_certainty: meta.manipulation_certainty || "",

        trust_score_mean: meta.trust_score_mean ?? "",
        nasa_tlx_raw_mean: meta.nasa_tlx_raw_mean ?? "",
        ueq_scale_scores: meta.ueq_scale_scores
          ? JSON.stringify(meta.ueq_scale_scores)
          : "",

        interview_consent: meta.interview_consent || "",
        interview_strategy: meta.interview_strategy || "",
        interview_hedges: meta.interview_hedges || "",
        interview_modality: meta.interview_modality || "",
        interview_block_changes: meta.interview_block_changes || "",
      };
    });

    const csv = rowsToCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ai_hedging_participant_data.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Download-participants-csv error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate participant CSV.",
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

app.get("/api/clear-data", (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);

    files.forEach((file) => {
      fs.unlinkSync(path.join(DATA_DIR, file));
    });

    res.json({
      ok: true,
      message: "All data cleared",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Failed to clear data",
    });
  }
});