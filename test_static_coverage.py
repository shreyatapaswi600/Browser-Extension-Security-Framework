from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence


EXTENSION_FOLDER = "Static_Test_Extension"
BACKGROUND_FILE = f"{EXTENSION_FOLDER}/background.js"


print("=" * 70)
print("STATIC ANALYZER COVERAGE TEST")
print("=" * 70)


# ============================================================
# STEP 1 — AST ANALYSIS
# ============================================================

print("\n[1] Running AST analysis...\n")

program_model = analyze_javascript_file(
    BACKGROUND_FILE
)

print(
    f"File: {program_model.file}"
)

print(
    f"Syntax Error: {program_model.syntax_error}"
)

print(
    f"Functions: "
    f"{len(program_model.function_definitions)}"
)

print(
    f"Function Calls: "
    f"{len(program_model.function_calls)}"
)

print(
    f"Variable Assignments: "
    f"{len(program_model.variable_assignments)}"
)


# ============================================================
# STEP 2 — DATA-FLOW ANALYSIS
# ============================================================

print("\n")
print("=" * 70)
print("DATA-FLOW ANALYSIS")
print("=" * 70)

print("\n[2] Running data-flow analysis...\n")

result = analyze_data_flow(
    program_model
)


# ============================================================
# SECURITY SOURCES
# ============================================================

print("=" * 70)
print("SECURITY SOURCES")
print("=" * 70)

sources = result.get(
    "sources",
    []
)

if not sources:

    print(
        "No security-relevant sources detected."
    )

else:

    for source in sources:

        print(
            f"Line {source.get('line')}: "
            f"{source.get('source')}"
        )

        print(
            f"    Type: "
            f"{source.get('source_type')}"
        )

        print(
            f"    Variable: "
            f"{source.get('variable')}"
        )

        print()


# ============================================================
# NETWORK OPERATIONS
# ============================================================

print("=" * 70)
print("NETWORK OPERATIONS")
print("=" * 70)

network_operations = result.get(
    "network_operations",
    []
)

if not network_operations:

    print(
        "No network operations detected."
    )

else:

    for operation in network_operations:

        print(
            f"Line {operation.get('line')}: "
            f"{operation.get('sink')}"
        )

        print(
            f"    Destination: "
            f"{operation.get('destination')}"
        )

        print(
            f"    Arguments: "
            f"{operation.get('arguments')}"
        )

        print()


# ============================================================
# VARIABLE FLOWS
# ============================================================

print("=" * 70)
print("VARIABLE DATA FLOW")
print("=" * 70)

variable_flows = result.get(
    "variable_flows",
    []
)

if not variable_flows:

    print(
        "No variable flows detected."
    )

else:

    for flow in variable_flows:

        print(
            f"{flow.get('from')} "
            f"--> "
            f"{flow.get('to')}"
        )

        print(
            f"    Type: "
            f"{flow.get('type')}"
        )

        print(
            f"    Line: "
            f"{flow.get('line')}"
        )


# ============================================================
# INTERPROCEDURAL FLOWS
# ============================================================

print("=" * 70)
print("INTERPROCEDURAL DATA FLOW")
print("=" * 70)

interprocedural_flows = result.get(
    "interprocedural_flows",
    []
)

if not interprocedural_flows:

    print(
        "No interprocedural flows detected."
    )

else:

    for flow in interprocedural_flows:

        print(
            f"{flow.get('from')} "
            f"--> "
            f"{flow.get('to')}"
        )

        print(
            f"    Type: "
            f"{flow.get('type')}"
        )

        print(
            f"    Function: "
            f"{flow.get('function')}"
        )

        print(
            f"    Call Line: "
            f"{flow.get('call_line')}"
        )


# ============================================================
# TRANSFORMATIONS
# ============================================================

print("=" * 70)
print("TRANSFORMATIONS")
print("=" * 70)

transformations = result.get(
    "transformations",
    []
)

if not transformations:

    print(
        "No transformations detected."
    )

else:

    for transformation in transformations:

        print(
            f"Line {transformation.get('line')}: "
            f"{transformation.get('function')}"
        )

        print(
            f"    Type: "
            f"{transformation.get('type')}"
        )

        print(
            f"    Expression: "
            f"{transformation.get('expression')}"
        )


# ============================================================
# DATA-FLOW FINDINGS
# ============================================================

print("=" * 70)
print("DATA-FLOW FINDINGS")
print("=" * 70)

findings = result.get(
    "findings",
    []
)

if not findings:

    print(
        "No source-to-sink data-flow findings detected."
    )

else:

    for index, finding in enumerate(
        findings,
        start=1
    ):

        print(
            f"\nFinding #{index}"
        )

        print(
            f"Type: "
            f"{finding.get('type')}"
        )

        print(
            f"Source: "
            f"{finding.get('source')}"
        )

        print(
            f"Source Type: "
            f"{finding.get('source_type')}"
        )

        print(
            f"Source Line: "
            f"{finding.get('source_line')}"
        )

        print(
            f"Sink: "
            f"{finding.get('sink')}"
        )

        print(
            f"Sink Line: "
            f"{finding.get('sink_line')}"
        )

        print(
            f"Destination: "
            f"{finding.get('destination')}"
        )

        print(
            f"Flow Type: "
            f"{finding.get('flow_type')}"
        )

        print(
            f"Evidence Chain: "
            f"{finding.get('evidence_chain')}"
        )


# ============================================================
# STEP 3 — EVIDENCE ENGINE
# ============================================================

print("\n")
print("=" * 70)
print("EVIDENCE ENGINE")
print("=" * 70)

print("\n[3] Running evidence analysis...\n")

evidence = analyze_evidence(
    result
)


summary = evidence.get(
    "summary",
    {}
)


print(
    f"Evidence Count: "
    f"{summary.get('evidence_count')}"
)

print(
    f"Sensitive Data Flow: "
    f"{summary.get('sensitive_data_flow_detected')}"
)

print(
    f"Sources Observed: "
    f"{summary.get('sources_observed')}"
)

print(
    f"Network Sinks Observed: "
    f"{summary.get('network_sinks_observed')}"
)

print(
    f"Highest Source Sensitivity: "
    f"{summary.get('highest_source_sensitivity')}"
)

print(
    f"Static Confidence: "
    f"{summary.get('static_confidence')}"
)


# ============================================================
# DETAILED EVIDENCE
# ============================================================

print("\n")
print("=" * 70)
print("DETAILED EVIDENCE")
print("=" * 70)

evidence_items = evidence.get(
    "evidence",
    []
)

if not evidence_items:

    print(
        "\nNo sensitive-data transmission evidence detected."
    )

else:

    for index, item in enumerate(
        evidence_items,
        start=1
    ):

        print(
            f"\nEvidence #{index}"
        )

        print(
            f"Type: "
            f"{item.get('type')}"
        )

        print(
            f"Source: "
            f"{item.get('source')}"
        )

        print(
            f"Sensitivity: "
            f"{item.get('source_sensitivity')}"
        )

        print(
            f"Variables: "
            f"{item.get('variables')}"
        )

        print(
            f"Sink: "
            f"{item.get('sink')}"
        )

        print(
            f"Destination: "
            f"{item.get('destination')}"
        )

        print(
            f"Destination Category: "
            f"{item.get('destination_category')}"
        )

        print(
            f"Confidence: "
            f"{item.get('static_confidence')}"
        )

        print(
            f"Evidence Chain: "
            f"{item.get('evidence_chain')}"
        )

        print(
            f"Explanation: "
            f"{item.get('explanation')}"
        )


# ============================================================
# COMPLETE
# ============================================================

print("\n")
print("=" * 70)
print("STATIC COVERAGE TEST COMPLETE")
print("=" * 70)