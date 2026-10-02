function AnalysisStep({
  number,
  title,
  description,
  icon,
  color,
  status = "Pending"
}) {

  return (
    <div className="analysis-step">

      <div
        className="step-icon"
        style={{ background: color }}
      >
        {icon}
      </div>

      <h3>
        {number}. {title}
      </h3>

      <p>
        {description}
      </p>

      <span className="pending">
        {status}
      </span>

    </div>
  );
}

export default AnalysisStep;