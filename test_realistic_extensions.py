from pathlib import Path
import json
import sys

from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence


ROOT = Path(__file__).resolve().parent
CORPUS_DIR = ROOT / "realistic_extensions"


def load_metadata(case_dir):
    metadata_file = case_dir / "metadata.json"

    with metadata_file.open("r", encoding="utf-8") as file:
        return json.load(file)


def run_case(case_dir):
    metadata = load_metadata(case_dir)

    javascript_file = case_dir / "background.js"

    if not javascript_file.exists():
        return {
            "id": metadata["id"],
            "name": metadata["name"],
            "expected": metadata["expected_findings"],
            "actual": None,
            "status": "ERROR",
            "error": "background.js not found",
            "findings": [],
        }

    try:
        # ---------------------------------------------------------
        # STEP 1 — AST ANALYSIS
        # ---------------------------------------------------------
        program_model = analyze_javascript_file(
            str(javascript_file)
        )

        # ---------------------------------------------------------
        # STEP 2 — DATA-FLOW ANALYSIS
        # ---------------------------------------------------------
        data_flow_result = analyze_data_flow(
            program_model
        )

        # ---------------------------------------------------------
        # STEP 3 — EVIDENCE ANALYSIS
        # ---------------------------------------------------------
        evidence_result = analyze_evidence(
            data_flow_result
        )

        # IMPORTANT:
        # The evidence engine stores security findings in
        # evidence_result["evidence"], NOT ["findings"].
        findings = evidence_result.get(
            "evidence",
            []
        )

        actual_findings = len(findings)

        expected_findings = metadata[
            "expected_findings"
        ]

        status = (
            "PASS"
            if actual_findings == expected_findings
            else "FAIL"
        )

        return {
            "id": metadata["id"],
            "name": metadata["name"],
            "expected": expected_findings,
            "actual": actual_findings,
            "status": status,
            "findings": findings,
            "error": None,
        }

    except Exception as error:

        return {
            "id": metadata["id"],
            "name": metadata["name"],
            "expected": metadata["expected_findings"],
            "actual": None,
            "status": "ERROR",
            "findings": [],
            "error": repr(error),
        }


def calculate_metrics(results):

    true_positive = 0
    true_negative = 0
    false_positive = 0
    false_negative = 0

    for result in results:

        if result["status"] == "ERROR":
            continue

        expected_positive = result["expected"] > 0
        actual_positive = result["actual"] > 0

        if expected_positive and actual_positive:
            true_positive += 1

        elif not expected_positive and not actual_positive:
            true_negative += 1

        elif not expected_positive and actual_positive:
            false_positive += 1

        elif expected_positive and not actual_positive:
            false_negative += 1

    total = (
        true_positive
        + true_negative
        + false_positive
        + false_negative
    )

    accuracy = (
        (true_positive + true_negative) / total
        if total
        else 0
    )

    precision = (
        true_positive
        / (true_positive + false_positive)
        if (true_positive + false_positive)
        else 0
    )

    recall = (
        true_positive
        / (true_positive + false_negative)
        if (true_positive + false_negative)
        else 0
    )

    f1 = (
        2 * precision * recall
        / (precision + recall)
        if (precision + recall)
        else 0
    )

    return {
        "true_positive": true_positive,
        "true_negative": true_negative,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "total": total,
    }


def print_case_result(result, number):

    status = result["status"]

    if status == "PASS":
        symbol = "PASS"

    elif status == "FAIL":
        symbol = "FAIL"

    else:
        symbol = "ERROR"

    print(
        f"{number:02d}. "
        f"{result['name']:<38} "
        f"Expected: {str(result['expected']):<3} "
        f"Actual: {str(result['actual']):<3} "
        f"[{symbol}]"
    )

    if result.get("error"):
        print(
            f"    Error: {result['error']}"
        )


def print_findings(result):

    findings = result.get(
        "findings",
        []
    )

    if not findings:
        return

    print()
    print("    Security Findings:")

    for index, finding in enumerate(
        findings,
        start=1
    ):

        if not isinstance(finding, dict):

            print(
                f"      Finding #{index}: "
                f"{finding}"
            )

            continue

        finding_type = finding.get(
            "type",
            finding.get(
                "finding_type",
                "unknown"
            )
        )

        source = finding.get(
            "source",
            finding.get(
                "sources",
                []
            )
        )

        source_type = finding.get(
            "source_type",
            finding.get(
                "source_types",
                []
            )
        )

        sink = finding.get(
            "sink",
            "unknown"
        )

        sink_line = finding.get(
            "sink_line",
            finding.get(
                "line",
                "unknown"
            )
        )

        destination = finding.get(
            "destination",
            finding.get(
                "url",
                "unknown"
            )
        )

        print(
            f"      Finding #{index}"
        )

        print(
            f"        Type: {finding_type}"
        )

        print(
            f"        Source: {source}"
        )

        print(
            f"        Source Type: {source_type}"
        )

        print(
            f"        Sink: {sink}"
        )

        print(
            f"        Sink Line: {sink_line}"
        )

        print(
            f"        Destination: {destination}"
        )


def main():

    print("=" * 90)
    print(
        "REALISTIC EXTENSION VALIDATION - V3"
    )
    print("=" * 90)

    print()
    print(
        f"Corpus: {CORPUS_DIR}"
    )

    print()

    if not CORPUS_DIR.exists():

        print(
            "ERROR: realistic_extensions "
            "folder was not found."
        )

        print()
        print(
            "Run:"
        )

        print(
            "    python create_realistic_corpus.py"
        )

        sys.exit(1)

    case_directories = sorted(
        path
        for path in CORPUS_DIR.iterdir()
        if path.is_dir()
    )

    if not case_directories:

        print(
            "ERROR: No test cases found."
        )

        sys.exit(1)

    print(
        f"Discovered test cases: "
        f"{len(case_directories)}"
    )

    print()

    results = []

    # -------------------------------------------------------------
    # RUN ALL CASES
    # -------------------------------------------------------------

    for number, case_dir in enumerate(
        case_directories,
        start=1
    ):

        result = run_case(
            case_dir
        )

        results.append(
            result
        )

        print_case_result(
            result,
            number
        )

        # Detailed findings are printed only
        # for failures and errors.
        if result["status"] in {
            "FAIL",
            "ERROR",
        }:

            print_findings(
                result
            )

    # -------------------------------------------------------------
    # METRICS
    # -------------------------------------------------------------

    metrics = calculate_metrics(
        results
    )

    passed = sum(
        1
        for result in results
        if result["status"] == "PASS"
    )

    failed = sum(
        1
        for result in results
        if result["status"] == "FAIL"
    )

    errors = sum(
        1
        for result in results
        if result["status"] == "ERROR"
    )

    total = len(results)

    pass_rate = (
        passed / total * 100
        if total
        else 0
    )

    # -------------------------------------------------------------
    # FINAL REPORT
    # -------------------------------------------------------------

    print()
    print("=" * 90)
    print(
        "V3 VALIDATION RESULTS"
    )
    print("=" * 90)

    print(
        f"Total test cases : {total}"
    )

    print(
        f"Passed           : {passed}"
    )

    print(
        f"Failed           : {failed}"
    )

    print(
        f"Errors           : {errors}"
    )

    print(
        f"Pass rate        : {pass_rate:.1f}%"
    )

    print()
    print(
        "Classification Metrics"
    )

    print(
        "-" * 90
    )

    print(
        f"True Positives   : "
        f"{metrics['true_positive']}"
    )

    print(
        f"True Negatives   : "
        f"{metrics['true_negative']}"
    )

    print(
        f"False Positives  : "
        f"{metrics['false_positive']}"
    )

    print(
        f"False Negatives  : "
        f"{metrics['false_negative']}"
    )

    print()

    print(
        f"Accuracy         : "
        f"{metrics['accuracy'] * 100:.2f}%"
    )

    print(
        f"Precision        : "
        f"{metrics['precision'] * 100:.2f}%"
    )

    print(
        f"Recall           : "
        f"{metrics['recall'] * 100:.2f}%"
    )

    print(
        f"F1 Score         : "
        f"{metrics['f1'] * 100:.2f}%"
    )

    # -------------------------------------------------------------
    # FAILED CASES
    # -------------------------------------------------------------

    failed_results = [
        result
        for result in results
        if result["status"]
        in {
            "FAIL",
            "ERROR",
        }
    ]

    if failed_results:

        print()
        print("=" * 90)
        print(
            "CASES REQUIRING INVESTIGATION"
        )
        print("=" * 90)

        for result in failed_results:

            print()

            print(
                f"Case: {result['id']}"
            )

            print(
                f"Name: {result['name']}"
            )

            print(
                f"Expected: "
                f"{result['expected']}"
            )

            print(
                f"Actual: "
                f"{result['actual']}"
            )

            if result.get("error"):

                print(
                    f"Error: "
                    f"{result['error']}"
                )

            print_findings(
                result
            )

    # -------------------------------------------------------------
    # FINAL STATUS
    # -------------------------------------------------------------

    print()
    print("=" * 90)

    if failed == 0 and errors == 0:

        print(
            "ALL V3 REALISTIC EXTENSION "
            "TESTS PASSED"
        )

    else:

        print(
            "V3 VALIDATION REQUIRES "
            "ANALYZER IMPROVEMENTS"
        )

    print("=" * 90)


if __name__ == "__main__":
    main()