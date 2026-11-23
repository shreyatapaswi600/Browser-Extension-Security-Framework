
import { useRef, useState } from "react";

import "./UploadBox.css";
import SecurityReport from "./SecurityReport";

const MAX_SIZE = 50 * 1024 * 1024;
const DEFAULT_TARGET_URL = "https://example.com/";

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || `Request failed: ${response.status}`
    );
  }

  return data;
}

async function uploadExtension(file) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/upload/extension", {
    method: "POST",
    body: form,
  });

  return readResponse(response);
}

async function createAnalysisJob(extensionPath) {
  const response = await fetch("/api/analysis/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      extension_path: extensionPath,
      target_url: DEFAULT_TARGET_URL,
    }),
  });

  return readResponse(response);
}

export default function UploadBox({
  onStageStatusChange = () => {},
  onAnalysisStart = () => {},
  onAnalysisComplete = () => {},
}) {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");

  const [upload, setUpload] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [staticResult, setStaticResult] = useState(null);
  const [report, setReport] = useState(null);

  function selectFile(candidate) {
    setError("");
    setUpload(null);
    setManifest(null);
    setStaticResult(null);
    setReport(null);
    setStage("idle");

    if (!candidate) return;

    if (!candidate.name.toLowerCase().endsWith(".zip")) {
      setFile(null);
      setError("Please choose a browser extension ZIP file.");
      return;
    }

    if (candidate.size === 0) {
      setFile(null);
      setError("The selected file is empty.");
      return;
    }

    if (candidate.size > MAX_SIZE) {
      setFile(null);
      setError("The ZIP file must be smaller than 50 MB.");
      return;
    }

    setFile(candidate);
  }

  async function startAnalysis() {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    setStage("uploading");

    setUpload(null);
    setManifest(null);
    setStaticResult(null);
    setReport(null);

    onAnalysisStart();

    const stages = ["manifest", "static", "evidence", "risk"];

    stages.forEach((key) => {
      onStageStatusChange(key, "Pending");
    });

    let currentStage = "manifest";

    try {
      // Stage 1: Upload and safely extract the extension.
      const uploadData = await uploadExtension(file);

      if (!uploadData.extension_path) {
        throw new Error(
          "The backend did not return an extension path."
        );
      }

      setUpload(uploadData);
      setStage("analyzing");

      // Stage 2: Submit the extension to the Docker analysis pipeline.
      currentStage = "manifest";
      onStageStatusChange("manifest", "Running");

      onStageStatusChange("static", "Running");

      const analysisResponse = await createAnalysisJob(
        uploadData.extension_path
      );

      const job = analysisResponse.job;
      const result = analysisResponse.result;

      if (!job || !result) {
        throw new Error(
          "The backend returned an incomplete analysis response."
        );
      }

      if (job.status !== "completed") {
        throw new Error(
          job.error || "The analysis job did not complete."
        );
      }

      // Extract the actual backend-generated analysis results.
      const manifestData = result.extension || {};

      const evidenceData = result.evidence || {};

      const staticData = evidenceData.static_analysis || {};

      const advancedData =
        staticData.advanced_analysis || {};

      const riskData = result.risk_assessment || null;

      const reportData = result.reports || {};

      setManifest(manifestData);
      setStaticResult(staticData);

      // Update pipeline stages using actual backend results.
      currentStage = "manifest";
      onStageStatusChange("manifest", "Completed");

      currentStage = "static";
      onStageStatusChange(
        "static",
        staticData.status === "Completed"
          ? "Completed"
          : "Pending"
      );

      currentStage = "evidence";
      onStageStatusChange(
        "evidence",
        advancedData.status === "Completed"
          ? "Completed"
          : "Pending"
      );

      currentStage = "risk";
      onStageStatusChange(
        "risk",
        riskData ? "Completed" : "Pending"
      );

      // Preserve the complete backend response.
      const completedReport = {
        job,
        result,
        upload: uploadData,

        job_id: job.job_id,

        extension_name:
          manifestData.name ||
          job.extension_name ||
          file.name.replace(/\.zip$/i, ""),

        uploaded_file: file.name,

        manifest: manifestData,

        static_analysis: staticData,

        advanced_analysis: advancedData,

        evidence: evidenceData,

        risk_assessment: riskData,

        reports: reportData,

        execution: result.execution,

        generated_at:
          reportData.generated_at ||
          new Date().toISOString(),
      };

      setReport(completedReport);
      setStage("completed");

      onAnalysisComplete(true, completedReport);

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Extension analysis failed.";

      setError(message);
      setStage("failed");

      onStageStatusChange(currentStage, "Failed");
      onStageStatusChange("risk", "Failed");

      onAnalysisComplete(false, null);

    } finally {
      setLoading(false);
    }
  }

  function clearUpload() {
    if (loading) return;

    setFile(null);
    setError("");
    setUpload(null);
    setManifest(null);
    setStaticResult(null);
    setReport(null);
    setStage("idle");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function getReportUrl(format) {
    const jobId = report?.job?.job_id;

    if (!jobId) return null;

    return `/api/analysis/jobs/${encodeURIComponent(
      jobId
    )}/reports/${format}`;
  }

  const steps = [
    ["uploading", "Upload and safely extract ZIP"],
    ["analyzing", "Run Docker-based analysis"],
    ["completed", "Generate assessment and reports"],
  ];

  const stageIndex = steps.findIndex(
    ([key]) => key === stage
  );

  return (
    <div className="upload-workspace">
      <section className="upload-card">
        <div className="upload-card-heading">
          <div>
            <span className="upload-kicker">
              NEW SECURITY SCAN
            </span>

            <h3>Upload a browser extension</h3>

            <p>
              Select a ZIP package for manifest inspection,
              static code analysis, evidence correlation,
              and risk assessment.
            </p>
          </div>

          <span className="upload-shield">◈</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="upload-hidden-input"
          onChange={(event) =>
            selectFile(event.target.files?.[0])
          }
          disabled={loading}
        />

        <div
          className={`upload-dropzone ${
            dragging ? "is-dragging" : ""
          } ${file ? "has-file" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();

            if (
              !event.currentTarget.contains(
                event.relatedTarget
              )
            ) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files?.[0]);
          }}
        >
          <div className="upload-cloud-icon">↑</div>

          <h4>
            {file
              ? file.name
              : "Drag and drop your extension ZIP here"}
          </h4>

          <p>
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
              : "Or browse your computer to select a file"}
          </p>

          <button
            type="button"
            className="upload-browse-button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {file ? "Choose another file" : "Browse files"}
          </button>

          <span className="upload-file-hint">
            ZIP format · Maximum 50 MB
          </span>
        </div>

        {error && (
          <div className="upload-error" role="alert">
            <strong>Upload or analysis failed</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="upload-safety-note">
          <strong>Docker-based static analysis</strong>

          <p>
            Uploaded extensions are safely extracted and
            inspected without executing their JavaScript code.
            The backend performs static analysis, evidence
            correlation, risk assessment, and report generation.
          </p>
        </div>

        <div className="upload-actions">
          <button
            type="button"
            className="upload-secondary-button"
            onClick={clearUpload}
            disabled={loading || (!file && !error)}
          >
            Clear
          </button>

          <button
            type="button"
            className="upload-primary-button"
            onClick={startAnalysis}
            disabled={!file || loading}
          >
            {loading ? "Analyzing..." : "Upload & Analyze"}
          </button>
        </div>
      </section>

      {(loading ||
        stage === "completed" ||
        stage === "failed") && (
        <section className="upload-card">
          <span className="upload-kicker">
            SCAN PROGRESS
          </span>

          <h3>
            {stage === "completed"
              ? "Analysis completed"
              : stage === "failed"
                ? "Analysis stopped"
                : "Analyzing extension"}
          </h3>

          <div className="upload-step-list">
            {steps.map(([key, label], index) => {
              const status =
                stage === "failed" &&
                index === stageIndex
                  ? "Failed"
                  : stage === "completed" ||
                      (stageIndex > index && stage !== "failed")
                    ? "Completed"
                    : stageIndex === index
                      ? "Running"
                      : "Pending";

              return (
                <div className="upload-step" key={key}>
                  <span
                    className={`upload-step-number ${status.toLowerCase()}`}
                  >
                    {status === "Completed"
                      ? "✓"
                      : index + 1}
                  </span>

                  <span>{label}</span>

                  <span className="upload-step-status">
                    {status}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="upload-disabled-stage">
            Extension JavaScript execution: Not implemented.
          </p>
        </section>
      )}

      {report && (
        <section className="upload-card upload-results-card">
          <span className="upload-kicker">
            ANALYSIS OUTPUT
          </span>

          <h3>Security assessment report</h3>

          <div className="page-info-card">
            <p>
              <strong>Job ID:</strong>{" "}
              {report.job?.job_id}
            </p>

            <p>
              <strong>Extension:</strong>{" "}
              {report.extension_name}
            </p>

            <p>
              <strong>Analysis status:</strong>{" "}
              {report.job?.status}
            </p>

            <p>
              <strong>Risk level:</strong>{" "}
              {report.risk_assessment?.level || "Unavailable"}
            </p>

            <p>
              <strong>Risk score:</strong>{" "}
              {report.risk_assessment?.score ?? "Unavailable"}
            </p>

            <p>
              <strong>Evidence items:</strong>{" "}
              {report.evidence?.evidence_count ?? 0}
            </p>

            <p>
              <strong>Code execution:</strong> Not performed
            </p>
          </div>

          <SecurityReport report={report} />

          <div className="upload-actions">
            <a
              className="upload-secondary-button"
              href={getReportUrl("json")}
              download={`${report.job?.job_id}.json`}
            >
              Download JSON Report
            </a>

            <a
              className="upload-primary-button"
              href={getReportUrl("html")}
              target="_blank"
              rel="noopener noreferrer"
            >
              View HTML Report
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
