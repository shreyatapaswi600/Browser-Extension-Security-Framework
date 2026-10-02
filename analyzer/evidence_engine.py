import re
from urllib.parse import urlparse


# ============================================================
# CONFIDENCE
# ============================================================

CONFIDENCE_RANK = {
    "NONE": 0,
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
}


# ============================================================
# SOURCE SENSITIVITY
# ============================================================

SOURCE_SENSITIVITY = {
    "browser_cookie": "high",
    "browser_cookies": "high",
    "cookie": "high",
    "local_storage": "high",
    "session_storage": "medium",
    "page_location": "medium",
    "location": "medium",
}


# ============================================================
# BASIC HELPERS
# ============================================================

def unique_dicts(items, keys):
    """
    Remove duplicate dictionaries using the supplied keys.

    Example:
        keys = ["sink", "destination"]

    Only dictionaries with identical values for all supplied
    keys are considered duplicates.
    """

    seen = set()
    result = []

    for item in items:

        if not isinstance(item, dict):
            continue

        identity = tuple(
            item.get(key)
            for key in keys
        )

        if identity in seen:
            continue

        seen.add(identity)
        result.append(item)

    return result


def normalize_url(value):
    """
    Normalize a URL-like value into a string.
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # Remove surrounding quotes.
    if (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in ("'", '"')
    ):
        value = value[1:-1].strip()

    return value


def classify_destination(destination):
    """
    Classify a network destination.

    Categories:
        external
        localhost
        relative
        browser_internal
        unknown
    """

    destination = normalize_url(destination)

    if not destination:
        return {
            "category": "unknown",
            "hostname": None,
        }

    lower = destination.lower()

    if lower.startswith(
        (
            "chrome://",
            "chrome-extension://",
            "moz-extension://",
            "edge://",
            "about:",
        )
    ):
        return {
            "category": "browser_internal",
            "hostname": None,
        }

    if lower.startswith(
        (
            "/",
            "./",
            "../",
        )
    ):
        return {
            "category": "relative",
            "hostname": None,
        }

    try:

        parsed = urlparse(
            destination
        )

        hostname = parsed.hostname

        if not hostname:
            return {
                "category": "unknown",
                "hostname": None,
            }

        hostname_lower = hostname.lower()

        if hostname_lower in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            return {
                "category": "localhost",
                "hostname": hostname,
            }

        if parsed.scheme in {
            "http",
            "https",
            "ws",
            "wss",
        }:
            return {
                "category": "external",
                "hostname": hostname,
            }

    except Exception:
        pass

    return {
        "category": "unknown",
        "hostname": None,
    }


# ============================================================
# SOURCE NORMALIZATION
# ============================================================

def get_source_type(source):
    """
    Obtain a normalized source type.
    """

    if not isinstance(source, dict):
        return None

    return (
        source.get("source_type")
        or source.get("type")
        or source.get("category")
    )


def normalize_sources(sources):
    """
    Normalize source dictionaries while preserving source-specific
    metadata such as line number and variable name.

    This is important because two separate document.cookie reads
    must remain separate evidence sources.
    """

    if not isinstance(sources, list):
        return []

    normalized = []

    for source in sources:

        if not isinstance(source, dict):
            continue

        item = dict(source)

        item["source"] = (
            item.get("source")
            or item.get("expression")
            or item.get("name")
        )

        item["source_type"] = get_source_type(
            item
        )

        if (
            "line" not in item
            and "source_line" in item
        ):
            item["line"] = item.get(
                "source_line"
            )

        normalized.append(item)

    return normalized


def get_source_names(sources):
    """
    Return unique source names.
    """

    names = []

    for source in sources:

        if not isinstance(source, dict):
            continue

        name = source.get(
            "source"
        )

        if (
            name
            and name not in names
        ):
            names.append(name)

    return names


def determine_source_sensitivity(sources):
    """
    Determine the highest sensitivity among the supplied sources.
    """

    rank = {
        "none": 0,
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4,
    }

    highest = "none"

    for source in sources:

        source_type = get_source_type(
            source
        )

        if not source_type:
            continue

        sensitivity = SOURCE_SENSITIVITY.get(
            source_type,
            "medium",
        )

        if rank.get(
            sensitivity,
            0,
        ) > rank.get(
            highest,
            0,
        ):
            highest = sensitivity

    return highest


# ============================================================
# TRANSFORMATION HANDLING
# ============================================================

def transformation_uses_variable(
    transformation,
    variables,
):
    """
    Determine whether a transformation expression references
    one of the supplied variables.
    """

    if not isinstance(
        transformation,
        dict,
    ):
        return False

    expression = str(
        transformation.get(
            "expression"
        )
        or ""
    )

    if not expression:
        return False

    for variable in variables:

        if not variable:
            continue

        pattern = (
            r"\b"
            + re.escape(
                str(variable)
            )
            + r"\b"
        )

        if re.search(
            pattern,
            expression,
        ):
            return True

    return False


def summarize_transformations(
    transformations,
    variables,
):
    """
    Return only transformations that actually reference
    variables on the finding's data-flow path.
    """

    related = []

    for transformation in transformations:

        if transformation_uses_variable(
            transformation,
            variables,
        ):
            related.append(
                transformation
            )

    return unique_dicts(
        related,
        [
            "function",
            "file",
            "line",
        ],
    )


# ============================================================
# EVIDENCE CHAIN
# ============================================================

def build_chain_from_finding(
    finding,
):
    """
    Preserve the detailed evidence chain produced by the
    data-flow analyzer.

    If unavailable, reconstruct a simpler chain.
    """

    chain = finding.get(
        "evidence_chain"
    )

    if isinstance(
        chain,
        list,
    ) and chain:
        return chain

    if isinstance(
        chain,
        str,
    ) and chain:

        return [
            part.strip()
            for part in chain.split(
                "->"
            )
            if part.strip()
        ]

    source = finding.get(
        "source"
    )

    if isinstance(
        source,
        list,
    ):
        source = (
            source[0]
            if source
            else None
        )

    result = []

    if source:
        result.append(
            source
        )

    variables = []

    for key in (
        "argument_variable",
        "parameter_variable",
    ):

        value = finding.get(
            key
        )

        if (
            value
            and value not in variables
        ):
            variables.append(
                value
            )

    for value in variables:

        if value not in result:
            result.append(
                value
            )

    sink = finding.get(
        "sink"
    )

    if sink:

        result.append(
            f"{sink}()"
        )

    destination = finding.get(
        "destination"
    )

    if destination:
        result.append(
            destination
        )

    return result


# ============================================================
# STATIC CONFIDENCE
# ============================================================

def calculate_static_confidence(
    sources,
    related_variables,
    transformations,
    sink,
    destination,
    finding=None,
):
    """
    Calculate evidence confidence.

    This is confidence in the observed static evidence,
    NOT a maliciousness score.
    """

    if (
        finding
        and finding.get(
            "flow_type"
        ) == "interprocedural"
        and sources
        and sink
    ):

        if destination:
            return "HIGH"

        return "MEDIUM"

    evidence_count = sum(
        bool(value)
        for value in (
            sources,
            related_variables,
            transformations,
            sink,
            destination,
        )
    )

    if evidence_count >= 5:
        return "HIGH"

    if evidence_count >= 3:
        return "MEDIUM"

    if evidence_count >= 1:
        return "LOW"

    return "NONE"


# ============================================================
# BEHAVIOR EXPLANATION
# ============================================================

def explain_behavior(
    sources,
    transformations,
    sink,
    destination,
    destination_info,
    finding=None,
):
    """
    Generate a human-readable explanation from actual evidence.
    """

    source_names = get_source_names(
        sources
    )

    source_description = (
        ", ".join(
            source_names
        )
        if source_names
        else "a security-relevant source"
    )

    sink_name = (
        sink.get("sink")
        if sink
        else (
            finding or {}
        ).get("sink")
    )

    text = (
        f"Data originating from "
        f"{source_description} appears to reach "
        f"the {sink_name} network operation."
    )

    transformation_names = []

    for transformation in transformations:

        name = transformation.get(
            "function"
        )

        if (
            name
            and name not in transformation_names
        ):
            transformation_names.append(
                name
            )

    if transformation_names:

        text += (
            " The source-derived data is also "
            "processed by "
            + ", ".join(
                transformation_names
            )
            + "."
        )

    if destination:

        text += (
            " The network destination is "
            + (
                destination_info.get(
                    "hostname"
                )
                or destination
            )
            + "."
        )

    else:

        text += (
            " The network destination could "
            "not be statically determined."
        )

    return text


# ============================================================
# FINDING / SOURCE MATCHING
# ============================================================

def _source_matches_finding(
    source,
    finding,
):
    """
    Match a source to one specific finding.

    Matching priority:

        source expression
        + source variable
        + source line

    This prevents separate uses of the same source expression,
    such as two document.cookie reads, from being merged.
    """

    if not isinstance(
        source,
        dict,
    ):
        return False

    if not isinstance(
        finding,
        dict,
    ):
        return False

    finding_source = finding.get(
        "source"
    )

    source_value = source.get(
        "source"
    )

    if isinstance(
        finding_source,
        list,
    ):

        source_matches = (
            source_value
            in finding_source
        )

    else:

        source_matches = (
            bool(finding_source)
            and source_value
            == finding_source
        )

    if not source_matches:
        return False

    finding_variable = finding.get(
        "variable"
    )

    source_variable = source.get(
        "variable"
    )

    if (
        finding_variable
        and source_variable
        and finding_variable
        != source_variable
    ):
        return False

    finding_line = finding.get(
        "source_line"
    )

    source_line = source.get(
        "line"
    )

    if (
        finding_line is not None
        and source_line is not None
    ):

        try:

            if int(
                finding_line
            ) != int(
                source_line
            ):
                return False

        except (
            TypeError,
            ValueError,
        ):

            if str(
                finding_line
            ) != str(
                source_line
            ):
                return False

    return True


# ============================================================
# NETWORK SINK MATCHING
# ============================================================

def _find_sink(
    finding,
    sinks,
):
    """
    Find the EXACT network sink associated with a finding.

    The data-flow analyzer already knows:

        finding["sink"]
        finding["sink_line"]

    Therefore we match:

        sink name + exact line number

    We intentionally DO NOT fall back to the first sink with
    the same name.

    That old fallback caused:

        fetch line 60
            ->
        fetch line 8

    and consequently collapsed independent findings.
    """

    if not isinstance(
        finding,
        dict,
    ):
        return None

    if not isinstance(
        sinks,
        list,
    ):
        return None

    sink_name = finding.get(
        "sink"
    )

    sink_line = finding.get(
        "sink_line"
    )

    if not sink_name:
        return None

    # --------------------------------------------------------
    # Exact sink + line match
    # --------------------------------------------------------

    if sink_line is not None:

        try:
            expected_line = int(
                sink_line
            )

        except (
            TypeError,
            ValueError,
        ):
            expected_line = None

        for sink in sinks:

            if not isinstance(
                sink,
                dict,
            ):
                continue

            if sink.get(
                "sink"
            ) != sink_name:
                continue

            actual_line = sink.get(
                "line"
            )

            try:
                actual_line = int(
                    actual_line
                )

            except (
                TypeError,
                ValueError,
            ):
                continue

            if (
                expected_line is not None
                and actual_line
                == expected_line
            ):
                return sink

    # --------------------------------------------------------
    # If there is no sink line, only allow a sink-name match
    # when the name is unambiguous.
    # --------------------------------------------------------

    if sink_line is None:

        matching_sinks = [
            sink
            for sink in sinks
            if (
                isinstance(
                    sink,
                    dict,
                )
                and sink.get(
                    "sink"
                ) == sink_name
            )
        ]

        if len(
            matching_sinks
        ) == 1:
            return matching_sinks[0]

    # --------------------------------------------------------
    # NEVER return the first fetch()/XHR/etc. here.
    # --------------------------------------------------------

    return None


# ============================================================
# FINDING VARIABLES
# ============================================================

def _build_flow_graph(
    variable_flows,
    interprocedural_flows=None,
):
    """
    Build a directed variable-flow graph.
    """

    graph = {}

    all_flows = (
        list(
            variable_flows
            or []
        )
        + list(
            interprocedural_flows
            or []
        )
    )

    for flow in all_flows:

        if not isinstance(
            flow,
            dict,
        ):
            continue

        source = flow.get(
            "from"
        )

        target = flow.get(
            "to"
        )

        if not source or not target:
            continue

        graph.setdefault(
            source,
            [],
        ).append(
            target
        )

    return graph


def _shortest_variable_path(
    start,
    targets,
    graph,
):
    """
    Find the shortest directed path from start to one of targets.
    """

    targets = set(
        targets
        or []
    )

    if not start:
        return []

    if start in targets:
        return [
            start
        ]

    queue = [
        (
            start,
            [start],
        )
    ]

    visited = {
        start
    }

    while queue:

        current, path = queue.pop(
            0
        )

        for nxt in graph.get(
            current,
            [],
        ):

            if nxt in visited:
                continue

            new_path = (
                path
                + [nxt]
            )

            if nxt in targets:
                return new_path

            visited.add(
                nxt
            )

            queue.append(
                (
                    nxt,
                    new_path,
                )
            )

    return [
        start
    ]


def _sink_argument_variables(
    sink,
):
    """
    Extract likely variable names from a sink's arguments.

    For fetch:

        fetch(url, { body: cookieData })

    returns:

        cookieData
    """

    if not sink:
        return []

    variables = []

    arguments = (
        sink.get(
            "arguments"
        )
        or []
    )

    ignored = {
        "method",
        "body",
        "headers",
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
        "true",
        "false",
        "null",
        "undefined",
    }

    for argument in arguments:

        text = str(
            argument
        )

        for token in re.findall(
            r"\b[A-Za-z_$][A-Za-z0-9_$]*\b",
            text,
        ):

            if token in ignored:
                continue

            if token not in variables:
                variables.append(
                    token
                )

    return variables


def _finding_variables(
    finding,
    variable_flows,
    sources,
    interprocedural_flows=None,
    sink=None,
):
    """
    Return only variables on the shortest source-to-sink path
    for this particular finding.

    Independent flows from the same source are NOT merged.
    """

    source_variable = finding.get(
        "variable"
    )

    if not source_variable:

        for source in sources:

            if _source_matches_finding(
                source,
                finding,
            ):

                source_variable = source.get(
                    "variable"
                )

                if source_variable:
                    break

    targets = []

    parameter = finding.get(
        "parameter_variable"
    )

    argument = finding.get(
        "argument_variable"
    )

    if parameter:
        targets.append(
            parameter
        )

    if argument:
        targets.append(
            argument
        )

    if sink:

        targets.extend(
            _sink_argument_variables(
                sink
            )
        )

    targets = list(
        dict.fromkeys(
            targets
        )
    )

    graph = _build_flow_graph(
        variable_flows,
        interprocedural_flows,
    )

    path = _shortest_variable_path(
        source_variable,
        targets,
        graph,
    )

    if len(path) > 1:
        return path

    fallback = []

    for value in (
        source_variable,
        argument,
        parameter,
    ):

        if (
            value
            and value not in fallback
        ):
            fallback.append(
                value
            )

    return fallback


# ============================================================
# BUILD ONE EVIDENCE ITEM
# ============================================================

def _build_evidence_from_finding(
    finding,
    sources,
    variable_flows,
    transformations,
    sinks,
    interprocedural_flows=None,
):
    """
    Convert one data-flow finding into one structured
    evidence item.
    """

    matching_sources = [
        source
        for source in sources
        if _source_matches_finding(
            source,
            finding,
        )
    ]

    sink = _find_sink(
        finding,
        sinks,
    )

    destination = normalize_url(
        (
            (
                sink
                or {}
            ).get(
                "destination"
            )
            or finding.get(
                "destination"
            )
        )
    )

    destination_info = classify_destination(
        destination
    )

    variables = _finding_variables(
        finding,
        variable_flows,
        matching_sources,
        interprocedural_flows,
        sink,
    )

    related_transformations = (
        summarize_transformations(
            transformations,
            variables,
        )
    )

    sensitivity = (
        determine_source_sensitivity(
            matching_sources
        )
    )

    confidence = (
        calculate_static_confidence(
            matching_sources,
            variables,
            related_transformations,
            sink or {},
            destination,
            finding,
        )
    )

    chain = build_chain_from_finding(
        finding
    )

    explanation = explain_behavior(
        matching_sources,
        related_transformations,
        sink or {},
        destination,
        destination_info,
        finding,
    )

    source_values = [
        source.get(
            "source"
        )
        for source in matching_sources
        if source.get(
            "source"
        )
    ]

    source_types = [
        get_source_type(
            source
        )
        for source in matching_sources
        if get_source_type(
            source
        )
    ]

    sink_name = (
        (
            sink or {}
        ).get(
            "sink"
        )
        or finding.get(
            "sink"
        )
    )

    sink_line = (
        (
            sink or {}
        ).get(
            "line"
        )
        if sink
        else finding.get(
            "sink_line"
        )
    )

    sink_file = (
        (
            sink or {}
        ).get(
            "file"
        )
        or finding.get(
            "file"
        )
    )

    finding_type = (
        finding.get(
            "type"
        )
        or finding.get(
            "finding_type"
        )
        or "potential_sensitive_data_transmission"
    )

    variables_list = sorted(
        set(
            variables
        )
    )

    destination_hostname = (
        destination_info.get(
            "hostname"
        )
    )

    return {

        # ----------------------------------------------------
        # Finding identity
        # ----------------------------------------------------

        "finding_type": finding_type,

        "type": finding_type,

        # ----------------------------------------------------
        # Behavior
        # ----------------------------------------------------

        "behavior": (
            "Sensitive data appears to "
            "reach a network sink."
        ),

        # ----------------------------------------------------
        # Source
        # ----------------------------------------------------

        "source": source_values,

        "source_type": source_types,

        "source_types": source_types,

        "source_sensitivity": sensitivity,

        # ----------------------------------------------------
        # Variables
        # ----------------------------------------------------

        "variables_involved": variables_list,

        "variables": variables_list,

        # ----------------------------------------------------
        # Transformations
        # ----------------------------------------------------

        "transformations": [
            {
                "function": transformation.get(
                    "function"
                ),
                "type": transformation.get(
                    "type"
                ),
                "line": transformation.get(
                    "line"
                ),
            }
            for transformation
            in related_transformations
        ],

        # ----------------------------------------------------
        # Sink
        # ----------------------------------------------------

        "sink": sink_name,

        "sink_line": sink_line,

        # ----------------------------------------------------
        # Destination
        # ----------------------------------------------------

        "destination": destination,

        "destination_category": (
            destination_info.get(
                "category"
            )
        ),

        "destination_hostname": (
            destination_hostname
        ),

        "destination_host": (
            destination_hostname
        ),

        # ----------------------------------------------------
        # Location
        # ----------------------------------------------------

        "file": sink_file,

        "line": sink_line,

        # ----------------------------------------------------
        # Evidence chain
        # ----------------------------------------------------

        "evidence_chain": chain,

        # ----------------------------------------------------
        # Confidence
        # ----------------------------------------------------

        "static_confidence": confidence,

        # ----------------------------------------------------
        # Explanation
        # ----------------------------------------------------

        "explanation": explanation,

        # ----------------------------------------------------
        # Flow metadata
        # ----------------------------------------------------

        "flow_type": finding.get(
            "flow_type"
        ),

        "callee": finding.get(
            "callee"
        ),

        "function_call_line": finding.get(
            "function_call_line"
        ),

        "argument_variable": finding.get(
            "argument_variable"
        ),

        "parameter_variable": finding.get(
            "parameter_variable"
        ),
    }


# ============================================================
# LEGACY EVIDENCE CONVERSION
# ============================================================

def _legacy_evidence_to_finding(
    item,
):
    """
    Convert older evidence structures into the newer
    finding representation.
    """

    return {

        "type": (
            item.get(
                "finding_type"
            )
            or "potential_sensitive_data_transmission"
        ),

        "source": (
            item.get(
                "source"
            )
            or item.get(
                "source_variables"
            )
            or []
        ),

        "sink": item.get(
            "sink"
        ),

        "sink_line": item.get(
            "line"
        ),

        "file": item.get(
            "file"
        ),

        "destination": item.get(
            "destination"
        ),

        "flow_type": item.get(
            "flow_type"
        ),

        "argument_variable": item.get(
            "argument_variable"
        ),

        "parameter_variable": item.get(
            "parameter_variable"
        ),

        "evidence_chain": item.get(
            "evidence_chain"
        ),
    }


# ============================================================
# MAIN EVIDENCE ANALYZER
# ============================================================

def analyze_evidence(
    data_flow_result,
):
    """
    Analyze the dictionary returned by analyze_data_flow().
    """

    if not isinstance(
        data_flow_result,
        dict,
    ):
        raise TypeError(
            "analyze_evidence() expects the dictionary "
            "returned by analyze_data_flow()."
        )

    # --------------------------------------------------------
    # Sources
    # --------------------------------------------------------

    sources = normalize_sources(
        data_flow_result.get(
            "sources",
            [],
        )
    )

    # --------------------------------------------------------
    # Variable flows
    # --------------------------------------------------------

    variable_flows = (
        data_flow_result.get(
            "variable_flows",
            [],
        )
        or []
    )

    # --------------------------------------------------------
    # Transformations
    # --------------------------------------------------------

    transformations = (
        data_flow_result.get(
            "transformations",
            [],
        )
        or []
    )

    # --------------------------------------------------------
    # Interprocedural flows
    # --------------------------------------------------------

    interprocedural_flows = (
        data_flow_result.get(
            "interprocedural_flows",
            [],
        )
        or []
    )

    # --------------------------------------------------------
    # Network operations
    # --------------------------------------------------------

    sinks = (
        data_flow_result.get(
            "network_operations",
            [],
        )
        or data_flow_result.get(
            "network_sinks",
            [],
        )
        or []
    )

    # --------------------------------------------------------
    # Findings
    # --------------------------------------------------------

    findings = (
        data_flow_result.get(
            "findings",
            [],
        )
        or []
    )

    # --------------------------------------------------------
    # Compatibility with older analyzer output
    # --------------------------------------------------------

    if not findings:

        findings = [
            _legacy_evidence_to_finding(
                item
            )
            for item in (
                data_flow_result.get(
                    "evidence",
                    [],
                )
                or []
            )
        ]

    # --------------------------------------------------------
    # Build evidence
    #
    # IMPORTANT:
    #
    # Each data-flow finding is processed independently.
    # We do not group findings by source or sink name.
    # --------------------------------------------------------

    evidence_items = []

    for finding in findings:

        if not isinstance(
            finding,
            dict,
        ):
            continue

        item = _build_evidence_from_finding(
            finding,
            sources,
            variable_flows,
            transformations,
            sinks,
            interprocedural_flows,
        )

        # A security evidence item requires both a source
        # and a network sink.
        if (
            item.get(
                "source"
            )
            and item.get(
                "sink"
            )
        ):
            evidence_items.append(
                item
            )

    # --------------------------------------------------------
    # Remove true duplicates only.
    #
    # Different sink lines/destinations remain independent.
    # --------------------------------------------------------

    evidence_items = unique_dicts(
        evidence_items,
        [
            "finding_type",
            "file",
            "line",
            "sink",
            "destination",
        ],
    )

    # --------------------------------------------------------
    # Overall confidence
    # --------------------------------------------------------

    static_confidence = max(
        (
            item.get(
                "static_confidence",
                "NONE",
            )
            for item in evidence_items
        ),
        key=lambda value:
            CONFIDENCE_RANK.get(
                value,
                0,
            ),
        default="NONE",
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    highest_sensitivity = (
        determine_source_sensitivity(
            sources
        )
    )

    summary = {

        "evidence_count": len(
            evidence_items
        ),

        "sensitive_data_flow_detected": bool(
            evidence_items
        ),

        "highest_source_sensitivity": (
            highest_sensitivity
        ),

        "network_sinks_observed": len(
            sinks
        ),

        "sources_observed": len(
            sources
        ),

        "static_confidence": (
            static_confidence
        ),
    }

    # --------------------------------------------------------
    # Return complete evidence result
    # --------------------------------------------------------

    return {

        # Detailed evidence
        "evidence": evidence_items,

        # Summary
        "summary": summary,

        # Compatibility fields
        "evidence_count": (
            summary[
                "evidence_count"
            ]
        ),

        "sensitive_data_flow": (
            summary[
                "sensitive_data_flow_detected"
            ]
        ),

        "sensitive_data_flow_detected": (
            summary[
                "sensitive_data_flow_detected"
            ]
        ),

        "sources_observed": (
            summary[
                "sources_observed"
            ]
        ),

        "network_sinks_observed": (
            summary[
                "network_sinks_observed"
            ]
        ),

        "highest_source_sensitivity": (
            summary[
                "highest_source_sensitivity"
            ]
        ),

        "static_confidence": (
            summary[
                "static_confidence"
            ]
        ),
    }