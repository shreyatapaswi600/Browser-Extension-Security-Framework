import os
import re


# These are observations.
# They do NOT automatically increase the maliciousness score.
OBSERVATION_PATTERNS = {

    "fetch(": {
        "description": "Network request API detected"
    },

    "XMLHttpRequest": {
        "description": "XMLHttpRequest usage detected"
    },

    "atob(": {
        "description": "Base64 decoding detected"
    },

    "chrome.cookies": {
        "description": "Browser cookie API usage detected"
    },

    "chrome.storage": {
        "description": "Browser storage API usage detected"
    },

    "chrome.tabs": {
        "description": "Browser tabs API usage detected"
    }
}


# These are stronger suspicious indicators.
SUSPICIOUS_PATTERNS = {

    "eval(": {
        "severity": "HIGH",
        "score": 25,
        "description": "Dynamic JavaScript execution detected"
    },

    "new Function(": {
        "severity": "HIGH",
        "score": 25,
        "description": "Dynamic Function constructor detected"
    },

    "document.cookie": {
        "severity": "HIGH",
        "score": 20,
        "description": "Direct browser cookie access detected"
    },

    "localStorage": {
        "severity": "LOW",
        "score": 5,
        "description": "Local browser storage access detected"
    }
}


def analyze_javascript(extension_path):

    findings = []

    for root, dirs, files in os.walk(extension_path):

        for filename in files:

            if not filename.endswith(".js"):
                continue

            filepath = os.path.join(root, filename)

            try:

                with open(
                    filepath,
                    "r",
                    encoding="utf-8",
                    errors="ignore"
                ) as file:

                    code = file.read()


                # --------------------------------
                # Observation analysis
                # --------------------------------

                for pattern, rule in OBSERVATION_PATTERNS.items():

                    if pattern in code:

                        findings.append({
                            "file": filename,
                            "pattern": pattern,
                            "category": "observation",
                            "severity": "INFO",
                            "score": 0,
                            "description": rule["description"]
                        })


                # --------------------------------
                # Suspicious pattern analysis
                # --------------------------------

                for pattern, rule in SUSPICIOUS_PATTERNS.items():

                    if pattern in code:

                        findings.append({
                            "file": filename,
                            "pattern": pattern,
                            "category": "suspicious",
                            "severity": rule["severity"],
                            "score": rule["score"],
                            "description": rule["description"]
                        })


                # --------------------------------
                # Basic obfuscation indicators
                # --------------------------------

                long_strings = re.findall(
                    r'["\'][A-Za-z0-9+/=]{100,}["\']',
                    code
                )

                if len(long_strings) >= 2:

                    findings.append({
                        "file": filename,
                        "pattern": "long_encoded_strings",
                        "category": "suspicious",
                        "severity": "MEDIUM",
                        "score": 15,
                        "description":
                            "Multiple unusually long encoded strings detected"
                    })


            except Exception as error:

                findings.append({
                    "file": filename,
                    "category": "error",
                    "severity": "ERROR",
                    "score": 0,
                    "description": str(error)
                })


    return findings