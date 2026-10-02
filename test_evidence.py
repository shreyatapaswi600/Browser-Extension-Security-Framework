from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence


file_path = "Sample_Extension_v5/background.js"

print("=" * 60)
print("EVIDENCE ANALYSIS")
print("=" * 60)

# ------------------------------------------------------------
# STEP 1: Parse JavaScript into ProgramModel
# ------------------------------------------------------------

program_model = analyze_javascript_file(file_path)

# ------------------------------------------------------------
# STEP 2: Analyze data flow
# ------------------------------------------------------------

data_flow_result = analyze_data_flow(program_model)

# ------------------------------------------------------------
# STEP 3: Build security evidence
# ------------------------------------------------------------

evidence_result = analyze_evidence(data_flow_result)

# ------------------------------------------------------------
# STEP 4: Display evidence summary
# ------------------------------------------------------------

print("\nEvidence Count")
print("-" * 60)
print(evidence_result.get("evidence_count", 0))

print("\nSensitive Data Flow Detected")
print("-" * 60)
print(evidence_result.get("sensitive_data_flow", False))

print("\nSources Observed")
print("-" * 60)
print(evidence_result.get("sources_observed", 0))

print("\nNetwork Sinks Observed")
print("-" * 60)
print(evidence_result.get("network_sinks_observed", 0))

print("\nHighest Source Sensitivity")
print("-" * 60)
print(evidence_result.get("highest_source_sensitivity", "none"))

print("\nStatic Evidence Confidence")
print("-" * 60)
print(evidence_result.get("static_confidence", "NONE"))

# ------------------------------------------------------------
# STEP 5: Display individual findings
# ------------------------------------------------------------

for index, evidence in enumerate(
    evidence_result.get("evidence", []),
    start=1
):
    print("\n" + "=" * 60)
    print(f"Finding #{index}")
    print("=" * 60)

    print("Type:", evidence.get("type"))
    print("Behavior:", evidence.get("behavior"))
    print("File:", evidence.get("file"))
    print("Line:", evidence.get("line"))

    print("Source:", evidence.get("source"))
    print("Source Type:", evidence.get("source_type"))
    print("Source Sensitivity:", evidence.get("source_sensitivity"))

    print("Variables:", evidence.get("variables"))

    print("Transformations:")
    transformations = evidence.get("transformations", [])

    if transformations:
        for transformation in transformations:
            print(
                f"    {transformation.get('function')}() "
                f"Line {transformation.get('line')}"
            )
    else:
        print("    None")

    print("Network Sink:", evidence.get("sink"))
    print("Destination:", evidence.get("destination"))
    print(
        "Destination Category:",
        evidence.get("destination_category")
    )
    print("Destination Host:", evidence.get("destination_host"))

    print("Evidence Chain:")
    print("    ", evidence.get("evidence_chain"))

    print(
        "Static Confidence:",
        evidence.get("static_confidence")
    )

    print("Explanation:")
    print("    ", evidence.get("explanation"))

print("\n" + "=" * 60)
print("EVIDENCE ANALYSIS COMPLETE")
print("=" * 60)