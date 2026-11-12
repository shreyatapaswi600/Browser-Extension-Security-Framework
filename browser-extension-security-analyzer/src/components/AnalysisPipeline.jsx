
import {
  FileText,
  Code2,
  Play,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";

import AnalysisStep from "./AnalysisStep";

function AnalysisPipeline({ statuses = {} }) {
  const steps = [
    {
      number: "1",
      title: "Manifest Analysis",
      description:
        "Analyze manifest.json for permissions, modules, and suspicious configurations.",
      icon: <FileText size={25} />,
      color: "#3875e6",
      status: statuses.manifest || "Pending",
    },
    {
      number: "2",
      title: "Static Analysis",
      description:
        "Examine source code for malicious patterns, obfuscation, and suspicious APIs.",
      icon: <Code2 size={25} />,
      color: "#159c63",
      status: statuses.static || "Pending",
    },
    {
      number: "3",
      title: "Dynamic Analysis",
      description:
        "Execute extensions in a controlled environment and monitor behavior and network activity.",
      icon: <Play size={25} />,
      color: "#e59a00",
      status: statuses.dynamic || "Disabled",
    },
    {
      number: "4",
      title: "Simulation Sandbox",
      description:
        "Simulate attack scenarios and evaluate potential impact in an isolated sandbox.",
      icon: <FlaskConical size={25} />,
      color: "#6840c7",
      status: statuses.sandbox || "Not verified",
    },
    {
      number: "5",
      title: "Risk Assessment",
      description:
        "Aggregate findings, calculate a risk score, and determine a threat level.",
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
