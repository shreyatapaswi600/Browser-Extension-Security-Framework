from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow


# ============================================================
# Test File
# ============================================================

file_path = "Sample_Extension_v5/background.js"


# ============================================================
# AST Analysis
# ============================================================

model = analyze_javascript_file(
    file_path
)


# ============================================================
# Data-Flow Analysis
# ============================================================

result = analyze_data_flow(
    model
)


# ============================================================
# Header
# ============================================================

print("=" * 60)
print("DATA FLOW ANALYSIS")
print("=" * 60)


# ============================================================
# Security-Relevant Sources
# ============================================================

print("\nSecurity-Relevant Sources")
print("-" * 60)


if not result["sources"]:

    print("None")

else:

    for source in result["sources"]:

        print(
            f"Line {source['line']} "
            f"{source['source']}"
        )

        print(
            f"  Type: "
            f"{source['source_type']}"
        )

        print(
            f"  Variable: "
            f"{source['variable']}"
        )


# ============================================================
# Direct Variable Data Flow
# ============================================================

print("\nVariable Data Flow")
print("-" * 60)


if not result["variable_flows"]:

    print("None")

else:

    for flow in result["variable_flows"]:

        print(
            f"{flow['from']} "
            f"--> "
            f"{flow['to']} "
            f"({flow['type']}) "
            f"Line {flow['line']}"
        )


# ============================================================
# Interprocedural Data Flow
# ============================================================

print("\nInterprocedural Data Flow")
print("-" * 60)


if not result["interprocedural_flows"]:

    print("None")

else:

    for flow in result[
        "interprocedural_flows"
    ]:

        print(
            f"{flow['from']} "
            f"--> "
            f"{flow['to']}"
        )

        print(
            f"  Type: "
            f"{flow['type']}"
        )

        print(
            f"  Function: "
            f"{flow['callee']}"
        )

        print(
            f"  Call Line: "
            f"{flow['line']}"
        )


# ============================================================
# Transformations
# ============================================================

print("\nTransformations")
print("-" * 60)


if not result["transformations"]:

    print("None")

else:

    for transformation in result[
        "transformations"
    ]:

        print(
            f"Line "
            f"{transformation['line']} "
            f"{transformation['name']} "
            f"({transformation['type']})"
        )


# ============================================================
# Network Operations
# ============================================================

print("\nNetwork Operations")
print("-" * 60)


if not result["network_operations"]:

    print("None")

else:

    for operation in result[
        "network_operations"
    ]:

        print(
            f"Line "
            f"{operation['line']} "
            f"{operation['sink']}"
        )

        print(
            f"  Destination: "
            f"{operation['destination']}"
        )


# ============================================================
# Security Findings
# ============================================================

print("\nSecurity Findings")
print("-" * 60)


if not result["findings"]:

    print(
        "No correlated sensitive "
        "data flow."
    )

else:

    for index, finding in enumerate(
        result["findings"],
        start=1
    ):

        print(
            f"\nFinding #{index}"
        )

        print(
            f"Type: "
            f"{finding['type']}"
        )

        print(
            f"Flow Type: "
            f"{finding['flow_type']}"
        )

        print(
            f"Source: "
            f"{finding['source']}"
        )

        print(
            f"Source Type: "
            f"{finding['source_type']}"
        )

        print(
            f"Source Line: "
            f"{finding['source_line']}"
        )

        print(
            f"Sink: "
            f"{finding['sink']}"
        )

        print(
            f"Sink Line: "
            f"{finding['sink_line']}"
        )

        print(
            f"Destination: "
            f"{finding['destination']}"
        )

        if finding.get(
            "argument_variable"
        ):

            print(
                f"Argument Variable: "
                f"{finding['argument_variable']}"
            )

        if finding.get(
            "parameter_variable"
        ):

            print(
                f"Parameter Variable: "
                f"{finding['parameter_variable']}"
            )

        if finding.get(
            "callee"
        ):

            print(
                f"Callee: "
                f"{finding['callee']}"
            )

        if finding.get(
            "call_line"
        ):

            print(
                f"Function Call Line: "
                f"{finding['call_line']}"
            )

        if finding.get(
            "evidence_chain"
        ):

            print(
                f"Evidence Chain: "
                f"{finding['evidence_chain']}"
            )


# ============================================================
# Interprocedural Functions
# ============================================================

print("\nInterprocedural Functions")
print("-" * 60)


if not result[
    "interprocedural_functions"
]:

    print("None")

else:

    for name, function in result[
        "interprocedural_functions"
    ].items():

        print(
            f"{name}"
        )

        print(
            f"  Parameters: "
            f"{function['parameters']}"
        )

        print(
            f"  Start Line: "
            f"{function['line']}"
        )

        print(
            f"  End Line: "
            f"{function['end_line']}"
        )


# ============================================================
# Final Status
# ============================================================

print("\nSensitive Data Flow")
print("-" * 60)

print(
    result["sensitive_data_flow"]
)


print("\n" + "=" * 60)
print("DATA FLOW ANALYSIS COMPLETE")
print("=" * 60)