
import {
  FileText,
  Code2,
  GitBranch,
  ShieldCheck,
} from "lucide-react";

import AnalysisStep from "./AnalysisStep";

function AnalysisPipeline({ statuses = {} }) {
  const steps = [
    {
      number: "1",
      title: "Manifest Analysis",
      description:
        "Inspect manifest.json for permissions, extension configuration, content scripts, and security-sensitive capabilities.",
      icon: <FileText size={25} />,
      color: "#3875e6",
      status: statuses.manifest || "Pending",
    },
    {
      number: "2",
      title: "Static Code Analysis",
      description:
        "Scan JavaScript source files for suspicious patterns, potentially unsafe APIs, and security-related code behavior.",
      icon: <Code2 size={25} />,
      color: "#159c63",
      status: statuses.static || "Pending",
    },
    {
      number: "3",
      title: "Evidence & Data-Flow Analysis",
      description:
        "Trace sensitive data sources, variable flows, and network sinks to identify and correlate security-relevant evidence.",
      icon: <GitBranch size={25} />,
      color: "#6840c7",
      status: statuses.evidence || "Pending",
    },
    {
      number: "4",
      title: "Risk Assessment & Reporting",
      description:
        "Evaluate extension capabilities and correlated evidence, calculate risk levels, and generate JSON and HTML reports.",
      icon: <ShieldCheck size={25} />,
      color: "#e32d32",
      status: statuses.risk || "Pending",
    },
  ];

  return (
    <section className="pipeline-section">
      <div className="pipeline">
        {steps.map((step) => (
          <div className="pipeline-item" key={step.number}>
            <AnalysisStep {...step} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default AnalysisPipeline;
