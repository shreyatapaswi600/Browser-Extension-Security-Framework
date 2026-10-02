PERMISSION_RULES = {
    "cookies": {
        "severity": "HIGH",
        "score": 20
    },
    "history": {
        "severity": "MEDIUM",
        "score": 15
    },
    "tabs": {
        "severity": "MEDIUM",
        "score": 10
    },
    "webRequest": {
        "severity": "HIGH",
        "score": 20
    },
    "management": {
        "severity": "HIGH",
        "score": 20
    }
}


def analyze_permissions(permissions, host_permissions):
    findings = []

    for permission in permissions:

        if permission in PERMISSION_RULES:
            rule = PERMISSION_RULES[permission]

            findings.append({
                "type": "permission",
                "name": permission,
                "severity": rule["severity"],
                "score": rule["score"]
            })

    if "<all_urls>" in host_permissions:
        findings.append({
            "type": "host_permission",
            "name": "<all_urls>",
            "severity": "HIGH",
            "score": 20
        })

    return findings


def calculate_risk(permission_findings, js_findings):
    score = 0

    for finding in permission_findings:
        score += finding.get("score", 0)

    for finding in js_findings:
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