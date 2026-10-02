# ============================================================
# Manifest ↔ Code Behavior Context Analyzer
# ============================================================
#
# Purpose:
#
# Combine:
#   1. Manifest permissions
#   2. Host permissions
#   3. Observed APIs
#   4. Network destinations
#   5. Sensitive sources
#   6. Data-flow findings
#   7. Data transformations
#   8. Evidence confidence
#   9. Reasoning assessment
#
# into one structured, explainable context assessment.
#
# This module does NOT declare that an extension is malware.
# It describes relationships between declared capabilities
# and observed behavior.
#
# ============================================================

import json
import os

from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence
from analyzer.reasoning_engine import reason_about_evidence


# ============================================================
# Manifest Capability Mapping
# ============================================================

PERMISSION_CAPABILITIES = {

    "cookies": {
        "patterns": [
            "chrome.cookies",
            "browser.cookies",
            "document.cookie"
        ],
        "description": "Cookie access"
    },

    "tabs": {
        "patterns": [
            "chrome.tabs",
            "browser.tabs"
        ],
        "description": "Browser tab access"
    },

    "storage": {
        "patterns": [
            "chrome.storage",
            "browser.storage",
            "localStorage",
            "sessionStorage"
        ],
        "description": "Browser storage access"
    },

    "webRequest": {
        "patterns": [
            "chrome.webRequest",
            "browser.webRequest"
        ],
        "description": "Web request observation or modification"
    },

    "scripting": {
        "patterns": [
            "chrome.scripting",
            "browser.scripting"
        ],
        "description": "Script injection or execution capability"
    },

    "downloads": {
        "patterns": [
            "chrome.downloads",
            "browser.downloads"
        ],
        "description": "Download management"
    },

    "notifications": {
        "patterns": [
            "chrome.notifications",
            "browser.notifications"
        ],
        "description": "Browser notification capability"
    },

    "identity": {
        "patterns": [
            "chrome.identity",
            "browser.identity"
        ],
        "description": "Browser identity or authentication capability"
    }
}


# ============================================================
# Manifest Loader
# ============================================================

def load_manifest(manifest_path):

    with open(
        manifest_path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# ============================================================
# JavaScript File Collection
# ============================================================

def collect_javascript_files(extension_folder):

    javascript_files = []

    for root, _, files in os.walk(extension_folder):

        for filename in files:

            if filename.endswith(".js"):

                javascript_files.append(
                    os.path.join(root, filename)
                )

    return sorted(javascript_files)


# ============================================================
# Manifest Permission Extraction
# ============================================================

def get_declared_permissions(manifest):

    return {
        "permissions": manifest.get(
            "permissions",
            []
        ),

        "host_permissions": manifest.get(
            "host_permissions",
            []
        )
    }


# ============================================================
# Collect Observed API Expressions
# ============================================================

def collect_code_expressions(program_models):

    expressions = []

    for model in program_models:

        # ----------------------------------------------------
        # Member/API access
        # ----------------------------------------------------

        for access in model.member_access:

            expressions.append({
                "expression": access.expression,
                "file": access.file,
                "line": access.line,
                "type": "member_access"
            })

        # ----------------------------------------------------
        # Function calls
        # ----------------------------------------------------

        for call in model.function_calls:

            expressions.append({
                "expression": call.name,
                "file": call.file,
                "line": call.line,
                "type": "function_call"
            })

        # ----------------------------------------------------
        # Variable assignments
        # ----------------------------------------------------

        for assignment in model.variable_assignments:

            expressions.append({
                "expression": assignment.value,
                "file": assignment.file,
                "line": assignment.line,
                "type": "assignment"
            })

    return expressions


# ============================================================
# Permission ↔ Code Alignment
# ============================================================

def analyze_permission_alignment(
    manifest,
    program_models
):

    declared_permissions = manifest.get(
        "permissions",
        []
    )

    expressions = collect_code_expressions(
        program_models
    )

    results = []

    for permission in declared_permissions:

        capability = PERMISSION_CAPABILITIES.get(
            permission
        )

        # ----------------------------------------------------
        # Permission does not yet have a known mapping
        # ----------------------------------------------------

        if not capability:

            results.append({
                "permission": permission,
                "status": "unmapped",
                "description":
                    "Permission has no built-in code mapping yet.",
                "observed_patterns": []
            })

            continue

        observed_patterns = []

        # ----------------------------------------------------
        # Search observed program expressions
        # ----------------------------------------------------

        for expression_data in expressions:

            expression = str(
                expression_data["expression"]
            )

            for pattern in capability["patterns"]:

                if (
                    expression == pattern
                    or pattern in expression
                ):

                    if pattern not in observed_patterns:

                        observed_patterns.append(
                            pattern
                        )

        if observed_patterns:

            status = "aligned"

        else:

            status = "declared_not_observed"

        results.append({
            "permission": permission,
            "status": status,
            "description": capability["description"],
            "observed_patterns": observed_patterns
        })

    return results


# ============================================================
# Host Permission Analysis
# ============================================================

def analyze_host_permissions(
    manifest,
    program_models
):

    host_permissions = manifest.get(
        "host_permissions",
        []
    )

    observed_urls = []

    # --------------------------------------------------------
    # Collect URLs from all JavaScript files
    # --------------------------------------------------------

    for model in program_models:

        for url in model.urls:

            if url not in observed_urls:

                observed_urls.append(url)

    results = []

    # --------------------------------------------------------
    # Analyze every declared host permission
    # --------------------------------------------------------

    for host_permission in host_permissions:

        matching_urls = []

        # ----------------------------------------------------
        # <all_urls> is intentionally treated as broad scope
        # ----------------------------------------------------

        if host_permission == "<all_urls>":

            matching_urls = list(
                observed_urls
            )

        else:

            host_text = host_permission

            host_text = host_text.replace(
                "*://",
                ""
            )

            host_text = host_text.replace(
                "http://",
                ""
            )

            host_text = host_text.replace(
                "https://",
                ""
            )

            host_text = host_text.replace(
                "/*",
                ""
            )

            for url in observed_urls:

                if host_text in url:

                    matching_urls.append(
                        url
                    )

        if matching_urls:

            status = "observed"

        else:

            status = "declared_not_observed"

        results.append({
            "host_permission": host_permission,
            "status": status,
            "observed_urls": matching_urls
        })

    return results


# ============================================================
# Observed APIs
# ============================================================

def collect_observed_apis(program_models):

    observed_apis = []

    for model in program_models:

        # ----------------------------------------------------
        # Function calls
        # ----------------------------------------------------

        for call in model.function_calls:

            name = call.name

            if name and name not in observed_apis:

                observed_apis.append(name)

        # ----------------------------------------------------
        # Member access
        # ----------------------------------------------------

        for access in model.member_access:

            expression = access.expression

            if (
                expression
                and expression not in observed_apis
            ):

                observed_apis.append(
                    expression
                )

    return sorted(observed_apis)


# ============================================================
# Observed Network Operations
# ============================================================

def collect_network_operations(
    data_flow_results
):

    operations = []

    for result in data_flow_results:

        for sink in result.get(
            "network_sinks",
            []
        ):

            name = sink.get("sink")

            if (
                name
                and name not in operations
            ):

                operations.append(name)

    return sorted(operations)


# ============================================================
# Network Destinations
# ============================================================

def collect_network_destinations(
    data_flow_results
):

    destinations = []

    for result in data_flow_results:

        for sink in result.get(
            "network_sinks",
            []
        ):

            destination = sink.get(
                "destination"
            )

            if (
                destination
                and destination not in destinations
            ):

                destinations.append(
                    destination
                )

    return sorted(destinations)


# ============================================================
# Sensitive Sources
# ============================================================

def collect_sensitive_sources(
    data_flow_results
):

    sources = []

    for result in data_flow_results:

        for source in result.get(
            "sources",
            []
        ):

            source_name = source.get(
                "source"
            )

            if (
                source_name
                and source_name not in sources
            ):

                sources.append(
                    source_name
                )

    return sorted(sources)


# ============================================================
# Transformations
# ============================================================

def collect_transformations(
    data_flow_results
):

    transformations = []

    for result in data_flow_results:

        for transformation in result.get(
            "transformations",
            []
        ):

            function_name = transformation.get(
                "function"
            )

            if (
                function_name
                and function_name not in transformations
            ):

                transformations.append(
                    function_name
                )

    return sorted(transformations)


# ============================================================
# Sensitive Data Flow
# ============================================================

def collect_data_flow_findings(
    evidence_result
):

    findings = []

    for evidence in evidence_result.get(
        "evidence",
        []
    ):

        findings.append({

            "type":
                evidence.get(
                    "finding_type"
                ),

            "source":
                evidence.get(
                    "source"
                ),

            "variables":
                evidence.get(
                    "variables_involved"
                ),

            "sink":
                evidence.get(
                    "sink"
                ),

            "destination":
                evidence.get(
                    "destination"
                ),

            "confidence":
                evidence.get(
                    "static_confidence"
                )
        })

    return findings


# ============================================================
# Host Scope Interpretation
# ============================================================

def evaluate_host_scope(
    context_result,
    destinations
):

    host_permissions = context_result.get(
        "declared_host_permissions",
        []
    )

    # --------------------------------------------------------
    # No network activity
    # --------------------------------------------------------

    if not destinations:

        return {
            "status": "no_network_destination",
            "reason":
                "No network destination was observed in the analyzed code."
        }

    # --------------------------------------------------------
    # Network activity without host permissions
    # --------------------------------------------------------

    if not host_permissions:

        return {
            "status":
                "destination_without_declared_host_scope",

            "reason":
                "Network destinations were observed, but no host "
                "permissions were declared."
        }

    # --------------------------------------------------------
    # Broad host permission
    # --------------------------------------------------------

    if "<all_urls>" in host_permissions:

        return {
            "status":
                "within_broad_declared_scope",

            "reason":
                "Observed destinations fall within the broad host "
                "scope declared by <all_urls>."
        }

    # --------------------------------------------------------
    # Exact host comparison
    # --------------------------------------------------------

    host_matches = []

    for host_permission in host_permissions:

        normalized_permission = (
            host_permission
            .replace("*://", "")
            .replace("https://", "")
            .replace("http://", "")
            .replace("/*", "")
        )

        for destination in destinations:

            if normalized_permission in destination:

                host_matches.append(
                    destination
                )

    if host_matches:

        return {
            "status":
                "within_declared_host_scope",

            "reason":
                "Observed network destinations match at least "
                "one declared host permission.",

            "matching_destinations":
                sorted(set(host_matches))
        }

    return {
        "status":
            "destination_outside_observed_host_scope",

        "reason":
            "Observed network destinations could not be matched "
            "to the declared host permissions.",

        "matching_destinations": []
    }


# ============================================================
# Permission Context Summary
# ============================================================

def summarize_permission_context(
    permission_results
):

    aligned = []
    not_observed = []
    unmapped = []

    for result in permission_results:

        status = result.get(
            "status"
        )

        permission = result.get(
            "permission"
        )

        if status == "aligned":

            aligned.append(permission)

        elif status == "declared_not_observed":

            not_observed.append(permission)

        elif status == "unmapped":

            unmapped.append(permission)

    return {
        "aligned": sorted(aligned),
        "declared_not_observed":
            sorted(not_observed),
        "unmapped":
            sorted(unmapped)
    }


# ============================================================
# Build Contextual Observations
# ============================================================

def build_contextual_observations(
    context_result,
    data_flow_results,
    evidence_result,
    reasoning_result
):

    observations = []

    permission_context = summarize_permission_context(
        context_result["permission_analysis"]
    )

    sources = collect_sensitive_sources(
        data_flow_results
    )

    transformations = collect_transformations(
        data_flow_results
    )

    operations = collect_network_operations(
        data_flow_results
    )

    destinations = collect_network_destinations(
        data_flow_results
    )

    # --------------------------------------------------------
    # Permission observations
    # --------------------------------------------------------

    if permission_context["aligned"]:

        observations.append(
            "Declared permissions with corresponding "
            "observed code usage: "
            + ", ".join(
                permission_context["aligned"]
            )
        )

    if permission_context["declared_not_observed"]:

        observations.append(
            "Declared permissions not observed in the "
            "analyzed JavaScript: "
            + ", ".join(
                permission_context[
                    "declared_not_observed"
                ]
            )
        )

    if permission_context["unmapped"]:

        observations.append(
            "Permissions without a current built-in "
            "code mapping: "
            + ", ".join(
                permission_context["unmapped"]
            )
        )

    # --------------------------------------------------------
    # Sensitive sources
    # --------------------------------------------------------

    if sources:

        observations.append(
            "Security-relevant data sources observed: "
            + ", ".join(sources)
        )

    else:

        observations.append(
            "No currently recognized security-relevant "
            "data sources were observed."
        )

    # --------------------------------------------------------
    # Transformations
    # --------------------------------------------------------

    if transformations:

        observations.append(
            "Data transformations observed: "
            + ", ".join(transformations)
        )

    # --------------------------------------------------------
    # Network behavior
    # --------------------------------------------------------

    if operations:

        observations.append(
            "Network operations observed: "
            + ", ".join(operations)
        )

    if destinations:

        observations.append(
            "Network destinations observed: "
            + ", ".join(destinations)
        )

    # --------------------------------------------------------
    # Evidence
    # --------------------------------------------------------

    evidence_summary = evidence_result.get(
        "summary",
        {}
    )

    if evidence_summary.get(
        "sensitive_data_flow_detected"
    ):

        observations.append(
            "Static analysis established a correlated "
            "sensitive-data flow."
        )

    else:

        observations.append(
            "Static analysis did not establish a correlated "
            "sensitive-data flow."
        )

    # --------------------------------------------------------
    # Reasoning
    # --------------------------------------------------------

    overall = reasoning_result.get(
        "overall",
        {}
    )

    if overall:

        observations.append(
            "Reasoning engine concern level: "
            + overall.get(
                "overall_concern",
                "UNKNOWN"
            )
        )

        observations.append(
            "Reasoning engine confidence: "
            + overall.get(
                "overall_confidence",
                "UNKNOWN"
            )
        )

    return observations


# ============================================================
# Main Behavior Context Analyzer
# ============================================================

def analyze_context(
    extension_folder
):

    # --------------------------------------------------------
    # Locate manifest
    # --------------------------------------------------------

    manifest_path = os.path.join(
        extension_folder,
        "manifest.json"
    )

    if not os.path.exists(
        manifest_path
    ):

        return {
            "error":
                "manifest.json was not found."
        }

    # --------------------------------------------------------
    # Load manifest
    # --------------------------------------------------------

    try:

        manifest = load_manifest(
            manifest_path
        )

    except json.JSONDecodeError as error:

        return {
            "error":
                f"Invalid manifest.json: {error}"
        }

    # --------------------------------------------------------
    # Collect JavaScript files
    # --------------------------------------------------------

    javascript_files = collect_javascript_files(
        extension_folder
    )

    if not javascript_files:

        return {
            "error":
                "No JavaScript files were found."
        }

    # --------------------------------------------------------
    # Build AST program models
    # --------------------------------------------------------

    program_models = []

    for filepath in javascript_files:

        model = analyze_javascript_file(
            filepath
        )

        program_models.append(
            model
        )

    # --------------------------------------------------------
    # Manifest permission analysis
    # --------------------------------------------------------

    permission_results = analyze_permission_alignment(
        manifest,
        program_models
    )

    # --------------------------------------------------------
    # Host permission analysis
    # --------------------------------------------------------

    host_results = analyze_host_permissions(
        manifest,
        program_models
    )

    # --------------------------------------------------------
    # Data-flow analysis for every JS file
    # --------------------------------------------------------

    data_flow_results = []

    for filepath in javascript_files:

        result = analyze_data_flow(
            filepath
        )

        data_flow_results.append(
            result
        )

    # --------------------------------------------------------
    # Combine data-flow information
    # --------------------------------------------------------

    combined_data_flow = {

        "file":
            extension_folder,

        "syntax_error":
            any(
                result.get(
                    "syntax_error",
                    False
                )
                for result in data_flow_results
            ),

        "sources": [
            source
            for result in data_flow_results
            for source in result.get(
                "sources",
                []
            )
        ],

        "variable_flows": [
            flow
            for result in data_flow_results
            for flow in result.get(
                "variable_flows",
                []
            )
        ],

        "transformations": [
            transformation
            for result in data_flow_results
            for transformation in result.get(
                "transformations",
                []
            )
        ],

        "network_sinks": [
            sink
            for result in data_flow_results
            for sink in result.get(
                "network_sinks",
                []
            )
        ],

        "evidence": [
            evidence
            for result in data_flow_results
            for evidence in result.get(
                "evidence",
                []
            )
        ]
    }

    # --------------------------------------------------------
    # Evidence analysis
    # --------------------------------------------------------

    evidence_result = analyze_evidence(
        combined_data_flow
    )

    # --------------------------------------------------------
    # Reasoning analysis
    # --------------------------------------------------------

    reasoning_result = reason_about_evidence(
        evidence_result
    )

    # --------------------------------------------------------
    # Observed APIs
    # --------------------------------------------------------

    observed_apis = collect_observed_apis(
        program_models
    )

    # --------------------------------------------------------
    # Network destinations
    # --------------------------------------------------------

    network_destinations = collect_network_destinations(
        data_flow_results
    )

    # --------------------------------------------------------
    # Host scope
    # --------------------------------------------------------

    host_scope = evaluate_host_scope(
        {
            "declared_host_permissions":
                manifest.get(
                    "host_permissions",
                    []
                )
        },
        network_destinations
    )

    # --------------------------------------------------------
    # Permission context
    # --------------------------------------------------------

    permission_context = summarize_permission_context(
        permission_results
    )

    # --------------------------------------------------------
    # Contextual observations
    # --------------------------------------------------------

    observations = build_contextual_observations(
        {
            "permission_analysis":
                permission_results
        },
        data_flow_results,
        evidence_result,
        reasoning_result
    )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    return {

        "manifest": {

            "name":
                manifest.get(
                    "name"
                ),

            "version":
                manifest.get(
                    "version"
                ),

            "manifest_version":
                manifest.get(
                    "manifest_version"
                )
        },

        "declared_permissions":
            manifest.get(
                "permissions",
                []
            ),

        "declared_host_permissions":
            manifest.get(
                "host_permissions",
                []
            ),

        "javascript_files":
            javascript_files,

        # ----------------------------------------------------
        # Manifest ↔ Code context
        # ----------------------------------------------------

        "permission_analysis":
            permission_results,

        "host_analysis":
            host_results,

        "permission_context":
            permission_context,

        "host_scope":
            host_scope,

        # ----------------------------------------------------
        # Observed behavior
        # ----------------------------------------------------

        "observed_behavior": {

            "apis":
                observed_apis,

            "sources":
                collect_sensitive_sources(
                    data_flow_results
                ),

            "transformations":
                collect_transformations(
                    data_flow_results
                ),

            "network_operations":
                collect_network_operations(
                    data_flow_results
                ),

            "network_destinations":
                network_destinations,

            "syntax_error":
                combined_data_flow[
                    "syntax_error"
                ]
        },

        # ----------------------------------------------------
        # Evidence
        # ----------------------------------------------------

        "evidence":
            evidence_result,

        # ----------------------------------------------------
        # Reasoning
        # ----------------------------------------------------

        "reasoning":
            reasoning_result,

        # ----------------------------------------------------
        # Human-readable observations
        # ----------------------------------------------------

        "behavior_summary":
            observations
    }