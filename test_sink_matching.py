from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import _find_sink


BACKGROUND_FILE = "Static_Test_Extension/background.js"


program_model = analyze_javascript_file(BACKGROUND_FILE)

result = analyze_data_flow(program_model)

sinks = result.get("network_operations", [])
findings = result.get("findings", [])


print("=" * 70)
print("SINK MATCHING DIAGNOSTIC")
print("=" * 70)

print()

for index, finding in enumerate(findings, start=1):

    matched = _find_sink(
        finding,
        sinks,
    )

    print(
        f"Finding #{index}: "
        f"{finding.get('sink')} "
        f"line {finding.get('sink_line')}"
    )

    if matched:

        print(
            f"  MATCHED: "
            f"{matched.get('sink')} "
            f"line {matched.get('line')}"
        )

        print(
            f"  Destination: "
            f"{matched.get('destination')}"
        )

    else:

        print("  MATCHED: NONE")

    print()