import {
  FileText,
  Code2,
  Play,
  FlaskConical,
  ShieldCheck
} from "lucide-react";

import AnalysisStep from "./AnalysisStep";

function AnalysisPipeline() {

  return (
    <section className="pipeline-section">

      <h2>Analysis Pipeline</h2>

      <div className="pipeline">

        <AnalysisStep
          number="1"
          title="Manifest Analysis"
          description="Analyze manifest.json for permissions, modules, and suspicious configurations."
          icon={<FileText size={25} />}
          color="#3875e6"
        />

        <div className="arrow">›</div>

        <AnalysisStep
          number="2"
          title="Static Analysis"
          description="Examine source code for malicious patterns, obfuscation, and suspicious APIs."
          icon={<Code2 size={25} />}
          color="#159c63"
        />

        <div className="arrow">›</div>

        <AnalysisStep
          number="3"
          title="Dynamic Analysis"
          description="Execute extension in controlled environment and monitor behavior and network activity."
          icon={<Play size={25} />}
          color="#e59a00"
        />

        <div className="arrow">›</div>

        <AnalysisStep
          number="4"
          title="Simulation Sandbox"
          description="Simulate attack scenarios and evaluate potential impact in isolated sandbox."
          icon={<FlaskConical size={25} />}
          color="#6840c7"
        />

        <div className="arrow">›</div>

        <AnalysisStep
          number="5"
          title="Risk Assessment"
          description="Aggregate findings, calculate risk score and threat level."
          icon={<ShieldCheck size={25} />}
          color="#e32d32"
        />

      </div>

    </section>
  );
}

export default AnalysisPipeline;