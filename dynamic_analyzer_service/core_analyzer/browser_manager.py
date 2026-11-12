
import tempfile
import asyncio
import os
import shutil

from playwright.async_api import async_playwright

from interceptors.network_monitor import (
    log_network_request,
    log_network_response,
    log_network_failure
)

from interceptors.dom_observer import get_injection_script


class BrowserManager:

    def __init__(self, extension_path: str, target_url: str):
        self.extension_path = extension_path
        self.target_url = target_url

        self.logs = {
            "network": [],
            "network_responses": [],
            "network_failures": [],
            "dom": []
        }

    async def start_analysis(self, duration: int = 15):

        # Reset logs before every analysis run
        self.logs = {
            "network": [],
            "network_responses": [],
            "network_failures": [],
            "dom": []
        }

        abs_extension_path = os.path.abspath(self.extension_path)

        profile_dir = tempfile.mkdtemp(
            prefix="dynamic_analyzer_profile_"
        )

        context = None

        try:

            async with async_playwright() as p:

                context = await p.chromium.launch_persistent_context(
                    user_data_dir=profile_dir,
                    headless=False,
                    args=[
                        f"--disable-extensions-except={abs_extension_path}",
                        f"--load-extension={abs_extension_path}",
                        "--mute-audio"
                    ]
                )

                try:

                    page = await context.new_page()

                    # Monitor network requests
                    page.on(
                        "request",
                        lambda req: log_network_request(
                            req,
                            self.logs["network"]
                        )
                    )

                    # Monitor network responses
                    page.on(
                        "response",
                        lambda response: log_network_response(
                            response,
                            self.logs["network_responses"]
                        )
                    )

                    # Monitor failed network requests
                    page.on(
                        "requestfailed",
                        lambda req: log_network_failure(
                            req,
                            self.logs["network_failures"]
                        )
                    )

                    # Monitor DOM-related console events
                    page.on(
                        "console",
                        lambda msg: self._log_console(msg)
                    )

                    await page.add_init_script(
                        get_injection_script()
                    )

                    await page.goto(self.target_url)

                    await asyncio.sleep(duration)

                    return self.logs

                finally:

                    # Always close the browser context
                    if context is not None:
                        await context.close()

        finally:

            # Always remove the temporary browser profile
            shutil.rmtree(
                profile_dir,
                ignore_errors=True
            )

    def _log_console(self, msg):

        if "[HOOK]" in msg.text:
            self.logs["dom"].append(msg.text)
