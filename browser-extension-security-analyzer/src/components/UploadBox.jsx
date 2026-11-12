
import { useRef, useState } from "react";
import "./UploadBox.css";
import SecurityReport from "./SecurityReport";

const MAX_SIZE = 50 * 1024 * 1024;

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Request failed: ${response.status}`);
  }
  return data;
}

async function analyzeStage(stage, extensionPath) {
  const params = new URLSearchParams({ extension_path: extensionPath });
  const response = await fetch(`/api/analyze/${stage}?${params}`, {
    method: "POST",
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

    for (const key of ["manifest", "static", "risk"]) {
      onStageStatusChange(key, "Pending");
    }

    onStageStatusChange("dynamic", "Disabled");
    onStageStatusChange("sandbox", "Not verified");

    let currentStage = "manifest";
    let completedReport = null;

    try {
      const form = new FormData();
      form.append("file", file);

      const uploadResponse = await fetch("/api/upload/extension", {
        method: "POST",
        body: form,
      });

      const uploadData = await readResponse(uploadResponse);

      if (!uploadData.extension_path) {
        throw new Error("The backend did not return an extension path.");
      }

      setUpload(uploadData);
      setStage("manifest");
      onStageStatusChange("manifest", "Running");

      const manifestData = await analyzeStage(
        "manifest",
        uploadData.extension_path
      );

      setManifest(manifestData);
      onStageStatusChange("manifest", "Completed");

      currentStage = "static";
      setStage("static");
      onStageStatusChange("static", "Running");

      const staticData = await analyzeStage(
        "static",
        uploadData.extension_path
      );

      setStaticResult(staticData);
      onStageStatusChange("static", "Completed");

      onStageStatusChange("dynamic", "Disabled");
      onStageStatusChange("sandbox", "Not verified");
      onStageStatusChange("risk", "Completed");

      completedReport = {
        extension_name:
          manifestData.name ||
          manifestData.extension_name ||
          file.name.replace(/\.zip$/i, ""),
        uploaded_file: file.name,
        upload: uploadData,
        manifest: manifestData,
        static_analysis: staticData,
        dynamic_analysis: {
          status: "Disabled",
          reason: "Sandbox isolation has not been verified.",
        },
        generated_at: new Date().toISOString(),
      };

      setReport(completedReport);
      setStage("completed");
      onAnalysisComplete(true, completedReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage("failed");
      onStageStatusChange(currentStage, "Failed");
      onStageStatusChange("risk", "Failed");
      onAnalysisComplete(false, completedReport);
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

  function downloadReport() {
    if (!report) return;

    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "extension-security-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const steps = [
    ["uploading", "Upload and extract ZIP"],
    ["manifest", "Inspect manifest and permissions"],
    ["static", "Analyze source code"],
    ["completed", "Prepare results"],
  ];

  const stageIndex = steps.findIndex(([key]) => key === stage);

  return (
    <div className="upload-workspace">
      <section className="upload-card">
        <div className="upload-card-heading">
          <div>
            <span className="upload-kicker">NEW SECURITY SCAN</span>
            <h3>Upload a browser extension</h3>
            <p>
              Select a ZIP package for manifest and source-code inspection.
            </p>
          </div>
          <span className="upload-shield">◈</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="upload-hidden-input"
          onChange={(e) => selectFile(e.target.files?.[0])}
          disabled={loading}
        />

        <div
          className={`upload-dropzone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            selectFile(e.dataTransfer.files?.[0]);
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
          <strong>Safe analysis mode</strong>
          <p>
            The extension is not executed. Dynamic analysis stays disabled
            until sandbox isolation has been verified.
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

      {(loading || stage === "completed" || stage === "failed") && (
        <section className="upload-card">
          <span className="upload-kicker">SCAN PROGRESS</span>
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
                stage === "failed" && index === stageIndex
                  ? "Failed"
                  : stage === "completed" || stageIndex > index
                    ? "Completed"
                    : stageIndex === index
                      ? "Running"
                      : "Pending";

              return (
                <div className="upload-step" key={key}>
                  <span
                    className={`upload-step-number ${status.toLowerCase()}`}
                  >
                    {status === "Completed" ? "✓" : index + 1}
                  </span>
                  <span>{label}</span>
                  <span className="upload-step-status">{status}</span>
                </div>
              );
            })}
          </div>

          <p className="upload-disabled-stage">
            Dynamic analysis: disabled pending sandbox verification.
          </p>
        </section>
      )}

      {report && (
        <section className="upload-card upload-results-card">
          <span className="upload-kicker">ANALYSIS OUTPUT</span>
          <h3>Security assessment report</h3>

          <SecurityReport report={report} />

          <button
            type="button"
            className="upload-secondary-button"
            onClick={downloadReport}
          >
            Download JSON report
          </button>
        </section>
      )}
    </div>
  );
}
