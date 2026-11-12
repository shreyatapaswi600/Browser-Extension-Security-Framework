
from datetime import datetime, timezone


def log_network_request(request, log_list):
    """
    Record Fetch and XMLHttpRequest network activity.
    """

    if request.resource_type not in ("xhr", "fetch"):
        return

    event = {
        "event_type": "network_request",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "url": request.url,
        "method": request.method,
        "type": request.resource_type
    }

    log_list.append(event)
def log_network_response(response, log_list):
    """
    Record HTTP responses for Fetch and XMLHttpRequest requests.
    """

    request = response.request

    if request.resource_type not in ("xhr", "fetch"):
        return

    event = {
        "event_type": "network_response",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "url": response.url,
        "method": request.method,
        "type": request.resource_type,
        "status": response.status,
        "status_text": response.status_text
    }

    log_list.append(event)


def log_network_failure(request, log_list):
    """
    Record failed Fetch and XMLHttpRequest requests.
    """

    if request.resource_type not in ("xhr", "fetch"):
        return

    event = {
        "event_type": "network_failure",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "url": request.url,
        "method": request.method,
        "type": request.resource_type,
        "failure": request.failure
    }

    log_list.append(event)