from pathlib import Path
import sys
import time

from analyzer.manifest_analyzer import analyze_manifest
from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence


def print_separator(char="=", length=80):
    print(char * length)


def print_finding(index, finding):
    print(f"\nFinding {index}")
    print("-" * 70)

    print("Type:", finding.get("type"))
    print("Source:", finding.get("source"))
    print("Source Type:", finding.get("source_type"))
    print("Variable:", finding.get("variable"))
    print("Source Line:", finding.get("source_line"))
    print("Sink:", finding.get("sink"))
    print("Sink Line:", finding.get("sink_line"))
    print("Destination:", finding.get("destination"))
    print("Flow Type:", finding.get("flow_type"))
    print("Transformations:", finding.get("transformations"))

    if finding.get("callee"):
        print("Callee:", finding.get("callee"))

    if finding.get("argument_variable"):
        print("Argument Variable:", finding.get("argument_variable"))

    if finding.get("parameter_variable"):
        print("Parameter Variable:", finding.get("parameter_variable"))

    evidence_chain = finding.get("evidence_chain")

    if evidence_chain:
        print("\nEvidence Chain:")

        if isinstance(evidence_chain, list):
            for item in evidence_chain:
                print(f"  -> {item}")
        else:
            print(f"  -> {evidence_chain}")


def print_evidence(index, evidence):
    print(f"\nEvidence {index}")
    print("-" * 70)

    print("Behavior:")
    print(evidence.get("behavior"))

    print("\nSource:")
    print(evidence.get("source"))

    print("Source Type:")
    print(evidence.get("source_type"))

    print("Source Sensitivity:")
    print(evidence.get("source_sensitivity"))

    print("\nSink:")
    print(evidence.get("sink"))

    print("Sink Line:")
    print(evidence.get("sink_line"))

    print("Destination:")
    print(evidence.get("destination"))

    print("Destination Category:")
    print(evidence.get("destination_category"))

    print("Destination Host:")
    print(evidence.get("destination_hostname"))

    print("Static Confidence:")
    print(evidence.get("static_confidence"))

    print("\nExplanation:")
    print(evidence.get("explanation"))

    chain = evidence.get("evidence_chain")

    if chain:
        print("\nEvidence Chain:")

        for item in chain:
            print(f"  -> {item}")


def analyze_extension(extension_path):
    extension_path = Path(extension_path)

    if not extension_path.exists():
        print("ERROR: Extension path does not exist:")
        print(extension_path)
        return 1

    if not extension_path.is_dir():
        print("ERROR: Extension path is not a directory:")
        print(extension_path)
        return 1

    manifest_path = extension_path / "manifest.json"

    if not manifest_path.exists():
        print("ERROR: manifest.json was not found.")
        print(f"Expected: {manifest_path}")
        return 1

    print_separator()
    print("BROWSER EXTENSION STATIC ANALYZER")
    print_separator()

    print()
    print("Extension Path")
    print("-" * 70)
    print(extension_path.resolve())

    print()
    print_separator("-", 70)
    print("MANIFEST ANALYSIS")
    print_separator("-", 70)

    manifest_result = analyze_manifest(str(extension_path))

    if "error" in manifest_result:
        print(manifest_result["error"])
        return 1

    print()
    print("Name:", manifest_result.get("name"))
    print("Version:", manifest_result.get("version"))
    print("Manifest Version:", manifest_result.get("manifest_version"))

    permissions = manifest_result.get("permissions", [])
    host_permissions = manifest_result.get("host_permissions", [])

    print()
    print("Permissions:")

    for permission in permissions:
        print(f"  - {permission}")

    print()
    print("Host Permissions:")

    for permission in host_permissions:
        print(f"  - {permission}")

    print()
    print_separator("-", 70)
    print("JAVASCRIPT DISCOVERY")
    print_separator("-", 70)

    javascript_files = sorted(extension_path.rglob("*.js"))

    print()
    print("JavaScript files found:", len(javascript_files))

    for path in javascript_files:
        size_kb = path.stat().st_size / 1024

        print(
            f"  - {path.relative_to(extension_path)} "
            f"({size_kb:.1f} KB)"
        )

    print()
    print_separator("-", 70)
    print("AST + DATA-FLOW ANALYSIS")
    print_separator("-", 70)

    total_sources = 0
    total_sinks = 0
    total_variable_flows = 0
    total_findings = 0
    total_evidence = 0

    all_findings = []
    all_evidence = []

    analyzed_files = 0
    failed_files = 0

    for index, javascript_file in enumerate(javascript_files, 1):

        relative_path = javascript_file.relative_to(extension_path)
        file_size_kb = javascript_file.stat().st_size / 1024

        print()
        print("=" * 80)
        print(
            f"[{index}/{len(javascript_files)}] "
            f"{relative_path}"
        )
        print("=" * 80)

        print(f"File size: {file_size_kb:.1f} KB")

        try:
            total_start = time.perf_counter()

            source_code = javascript_file.read_text(
                encoding="utf-8",
                errors="ignore"
            )

            # ---------------------------------------------------------
            # AST ANALYSIS
            # ---------------------------------------------------------

            ast_start = time.perf_counter()

            program_model = analyze_javascript_file(
                str(javascript_file)
            )

            ast_time = time.perf_counter() - ast_start

            # ---------------------------------------------------------
            # DATA-FLOW ANALYSIS
            # ---------------------------------------------------------

            flow_start = time.perf_counter()

            data_flow_result = analyze_data_flow(
                program_model,
                source_code
            )

            flow_time = time.perf_counter() - flow_start

            # ---------------------------------------------------------
            # EVIDENCE ANALYSIS
            # ---------------------------------------------------------

            evidence_start = time.perf_counter()

            evidence_result = analyze_evidence(
                data_flow_result
            )

            evidence_time = time.perf_counter() - evidence_start

            total_time = time.perf_counter() - total_start

            # ---------------------------------------------------------
            # RESULTS
            # ---------------------------------------------------------

            sources = data_flow_result.get(
                "sources",
                []
            ) or []

            network_operations = data_flow_result.get(
                "network_operations",
                []
            ) or []

            variable_flows = data_flow_result.get(
                "variable_flows",
                []
            ) or []

            findings = data_flow_result.get(
                "findings",
                []
            ) or []

            evidence = evidence_result.get(
                "evidence",
                []
            ) or []

            total_sources += len(sources)
            total_sinks += len(network_operations)
            total_variable_flows += len(variable_flows)
            total_findings += len(findings)
            total_evidence += len(evidence)

            all_findings.extend(findings)
            all_evidence.extend(evidence)

            analyzed_files += 1

            # ---------------------------------------------------------
            # TIMING REPORT
            # ---------------------------------------------------------

            print()
            print("ANALYSIS TIMING")
            print("-" * 70)

            print(
                f"AST analysis:          {ast_time:.3f} seconds"
            )

            print(
                f"Data-flow analysis:    {flow_time:.3f} seconds"
            )

            print(
                f"Evidence analysis:     {evidence_time:.3f} seconds"
            )

            print(
                f"TOTAL:                 {total_time:.3f} seconds"
            )

            print()
            print("ANALYSIS COUNTS")
            print("-" * 70)

            print(
                f"Sources:               {len(sources)}"
            )

            print(
                f"Network sinks:         {len(network_operations)}"
            )

            print(
                f"Variable flows:        {len(variable_flows)}"
            )

            print(
                f"Data-flow findings:    {len(findings)}"
            )

            print(
                f"Evidence findings:     {len(evidence)}"
            )

        except KeyboardInterrupt:
            print()
            print("Analysis interrupted by user.")
            return 130

        except Exception as exc:

            failed_files += 1

            print()
            print("ERROR:")
            print(
                f"{type(exc).__name__}: {exc}"
            )

    # -------------------------------------------------------------
    # DATA-FLOW FINDINGS
    # -------------------------------------------------------------

    print()
    print_separator("-", 70)
    print("DATA-FLOW FINDINGS")
    print_separator("-", 70)

    if not all_findings:

        print()
        print("No sensitive source-to-network flows detected.")

    else:

        for index, finding in enumerate(
            all_findings,
            1
        ):
            print_finding(
                index,
                finding
            )

    # -------------------------------------------------------------
    # EVIDENCE ANALYSIS
    # -------------------------------------------------------------

    print()
    print_separator("-", 70)
    print("EVIDENCE ANALYSIS")
    print_separator("-", 70)

    if not all_evidence:

        print()
        print("No correlated evidence findings.")

    else:

        for index, evidence in enumerate(
            all_evidence,
            1
        ):
            print_evidence(
                index,
                evidence
            )

    # -------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------

    print()
    print_separator()
    print("STATIC ANALYSIS SUMMARY")
    print_separator()

    print()
    print("Extension:")
    print(manifest_result.get("name"))

    print(
        "Version:",
        manifest_result.get("version")
    )

    print()
    print(
        "JavaScript files discovered:",
        len(javascript_files)
    )

    print(
        "JavaScript files analyzed:",
        analyzed_files
    )

    print(
        "JavaScript files failed:",
        failed_files
    )

    print()
    print(
        "Security Sources:",
        total_sources
    )

    print(
        "Network Sinks:",
        total_sinks
    )

    print(
        "Variable Flows:",
        total_variable_flows
    )

    print(
        "Data-Flow Findings:",
        total_findings
    )

    print(
        "Evidence Findings:",
        total_evidence
    )

    print()

    if total_findings:
        print(
            "Sensitive Data Flow:",
            "DETECTED"
        )
    else:
        print(
            "Sensitive Data Flow:",
            "NOT DETECTED"
        )

    if total_evidence:
        print(
            "Correlated Security Evidence:",
            "DETECTED"
        )
    else:
        print(
            "Correlated Security Evidence:",
            "NOT DETECTED"
        )

    print()
    print_separator()
    print("ANALYSIS COMPLETE")
    print_separator()

    return 0


def main():

    if len(sys.argv) != 2:

        print()
        print("Usage:")
        print()
        print(
            "  python main.py <extension_folder>"
        )

        print()
        print("Example:")
        print(
            "  python main.py .\\Real_VPN_Extension"
        )

        print()

        return 1

    return analyze_extension(
        sys.argv[1]
    )


if __name__ == "__main__":
    sys.exit(main())