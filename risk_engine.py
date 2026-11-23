"""
Evidence-driven risk assessment for the Browser Extension Security Analyzer.

Design goals:
- Permissions describe capability; they are not proof of malicious behavior.
- Network APIs alone are not security findings.
- Risk is derived from observed evidence and context.
- Severity and confidence are separate.
- Every numeric contribution is traceable to an explicit factor.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse


LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
CONFIDENCE_LEVELS = ("NONE", "LOW", "MEDIUM", "HIGH")

# Evidence weights are deliberately grouped by the factors in the
# project's Risk Assessment design:
# data sensitivity, flow confidence, destination context, behavioral context.
# They are not permission/API "maliciousness points".
_FACTOR_WEIGHTS = {
    "data_sensitivity": 40,
    "flow_confidence": 30,
    "destination_context": 20,
    "behavioral_context": 10,
}

_SENSITIVITY = {
    "very_high": 1.00,
    "high": 0.80,
    "medium": 0.55,
    "low": 0.25,
    "unknown": 0.10,
    "none": 0.00,
}

_CONFIDENCE = {
    "HIGH": 1.00,
    "MEDIUM": 0.65,
    "LOW": 0.30,
    "NONE": 0.00,
}

_DESTINATION = {
    "suspicious": 1.00,
    "external": 0.75,
    "unknown": 0.50,
    "known": 0.20,
    "internal": 0.15,
    "none": 0.00,
}

_BEHAVIOR = {
    "data_transmission": 1.00,
    "destination_control": 0.65,
    "network": 0.20,
    "normal_network": 0.10,
    "capability": 0.10,
    "none": 0.00,
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _source_sensitivity(evidence: Dict[str, Any]) -> str:
    value = evidence.get("source_sensitivity")
    if isinstance(value, str) and value.strip():
        return _norm(value)

    source_types = evidence.get("source_types") or evidence.get("source_type") or []
    if not isinstance(source_types, list):
        source_types = [source_types]

    joined = " ".join(_norm(x) for x in source_types)

    if any(x in joined for x in ("cookie", "credential", "token", "password", "auth")):
        return "very_high"
    if any(x in joined for x in ("webrequest", "request", "tab", "url", "history")):
        return "medium"
    if any(x in joined for x in ("sessionstorage", "localstorage", "storage")):
        return "medium"
    if joined:
        return "low"
    return "unknown"


def _confidence(evidence: Dict[str, Any]) -> str:
    value = evidence.get("static_confidence") or evidence.get("confidence")
    value = str(value or "NONE").upper()
    return value if value in CONFIDENCE_LEVELS else "LOW"


def _destination_category(evidence: Dict[str, Any]) -> str:
    value = evidence.get("destination_category")
    if value:
        value = _norm(value)
        aliases = {
            "external_destination": "external",
            "known_destination": "known",
            "unknown_destination": "unknown",
            "suspicious_destination": "suspicious",
        }
        return aliases.get(value, value)

    destination = evidence.get("destination")
    if not destination:
        return "none"

    text = str(destination).strip()
    if "${" in text or "{" in text:
        return "unknown"

    try:
        parsed = urlparse(text)
        host = parsed.hostname
        if not host:
            return "unknown"
        if host in {"localhost", "127.0.0.1", "::1"}:
            return "internal"
        return "external"
    except Exception:
        return "unknown"


def classify_behavior(evidence: Dict[str, Any]) -> str:
    """
    Classify observed evidence.

    DATA_TRANSMISSION:
        A sensitive source is correlated with a network sink.

    DESTINATION_CONTROL:
        Source-derived data appears to influence the network destination,
        rather than the request body/headers/etc.

    NORMAL_NETWORK:
        A network operation exists but no sensitive source-to-sink evidence
        is established.

    CAPABILITY:
        Manifest capability only.
    """
    finding_type = _norm(evidence.get("finding_type") or evidence.get("type"))
    explicit = _norm(evidence.get("behavior_type") or evidence.get("classification"))

    if explicit in {
        "data_transmission",
        "destination_control",
        "normal_network",
    }:
        return explicit

    if "destination_control" in finding_type:
        return "destination_control"

    if "normal_network" in finding_type:
        return "normal_network"

    source = evidence.get("source")
    sink = evidence.get("sink")
    if source and sink:
        return "data_transmission"

    if sink:
        return "normal_network"

    return "capability"


def _factor_score(
    sensitivity: str,
    confidence: str,
    destination: str,
    behavior: str,
) -> Dict[str, Any]:
    sensitivity_value = _SENSITIVITY.get(sensitivity, _SENSITIVITY["unknown"])
    confidence_value = _CONFIDENCE.get(confidence, 0.0)
    destination_value = _DESTINATION.get(destination, _DESTINATION["unknown"])
    behavior_value = _BEHAVIOR.get(behavior, _BEHAVIOR["none"])

    # A factor contributes only when that factor is supported by evidence.
    data_score = round(_FACTOR_WEIGHTS["data_sensitivity"] * sensitivity_value)
    flow_score = round(_FACTOR_WEIGHTS["flow_confidence"] * confidence_value)
    destination_score = round(
        _FACTOR_WEIGHTS["destination_context"] * destination_value
    )
    behavior_score = round(
        _FACTOR_WEIGHTS["behavioral_context"] * behavior_value
    )

    # A normal network operation without a sensitive source is intentionally
    # capped at LOW. This prevents ordinary fetch/XHR/WebSocket usage from
    # becoming a high-risk finding.
    if behavior in {"normal_network", "network"}:
        score = min(20, behavior_score + round(destination_score * 0.25))
    elif behavior == "destination_control":
        score = min(
            60,
            round((flow_score * 0.60) + (destination_score * 0.75) + behavior_score),
        )
    elif behavior == "data_transmission":
        score = min(
            100,
            data_score + flow_score + destination_score + behavior_score,
        )
    else:
        score = min(25, behavior_score)

    return {
        "score": int(max(0, min(100, score))),
        "data_sensitivity": sensitivity,
        "flow_confidence": confidence,
        "destination_context": destination,
        "behavioral_context": behavior,
        "factor_contributions": {
            "data_sensitivity": data_score,
            "flow_confidence": flow_score,
            "destination_context": destination_score,
            "behavioral_context": behavior_score,
        },
    }


def severity_for_score(score: int, behavior: str) -> str:
    if behavior == "normal_network":
        return "LOW"
    if behavior == "destination_control":
        if score >= 45:
            return "MEDIUM"
        return "LOW"
    if score >= 80:
        return "CRITICAL"
    if score >= 55:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def risk_for_evidence(evidence: Dict[str, Any]) -> Dict[str, Any]:
    behavior = classify_behavior(evidence)
    sensitivity = _source_sensitivity(evidence)
    confidence = _confidence(evidence)
    destination = _destination_category(evidence)

    factors = _factor_score(
        sensitivity=sensitivity,
        confidence=confidence,
        destination=destination,
        behavior=behavior,
    )

    score = factors["score"]
    severity = severity_for_score(score, behavior)

    reasons: List[str] = []

    if behavior == "data_transmission":
        reasons.append("A security-relevant source is correlated with a network sink.")
    elif behavior == "destination_control":
        reasons.append("Source-derived data appears to influence the network destination.")
    elif behavior == "normal_network":
        reasons.append("Network communication was observed without a confirmed sensitive source-to-sink flow.")

    if sensitivity in {"very_high", "high"} and behavior == "data_transmission":
        reasons.append("The source contains potentially sensitive browser or authentication-related data.")

    if destination in {"external", "suspicious"} and behavior == "data_transmission":
        reasons.append("The destination is external or otherwise requires investigation.")

    if destination == "unknown":
        reasons.append("The static destination could not be confidently classified.")

    if evidence.get("transformations"):
        names = []
        for item in evidence["transformations"]:
            if isinstance(item, dict):
                name = item.get("function")
            else:
                name = item
            if name and name not in names:
                names.append(str(name))
        if names:
            reasons.append(
                "Source-derived data is processed by: " + ", ".join(names) + "."
            )

    if not reasons:
        reasons.append("Limited security evidence was established by static analysis.")

    chain = evidence.get("evidence_chain") or []
    if isinstance(chain, str):
        chain = [chain]

    return {
        "score": score,
        "level": severity,
        "confidence": confidence,
        "behavior_type": behavior,
        "factors": {
            "data_sensitivity": sensitivity,
            "flow_confidence": confidence,
            "destination_context": destination,
            "behavioral_context": behavior,
        },
        "factor_contributions": factors["factor_contributions"],
        "reasons": reasons,
        "evidence": list(chain),
        "source": evidence.get("source"),
        "source_type": evidence.get("source_type"),
        "sink": evidence.get("sink"),
        "sink_line": evidence.get("sink_line"),
        "destination": evidence.get("destination"),
        "destination_hostname": evidence.get("destination_hostname"),
        "file": evidence.get("file"),
        "line": evidence.get("line") or evidence.get("sink_line"),
        "transformations": evidence.get("transformations") or [],
        "explanation": evidence.get("explanation"),
    }


def _permission_capabilities(manifest: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not manifest:
        return []

    permissions = manifest.get("permissions") or []
    host_permissions = manifest.get("host_permissions") or []

    result = []
    seen = set()

    capability_map = {
        "cookies": ("HIGH", "Access to browser cookies is a security-sensitive capability."),
        "webRequest": ("MEDIUM", "Can observe or interact with browser network requests."),
        "webRequestBlocking": ("HIGH", "Can block or modify browser network requests."),
        "declarativeNetRequestWithHostAccess": ("MEDIUM", "Can apply network filtering rules with host access."),
        "tabs": ("MEDIUM", "Can access tab-related browser information."),
        "webNavigation": ("MEDIUM", "Can observe browser navigation events."),
        "scripting": ("MEDIUM", "Can inject or execute scripts in permitted contexts."),
        "storage": ("LOW", "Can access extension storage."),
        "management": ("MEDIUM", "Can access extension-management information."),
        "privacy": ("MEDIUM", "Can access browser privacy settings."),
        "proxy": ("HIGH", "Can control browser proxy configuration."),
    }

    for permission in permissions:
        key = str(permission)
        if key in seen:
            continue
        seen.add(key)

        if key in capability_map:
            level, reason = capability_map[key]
            result.append({
                "type": "CAPABILITY",
                "severity": level,
                "confidence": "HIGH",
                "name": key,
                "evidence": key,
                "reason": reason,
            })

    if "<all_urls>" in host_permissions or "<all_urls>" in permissions:
        result.append({
            "type": "CAPABILITY",
            "severity": "MEDIUM",
            "confidence": "HIGH",
            "name": "<all_urls>",
            "evidence": "<all_urls>",
            "reason": "The extension requests broad access across websites.",
        })

    return result


def assess_extension(
    manifest: Optional[Dict[str, Any]] = None,
    evidence: Optional[Iterable[Dict[str, Any]]] = None,
    data_flow_results: Optional[Iterable[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Aggregate an extension-level security assessment.

    The returned score is evidence-driven. Capability observations are
    reported separately and do not, by themselves, create a HIGH/CRITICAL
    behavioral finding.
    """
    manifest = manifest or {}
    evidence_items = list(evidence or [])

    # Allow direct consumption of data-flow dictionaries if evidence_engine
    # has not been invoked by a caller yet.
    for result in data_flow_results or []:
        if not isinstance(result, dict):
            continue
        for item in result.get("findings", []) or []:
            evidence_items.append(item)

    assessments = [risk_for_evidence(item) for item in evidence_items if isinstance(item, dict)]

    # Deduplicate exact behavioral evidence.
    unique = []
    seen = set()
    for item in assessments:
        key = (
            item.get("behavior_type"),
            str(item.get("source")),
            item.get("sink"),
            item.get("file"),
            item.get("line"),
            item.get("destination"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    assessments = unique

    capabilities = _permission_capabilities(manifest)

    behavior_findings = [
        x for x in assessments
        if x.get("behavior_type") != "capability"
    ]

    confirmed_transmissions = [
        x for x in behavior_findings
        if x.get("behavior_type") == "data_transmission"
        and x.get("confidence") in {"HIGH", "MEDIUM"}
    ]

    destination_controls = [
        x for x in behavior_findings
        if x.get("behavior_type") == "destination_control"
    ]

    normal_network = [
        x for x in behavior_findings
        if x.get("behavior_type") == "normal_network"
    ]

    # Extension-level score is based on the strongest observed behavior,
    # with a small evidence-density component. This avoids inflating a score
    # merely because a large bundle contains many ordinary network calls.
    if confirmed_transmissions:
        strongest = max(x["score"] for x in confirmed_transmissions)
        additional = min(15, max(0, len(confirmed_transmissions) - 1) * 5)
        overall_score = min(100, strongest + additional)
    elif destination_controls:
        overall_score = min(45, max(x["score"] for x in destination_controls))
    elif normal_network:
        overall_score = min(20, max(x["score"] for x in normal_network))
    else:
        overall_score = 0

    # Capability exposure is reported as a separate dimension. It can make
    # the report more security-relevant without pretending that permissions
    # establish malicious behavior.
    capability_counts = Counter(x["severity"] for x in capabilities)

    if confirmed_transmissions:
        overall_level = severity_for_score(overall_score, "data_transmission")
    elif destination_controls:
        overall_level = severity_for_score(overall_score, "destination_control")
    elif normal_network:
        overall_level = "LOW"
    elif capabilities:
        overall_level = "LOW"
    else:
        overall_level = "LOW"

    if confirmed_transmissions:
        overall_confidence = max(
            (x["confidence"] for x in confirmed_transmissions),
            key=lambda x: {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "NONE": 0}.get(x, 0),
        )
    elif behavior_findings:
        overall_confidence = max(
            (x["confidence"] for x in behavior_findings),
            key=lambda x: {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "NONE": 0}.get(x, 0),
        )
    elif capabilities:
        overall_confidence = "HIGH"
    else:
        overall_confidence = "NONE"

    return {
        "score": int(overall_score),
        "level": overall_level,
        "confidence": overall_confidence,
        "capabilities": capabilities,
        "capability_summary": dict(capability_counts),
        "findings": assessments,
        "behavior_summary": {
            "data_transmission": len(confirmed_transmissions),
            "destination_control": len(destination_controls),
            "normal_network": len(normal_network),
        },
        "confirmed_sensitive_data_flow": bool(confirmed_transmissions),
        "reasons": [
            *(
                ["Confirmed source-to-network evidence exists."]
                if confirmed_transmissions else
                ["No confirmed sensitive source-to-network flow was established."]
            ),
            *(
                ["The extension requests security-sensitive browser capabilities."]
                if capabilities else []
            ),
        ],
        "methodology": {
            "factor_weights": dict(_FACTOR_WEIGHTS),
            "note": (
                "Permissions and network APIs are treated as capabilities or "
                "context. Behavioral risk requires correlated evidence."
            ),
        },
    }


# ---------------------------------------------------------------------------
# Backward compatibility
# ---------------------------------------------------------------------------
PERMISSION_RULES = {
    "cookies": {"severity": "HIGH", "score": 20},
    "history": {"severity": "MEDIUM", "score": 15},
    "tabs": {"severity": "MEDIUM", "score": 10},
    "webRequest": {"severity": "HIGH", "score": 20},
    "management": {"severity": "HIGH", "score": 20},
}



def analyze_permissions(permissions, host_permissions):
    """
    Backward-compatible permission analysis.

    These are capability observations, not proof of malicious behavior.
    """
    findings = []

    for permission in permissions or []:
        if permission in PERMISSION_RULES:
            rule = PERMISSION_RULES[permission]
            findings.append({
                "type": "permission",
                "name": permission,
                "severity": rule["severity"],
                "score": rule["score"],
            })

    if "<all_urls>" in (host_permissions or []):
        findings.append({
            "type": "host_permission",
            "name": "<all_urls>",
            "severity": "HIGH",
            "score": 20,
        })

    return findings


def calculate_risk(permission_findings, js_findings):
    """Preserve the original prototype API."""
    score = 0
    for finding in permission_findings or []:
        score += finding.get("score", 0)
    for finding in js_findings or []:
        score += finding.get("score", 0)
    score = min(score, 100)
    if score <= 20:
        level = "LOW"
    elif score <= 40:
        level = "MEDIUM"
    elif score <= 70:
        level = "HIGH"
    else:
        level = "CRITICAL"
    return score, level


def analyze_risk(manifest=None, evidence=None, data_flow_results=None):
    """New evidence-driven API."""
    return assess_extension(
        manifest=manifest,
        evidence=evidence,
        data_flow_results=data_flow_results,
    )


def calculate_extension_risk(manifest=None, evidence=None, data_flow_results=None):
    return assess_extension(
        manifest=manifest,
        evidence=evidence,
        data_flow_results=data_flow_results,
    )
