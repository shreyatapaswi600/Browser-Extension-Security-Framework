
"""Safe JSON and HTML report rendering for extension analysis results.

Uploaded extension content is treated strictly as data. HTML output escapes all
values and never embeds or executes uploaded HTML, JavaScript, or CSS.
"""

from __future__ import annotations

import html
import json
from typing import Any


def build_report_document(analysis_result: dict[str, Any]) -> dict[str, Any]:
    """Return a detached, JSON-serializable snapshot without report artifacts."""
    document = dict(analysis_result or {})
    reports = document.get("reports") or {}
    document["reports"] = {
        "status": reports.get("status", "generated"),
        "generated_at": reports.get("generated_at"),
        "formats": reports.get("formats", {}),
    }
    return document


def render_json_report(analysis_result: dict[str, Any]) -> str:
    """Serialize the structured analysis result as readable JSON."""
    return json.dumps(
        build_report_document(analysis_result),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        default=str,
    )


def _pretty(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def _esc(value: Any) -> str:
    if value is None:
        value = "—"
    elif isinstance(value, (dict, list, tuple)):
        value = _pretty(value)
    return html.escape(str(value), quote=True)


def render_html_report(analysis_result: dict[str, Any]) -> str:
    """Render a self-contained HTML report with escaped, non-executable data."""
    result = build_report_document(analysis_result)

    extension = result.get("extension") or {}
    risk = result.get("risk_assessment") or {}
    evidence = result.get("evidence") or {}
    static = evidence.get("static_analysis") or {}
    dynamic = evidence.get("dynamic_analysis") or {}
    execution = result.get("execution") or {}

    findings = static.get("findings") or []
    capabilities = risk.get("capabilities") or []
    risk_findings = risk.get("findings") or []
    generated_at = (result.get("reports") or {}).get("generated_at")

    dynamic_requests = dynamic.get("network_requests") or []
    dynamic_responses = dynamic.get("network_responses") or []
    dynamic_failures = dynamic.get("network_failures") or []
    dom_events = dynamic.get("dom_events") or []
    endpoint_observations = (
        dynamic.get("controlled_endpoint_observations") or []
    )

    execution_success = execution.get("success") is True
    code_execution_performed = (
        execution.get("code_execution_performed") is True
    )
    dynamic_completed = dynamic.get("status") == "completed"

    summary_reasons = risk.get("reasons") or ["No risk rationale was recorded."]
    summary_text = " ".join(
        f"{str(reason).strip().rstrip('.; ')}."
        for reason in summary_reasons
        if str(reason).strip()
    ) or "No risk rationale was recorded."

    if execution_success and code_execution_performed:
        execution_notice = (
            "Controlled browser execution completed successfully. "
            "This confirms the worker run, but does not by itself establish "
            "extension-specific behavior or malicious activity."
        )
    elif dynamic_completed:
        execution_notice = (
            "The controlled runtime worker completed, but extension code "
            "execution was not independently confirmed."
        )
    else:
        execution_notice = (
            "No successful controlled runtime execution was recorded. "
            "The available findings should be interpreted as static-analysis "
            "results unless otherwise stated."
        )

    def table_rows(
        items: Any,
        columns: tuple[tuple[str, str], ...],
        empty_message: str = "No items recorded.",
    ) -> str:
        if not isinstance(items, list) or not items:
            return (
                '<tr><td colspan="%d" class="empty">'
                '%s</td></tr>' % (len(columns), _esc(empty_message))
            )

        rows = []

        for item in items:
            if not isinstance(item, dict):
                item = {"value": item}

            rows.append(
                "<tr>"
                + "".join(
                    f"<td>{_esc(item.get(key))}</td>"
                    for key, _ in columns
                )
                + "</tr>"
            )

        return "".join(rows)

    finding_columns = (
        ("file", "File"),
        ("pattern", "Pattern"),
        ("category", "Category"),
        ("severity", "Severity"),
        ("description", "Description"),
    )

    risk_columns = (
        ("behavior_type", "Behavior"),
        ("score", "Score"),
        ("level", "Level"),
        ("confidence", "Confidence"),
        ("source", "Source"),
        ("sink", "Sink"),
        ("destination", "Destination"),
    )

    capability_columns = (
        ("name", "Capability"),
        ("severity", "Severity"),
        ("reason", "Reason"),
    )

    dynamic_network_columns = (
        ("timestamp", "Timestamp"),
        ("method", "Method"),
        ("url", "URL"),
        ("resource_type", "Resource type"),
    )

    response_columns = (
        ("timestamp", "Timestamp"),
        ("url", "URL"),
        ("status", "Status"),
        ("status_text", "Status text"),
    )

    failure_columns = (
        ("timestamp", "Timestamp"),
        ("url", "URL"),
        ("failure", "Failure"),
    )

    endpoint_columns = (
        ("timestamp", "Timestamp"),
        ("method", "Method"),
        ("path", "Path"),
        ("client", "Client"),
        ("kind", "Observation type"),
    )

    dom_event_columns = (
        ("timestamp", "Timestamp"),
        ("event_type", "Event type"),
        ("tag", "Element tag"),
        ("id", "Element ID"),
        ("type", "Element type"),
        ("name", "Element name"),
        ("role", "Role"),
        ("aria_label", "ARIA label"),
        ("attribute", "Changed attribute"),
        ("message", "Message"),
        ("element", "Element details"),
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>Extension Security Analysis &mdash; {_esc(extension.get('name') or 'Unknown extension')}</title>
<style>
:root {{ color-scheme: light; font-family: Arial, sans-serif; }}
body {{ margin: 0; background: #f4f6f8; color: #17202a; line-height: 1.5; }}
main {{ max-width: 1100px; margin: 32px auto; padding: 0 20px 40px; }}
header, section {{ background: #fff; border: 1px solid #dce2e8; border-radius: 10px; padding: 20px; margin-bottom: 16px; }}
h1 {{ margin: 0 0 8px; font-size: 25px; }}
h2 {{ margin-top: 0; font-size: 19px; }}
h3 {{ font-size: 16px; margin-top: 22px; }}
.muted {{ color: #586574; }}
.metrics {{ display: flex; flex-wrap: wrap; gap: 12px; }}
.metric {{ background: #f4f6f8; border-radius: 8px; padding: 12px 16px; min-width: 125px; }}
.metric strong {{ display: block; font-size: 21px; }}
table {{ width: 100%; border-collapse: collapse; }}
th, td {{ text-align: left; vertical-align: top; border-bottom: 1px solid #e5e9ed; padding: 10px 12px; }}
th {{ background: #f4f6f8; white-space: normal; }}
td {{ overflow-wrap: anywhere; }}
.empty {{ color: #687684; text-align: center; padding: 16px; }}
pre {{ white-space: pre-wrap; overflow-wrap: anywhere; background: #f4f6f8; padding: 12px; border-radius: 6px; }}
.notice {{ border-left: 4px solid #64748b; padding: 10px 14px; background: #f4f6f8; }}
.table-wrap {{ display: block; width: 100%; max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; }}
.table-wrap table {{ min-width: 720px; }}
.dom-table {{ min-width: 1450px !important; table-layout: auto; }}
.dom-table th:nth-child(1), .dom-table td:nth-child(1) {{ min-width: 190px; white-space: nowrap; }}
.dom-table th:nth-child(2), .dom-table td:nth-child(2) {{ min-width: 210px; white-space: nowrap; }}
.dom-table th:nth-child(3), .dom-table td:nth-child(3) {{ min-width: 105px; }}
.dom-table th:nth-child(4), .dom-table td:nth-child(4) {{ min-width: 130px; }}
.dom-table th:nth-child(5), .dom-table td:nth-child(5) {{ min-width: 110px; }}
.dom-table td:nth-child(2) {{ overflow-wrap: normal; }}
@media (max-width: 700px) {{
  main {{ margin: 16px auto; padding: 0 12px 28px; }}
  header, section {{ padding: 16px; }}
  .metric {{ flex: 1 1 125px; }}
}}
</style>
</head>
<body>
<main>
<header>
<h1>Browser Extension Security Analysis</h1>
<p><strong>{_esc(extension.get('name') or 'Unknown extension')}</strong> &middot; Version {_esc(extension.get('version') or 'Unknown')}</p>
<p class="muted">Job: {_esc(result.get('job_id'))} &middot; Generated: {_esc(generated_at)}</p>
<div class="metrics">
<div class="metric"><span class="muted">Risk score</span><strong>{_esc(risk.get('score', 0))}/100</strong></div>
<div class="metric"><span class="muted">Risk level</span><strong>{_esc(risk.get('level', 'LOW'))}</strong></div>
<div class="metric"><span class="muted">Confidence</span><strong>{_esc(risk.get('confidence', 'NONE'))}</strong></div>
<div class="metric"><span class="muted">JS files scanned</span><strong>{_esc(static.get('javascript_files_scanned', 0))}</strong></div>
<div class="metric"><span class="muted">Static evidence items</span><strong>{_esc(evidence.get('evidence_count', 0))}</strong></div>
</div>
</header>

<section>
<h2>Assessment summary</h2>
<p>{_esc(summary_text)}</p>
<p class="notice">{_esc(execution_notice)}</p>
<p>Confirmed sensitive data flow: <strong>{_esc(risk.get('confirmed_sensitive_data_flow', False))}</strong></p>
</section>

<section>
<h2>Manifest and permissions</h2>
<p>Manifest version: {_esc(extension.get('manifest_version'))} &middot; Permissions: {_esc(extension.get('permissions') or [])}</p>
<p>Host permissions: {_esc(extension.get('host_permissions') or [])}</p>
<div class="table-wrap">
<table>
<thead><tr><th>Capability</th><th>Severity</th><th>Reason</th></tr></thead>
<tbody>{table_rows(capabilities, capability_columns)}</tbody>
</table>
</div>
</section>

<section>
<h2>Static findings</h2>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in finding_columns)}</tr></thead>
<tbody>{table_rows(findings, finding_columns)}</tbody>
</table>
</div>
</section>

<section>
<h2>Dynamic analysis observations</h2>
<p>Dynamic analysis status: <strong>{_esc(dynamic.get('status', 'not_run'))}</strong></p>
<p>Runtime target: {_esc(dynamic.get('target', 'Not recorded'))}</p>
<p>Network policy: {_esc(dynamic.get('network_policy', 'Not recorded'))}</p>
<p>Duration (seconds): {_esc(dynamic.get('duration_seconds', 'Not recorded'))}</p>

<div class="metrics">
<div class="metric"><span class="muted">DOM events</span><strong>{_esc(len(dom_events) if isinstance(dom_events, list) else 0)}</strong></div>
<div class="metric"><span class="muted">Network requests</span><strong>{_esc(len(dynamic_requests) if isinstance(dynamic_requests, list) else 0)}</strong></div>
<div class="metric"><span class="muted">Network responses</span><strong>{_esc(len(dynamic_responses) if isinstance(dynamic_responses, list) else 0)}</strong></div>
<div class="metric"><span class="muted">Network failures</span><strong>{_esc(len(dynamic_failures) if isinstance(dynamic_failures, list) else 0)}</strong></div>
</div>

<h3>DOM event observations</h3>
<p class="muted">Page-level DOM events and element metadata captured during the controlled runtime visit. Field values are not collected.</p>
<div class="table-wrap">
<table class="dom-table">
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in dom_event_columns)}</tr></thead>
<tbody>{table_rows(dom_events, dom_event_columns)}</tbody>
</table>
</div>

<h3>Observed browser network requests</h3>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in dynamic_network_columns)}</tr></thead>
<tbody>{table_rows(dynamic_requests, dynamic_network_columns)}</tbody>
</table>
</div>

<h3>Observed network responses</h3>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in response_columns)}</tr></thead>
<tbody>{table_rows(dynamic_responses, response_columns)}</tbody>
</table>
</div>

<h3>Network request failures</h3>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in failure_columns)}</tr></thead>
<tbody>{table_rows(dynamic_failures, failure_columns, "No network failures observed.")}</tbody>
</table>
</div>

<h3>Controlled endpoint observations</h3>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in endpoint_columns)}</tr></thead>
<tbody>{table_rows(endpoint_observations, endpoint_columns)}</tbody>
</table>
</div>

<h3>Dynamic analysis limitations</h3>
<pre>{_esc(dynamic.get('limitations') or ['No dynamic-analysis limitations were recorded.'])}</pre>
</section>

<section>
<h2>Evidence-driven risk findings</h2>
<div class="table-wrap">
<table>
<thead><tr>{''.join(f'<th>{label}</th>' for _, label in risk_columns)}</tr></thead>
<tbody>{table_rows(risk_findings, risk_columns)}</tbody>
</table>
</div>
</section>

<section>
<h2>Static analysis evidence summary</h2>
<pre>{_esc({key: evidence.get(key) for key in ('evidence_count', 'sensitive_data_flow', 'static_confidence', 'highest_source_sensitivity', 'files_analyzed', 'limitations', 'analysis_errors')})}</pre>
</section>

<section>
<h2>Execution status and limitations</h2>
<pre>{_esc(execution)}</pre>
<h3>Static analysis engine details</h3>
<p class="muted">The following engine details and limitations apply only to static analysis. They describe source-code inspection, not the separate controlled runtime execution reported above.</p>
<pre>{_esc(static.get('advanced_analysis') or {})}</pre>
<p class="muted">Static analysis examines extension source files without executing their code. The static-analysis limitations above apply only to that stage. Separately, the controlled Docker browser worker executed the configured runtime visit and collected page-level DOM and network observations. Successful worker execution does not prove that a particular observed action originated from the extension. A runtime network request alone does not establish data exfiltration or malicious intent. This worker does not yet instrument every browser extension API or background service-worker activity.</p>
</section>
</main>
</body>
</html>"""
