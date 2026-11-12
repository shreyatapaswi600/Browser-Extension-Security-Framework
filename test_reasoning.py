
from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence
from analyzer.reasoning_engine import reason_about_evidence


# ============================================================
# Extension To Analyze
# ============================================================

filepath = "Sample_Extension_v2/background.js"


# ============================================================
# Step 1
# AST analysis
# ============================================================

program_model = analyze_javascript_file(filepath)

if program_model is None:
    raise RuntimeError(
        f"AST analysis returned no program model: {filepath}"
    )

if getattr(program_model, "syntax_error", False):
    raise RuntimeError(
        f"JavaScript syntax error detected in: {filepath}"
    )


# ============================================================
# Step 2
# Data-flow analysis
# ============================================================

data_flow_result = analyze_data_flow(program_model)


# ============================================================
# Step 3
# Evidence analysis
# ============================================================

evidence_result = analyze_evidence(data_flow_result)


# ============================================================
# Step 4
# Reasoning
# ============================================================

reasoning_result = reason_about_evidence(evidence_result)


# ============================================================
# Header
# ============================================================

print("=" * 75)
print("BEHAVIORAL REASONING ENGINE")
print("=" * 75)

print(f"\nAnalyzed file: {filepath}")


# ============================================================
# Individual Findings
# ============================================================

print("\nEvidence Assessments")
print("-" * 75)

if reasoning_result["findings"]:

    for index, item in enumerate(
        reasoning_result["findings"],
        start=1
    ):

        evidence = item["evidence"]
        assessment = item["assessment"]

        print(f"\nFinding #{index}")

        print("Behavior:", evidence.get("behavior"))
        print("Source:", evidence.get("source"))
        print(
            "Source Sensitivity:",
            assessment.get("source_sensitivity")
        )

        print("Network Sink:", assessment.get("sink"))
        print("Destination:", assessment.get("destination"))
        print(
            "Destination Category:",
            assessment.get("destination_category")
        )

        print("Evidence Chain:")
        chain = evidence.get("evidence_chain", [])
        print("    " + "  ->  ".join(str(part) for part in chain))

        print("Indicators:")
        for indicator in assessment.get("indicators", []):
            print(f"    - {indicator}")

        print("Concern Level:", assessment.get("concern_level"))
        print(
            "Static Confidence:",
            assessment.get("static_confidence")
        )

        print("Reasoning:")
        for reason in assessment.get("reasoning", []):
            print(f"    - {reason}")

else:
    print("No evidence findings available.")


# ============================================================
# Overall Assessment
# ============================================================

overall = reasoning_result["overall"]

print("\n\nOverall Assessment")
print("-" * 75)

print("Overall Concern:", overall["overall_concern"])
print("Overall Confidence:", overall["overall_confidence"])
print("Finding Count:", overall["finding_count"])

print("Overall Reasoning:")
for reason in overall["reasoning"]:
    print(f"    - {reason}")


# ============================================================
# Complete
# ============================================================

print("\n" + "=" * 75)
print("REASONING ANALYSIS COMPLETE")
print("=" * 75)
