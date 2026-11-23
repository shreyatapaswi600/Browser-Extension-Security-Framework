
"""Offline, queue-driven Chromium extension observation worker.

The container is intended to run with Docker network_mode: none, a read-only
extension upload mount, a dedicated queue volume, a read-only root filesystem,
no Linux capabilities, and no database credentials.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
import time
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.async_api import async_playwright


QUEUE_ROOT = Path(os.environ.get("QUEUE_ROOT", "/work/queue"))
UPLOADS_ROOT = Path(os.environ.get("UPLOADS_ROOT", "/data/uploads")).resolve()

DEFAULT_DURATION = int(os.environ.get("ANALYSIS_DURATION_SECONDS", "15"))
MAX_DURATION = int(os.environ.get("MAX_ANALYSIS_DURATION_SECONDS", "30"))

FIXTURE_HOST = "127.0.0.1"
FIXTURE_PORT = 8765

RUNTIME_ROOT = Path("/work/tmp/chromium-runtime")

MAX_EVENTS = 1000
MAX_NODE_DETAILS = 20
OBSERVATION_PREFIX = "[EXTENSION_OBSERVATION] "


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_bounded(target: list, item: dict) -> None:
    """Append an observation without allowing an unlimited event list."""
    if len(target) < MAX_EVENTS:
        target.append(item)


def configure_chromium_runtime() -> None:
    """Place Chromium runtime files on writable temporary storage."""
    runtime_dirs = {
        "HOME": RUNTIME_ROOT / "home",
        "XDG_CACHE_HOME": RUNTIME_ROOT / "cache",
        "XDG_CONFIG_HOME": RUNTIME_ROOT / "config",
        "XDG_DATA_HOME": RUNTIME_ROOT / "data",
    }

    for env_name, directory in runtime_dirs.items():
        directory.mkdir(parents=True, exist_ok=True)
        os.environ[env_name] = str(directory)


class FixtureHandler(BaseHTTPRequestHandler):
    observations: list[dict] = []

    def _record(self, method: str) -> None:
        append_bounded(
            type(self).observations,
            {
                "timestamp": utc_now(),
                "method": method,
                "path": self.path[:500],
                "client": self.client_address[0],
            },
        )

    def do_GET(self):
        self._record("GET")

        body = b"""<!doctype html><html><head><title>Controlled Extension Test Page</title></head>
<body><h1>Controlled Extension Test Page</h1>
<p>This local page is provided for defensive extension observation.</p>
<input id='fixture-user' type='text' value='synthetic-user' />
<input id='fixture-password' type='password' value='synthetic-password-not-real' />
<button id='fixture-action'>Test interaction</button>
<div id='fixture-observations'></div>
<script>
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== 'EXTENSION_FIXTURE_EVENT') return;
  fetch('/observe', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({kind:'page_message', data:String(event.data.data || '').slice(0,500)})});
});
</script></body></html>"""

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = min(int(self.headers.get("Content-Length", "0")), 8192)
        raw = self.rfile.read(length)
        self._record("POST")

        if self.path == "/observe":
            try:
                payload = json.loads(
                    raw.decode("utf-8", errors="replace")
                )
            except Exception:
                payload = {
                    "unparsed": raw.decode(
                        "utf-8", errors="replace"
                    )[:500]
                }

            append_bounded(
                type(self).observations,
                {
                    "timestamp": utc_now(),
                    "kind": "controlled_endpoint",
                    "payload": payload,
                },
            )

        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *_args):
        return


def start_fixture_server() -> ThreadingHTTPServer:
    """Start the local test website inside the worker container."""
    server = ThreadingHTTPServer(
        (FIXTURE_HOST, FIXTURE_PORT),
        FixtureHandler,
    )

    Thread(
        target=server.serve_forever,
        daemon=True,
    ).start()

    return server


def resolve_extension_path(relative_path: str) -> Path:
    candidate = (UPLOADS_ROOT / relative_path).resolve()

    if candidate != UPLOADS_ROOT and UPLOADS_ROOT not in candidate.parents:
        raise ValueError(
            "Extension path is outside the mounted uploads directory"
        )

    if not candidate.is_dir():
        raise ValueError("Extension directory does not exist")

    manifest = candidate / "manifest.json"

    if not manifest.is_file():
        raise ValueError("Extension manifest.json was not found")

    return candidate


def dom_observer_script() -> str:
    """Return a page-level observer that records metadata, never field values."""
    return r"""
    (() => {
      if (window.__extensionObservationInstalled) return;
      window.__extensionObservationInstalled = true;

      const PREFIX = "[EXTENSION_OBSERVATION] ";

      const report = (eventType, details = {}) => {
        try {
          console.info(PREFIX + JSON.stringify({
            event_type: eventType,
            timestamp: new Date().toISOString(),
            ...details
          }));
        } catch (_) {
          // Instrumentation must not interrupt page execution.
        }
      };

      const describeElement = (element) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
          return null;
        }

        return {
          tag: String(element.tagName || "").slice(0, 40),
          id: String(element.id || "").slice(0, 80),
          type: String(element.getAttribute("type") || "").slice(0, 40),
          name: String(element.getAttribute("name") || "").slice(0, 80),
          role: String(element.getAttribute("role") || "").slice(0, 40),
          aria_label: String(
            element.getAttribute("aria-label") || ""
          ).slice(0, 100)
        };
      };

      const inspectElement = (element) => {
        const details = describeElement(element);
        if (!details) return;

        report("dom_element_added", details);

        if (
          details.tag.toLowerCase() === "input" &&
          details.type.toLowerCase() === "password"
        ) {
          report("password_field_detected", details);
        }

        if (element.querySelectorAll) {
          const descendants = element.querySelectorAll("*");
          const limit = Math.min(descendants.length, 20);

          for (let index = 0; index < limit; index += 1) {
            const child = descendants[index];
            const childDetails = describeElement(child);

            if (!childDetails) continue;

            report("dom_descendant_added", childDetails);

            if (
              childDetails.tag.toLowerCase() === "input" &&
              childDetails.type.toLowerCase() === "password"
            ) {
              report("password_field_detected", childDetails);
            }
          }

          if (descendants.length > limit) {
            report("dom_scan_truncated", {
              inspected: limit,
              available: descendants.length
            });
          }
        }
      };

      const getEventElement = (event) => {
        const target = event && event.target;
        if (!target) return null;

        if (target.nodeType === Node.ELEMENT_NODE) {
          return target;
        }

        return target.parentElement || null;
      };

      // Both DOMContentLoaded and the early Document observer can become
      // ready during the same navigation. This guard ensures initialization
      // happens only once.
      let observerStarted = false;

      const startObserver = () => {
        if (observerStarted) return;

        if (!document.documentElement) {
          report("dom_observer_waiting_for_document");
          return;
        }

        observerStarted = true;

        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                inspectElement(node);
              }
            }

            if (
              record.type === "attributes" &&
              record.target &&
              record.target.nodeType === Node.ELEMENT_NODE
            ) {
              report("dom_attribute_changed", {
                attribute: record.attributeName || "",
                element: describeElement(record.target)
              });
            }
          }
        });

        observer.observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            "type",
            "name",
            "role",
            "aria-label",
            "href"
          ]
        });

        document.addEventListener("input", (event) => {
          const element = getEventElement(event);
          if (!element) return;

          report("form_input", {
            element: describeElement(element)
          });
        }, true);

        document.addEventListener("change", (event) => {
          const element = getEventElement(event);
          if (!element) return;

          report("form_change", {
            element: describeElement(element)
          });
        }, true);

        document.addEventListener("submit", (event) => {
          const element = getEventElement(event);

          report("form_submit", {
            element: describeElement(element)
          });
        }, true);

        document.addEventListener("click", (event) => {
          const element = getEventElement(event);
          if (!element || !element.closest) return;

          const interactive = element.closest(
            "button, a, input[type=button], input[type=submit], [role=button]"
          );

          if (!interactive) return;

          report("interactive_element_click", {
            element: describeElement(interactive)
          });
        }, true);

        report("dom_observer_started");

        inspectElement(document.documentElement);

        // Password fields already present in the document are reported by
        // inspectElement() above. Do not scan them a second time here.
      };

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          startObserver,
          { once: true }
        );
      } else {
        startObserver();
      }

      // Observe the Document node itself so initialization does not depend
      // on document.documentElement already existing.
      try {
        const earlyObserver = new MutationObserver(() => {
          if (document.documentElement) {
            earlyObserver.disconnect();
            startObserver();
          }
        });

        earlyObserver.observe(document, {
          childList: true,
          subtree: true
        });
      } catch (_) {
        // DOMContentLoaded remains the fallback.
      }
    })();
    """


async def execute_job(job: dict) -> dict:
    FixtureHandler.observations = []

    extension_path = resolve_extension_path(
        str(job["extension_relative_path"])
    )

    duration = max(
        5,
        min(
            int(job.get("duration", DEFAULT_DURATION)),
            MAX_DURATION,
        ),
    )

    logs = {
        "network": [],
        "network_responses": [],
        "network_failures": [],
        "dom": [],
    }

    configure_chromium_runtime()

    profile_dir = tempfile.mkdtemp(
        prefix="extension-profile-",
        dir="/work/tmp",
    )

    context = None
    fixture_server = None
    started = utc_now()

    try:
        fixture_server = start_fixture_server()

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                channel="chromium",
                headless=True,
                args=[
                    f"--disable-extensions-except={extension_path}",
                    f"--load-extension={extension_path}",
                    "--no-first-run",
                    "--disable-background-networking",
                    "--disable-component-update",
                    "--disable-sync",
                    "--disable-crash-reporter",
                    "--disable-breakpad",
                    "--mute-audio",
                ],
            )

            page = await context.new_page()

            page.on(
                "request",
                lambda req: append_bounded(
                    logs["network"],
                    {
                        "timestamp": utc_now(),
                        "url": req.url[:2000],
                        "method": req.method,
                        "resource_type": req.resource_type,
                    },
                ),
            )

            page.on(
                "response",
                lambda response: append_bounded(
                    logs["network_responses"],
                    {
                        "timestamp": utc_now(),
                        "url": response.url[:2000],
                        "status": response.status,
                        "status_text": response.status_text[:200],
                    },
                ),
            )

            page.on(
                "requestfailed",
                lambda req: append_bounded(
                    logs["network_failures"],
                    {
                        "timestamp": utc_now(),
                        "url": req.url[:2000],
                        "failure": str(req.failure or "")[:500],
                    },
                ),
            )

            def handle_console(message) -> None:
                message_text = message.text or ""

                if not message_text.startswith(OBSERVATION_PREFIX):
                    return

                raw_event = message_text[len(OBSERVATION_PREFIX):]

                try:
                    event = json.loads(raw_event)
                    if isinstance(event, dict):
                        append_bounded(logs["dom"], event)
                except (json.JSONDecodeError, TypeError):
                    append_bounded(
                        logs["dom"],
                        {
                            "event_type": "instrumentation_message_parse_error",
                            "timestamp": utc_now(),
                        },
                    )

            page.on("console", handle_console)

            page.on(
                "pageerror",
                lambda error: append_bounded(
                    logs["dom"],
                    {
                        "event_type": "javascript_page_error",
                        "timestamp": utc_now(),
                        "message": str(error)[:1000],
                    },
                ),
            )

            await page.add_init_script(dom_observer_script())

            await page.goto(
                f"http://{FIXTURE_HOST}:{FIXTURE_PORT}/",
                wait_until="domcontentloaded",
                timeout=10000,
            )

            await page.wait_for_timeout(duration * 1000)

            # Close while Playwright is still active. This avoids attempting
            # to close a context after its Playwright connection has ended.
            await context.close()
            context = None

        return {
            "success": True,
            "started_at": started,
            "completed_at": utc_now(),
            "duration_seconds": duration,
            "target": "controlled_local_fixture",
            "network_requests": logs["network"],
            "network_responses": logs["network_responses"],
            "network_failures": logs["network_failures"],
            "dom_events": logs["dom"],
            "controlled_endpoint_observations": FixtureHandler.observations,
            "limitations": [
                "The worker has no network interface; external network destinations are unreachable.",
                "Only the controlled local test page was visited.",
                "DOM observations record element metadata and event types, not entered field values.",
                "Observed network requests alone do not establish data exfiltration or malicious intent.",
                "This worker does not yet instrument every browser extension API or all background service-worker activity.",
                "Page-level DOM observations do not prove that an observed action was initiated by the extension.",
            ],
        }

    finally:
        if context is not None:
            try:
                await context.close()
            except Exception as close_error:
                print(
                    f"[WORKER] Browser cleanup warning: {close_error}",
                    flush=True,
                )

        if fixture_server is not None:
            try:
                fixture_server.shutdown()
                fixture_server.server_close()
            except Exception as fixture_error:
                print(
                    f"[WORKER] Fixture cleanup warning: {fixture_error}",
                    flush=True,
                )

        shutil.rmtree(profile_dir, ignore_errors=True)


def process_queue() -> None:
    for folder in ("inbox", "processing", "results"):
        (QUEUE_ROOT / folder).mkdir(
            parents=True,
            exist_ok=True,
        )

    while True:
        pending = sorted(
            (QUEUE_ROOT / "inbox").glob("*.json")
        )

        if not pending:
            time.sleep(0.5)
            continue

        source = pending[0]
        working = QUEUE_ROOT / "processing" / source.name

        try:
            source.replace(working)
        except FileNotFoundError:
            continue

        try:
            job = json.loads(
                working.read_text(encoding="utf-8")
            )

            result = asyncio.run(
                execute_job(job)
            )

        except Exception as exc:
            result = {
                "success": False,
                "completed_at": utc_now(),
                "error": str(exc),
                "traceback": traceback.format_exc(limit=8),
            }

        destination = QUEUE_ROOT / "results" / source.name
        temporary = destination.with_suffix(".tmp")

        temporary.write_text(
            json.dumps(result, ensure_ascii=False),
            encoding="utf-8",
        )

        temporary.replace(destination)
        working.unlink(missing_ok=True)


if __name__ == "__main__":
    process_queue()
