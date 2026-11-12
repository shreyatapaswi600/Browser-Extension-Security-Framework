
"""VirtualBox sandbox readiness checks.

This module verifies selected VM isolation settings.
It does not start the VM or execute browser extensions.

Dynamic execution remains disabled until the complete
sandbox execution and isolation pipeline is implemented
and independently validated.
"""

import re
import subprocess
from pathlib import Path
from typing import Any


# Actual Oracle VirtualBox installation on this system.
VBOXMANAGE = Path(r"D:\Virtual box\VBoxManage.exe")

VM_NAME = "BrowserAnalysisSandbox"
EXPECTED_NETWORK = "MalwareLab"


class SandboxNotReady(RuntimeError):
    """Raised when the VM cannot be inspected or fails readiness checks."""


def _run_vbox(*args: str) -> str:
    """Execute a VirtualBox management command safely."""

    if not VBOXMANAGE.is_file():
        raise SandboxNotReady(
            f"VBoxManage.exe was not found: {VBOXMANAGE}"
        )

    try:
        result = subprocess.run(
            [str(VBOXMANAGE), *args],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

    except subprocess.TimeoutExpired as exc:
        raise SandboxNotReady(
            "VirtualBox command timed out."
        ) from exc

    except OSError as exc:
        raise SandboxNotReady(
            f"Could not execute VBoxManage: {exc}"
        ) from exc

    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip()
        raise SandboxNotReady(
            f"VirtualBox command failed: {error}"
        )

    return result.stdout


def _parse_machine_readable(output: str) -> dict[str, str]:
    """Parse VirtualBox machine-readable key=value output."""

    settings = {}

    for line in output.splitlines():
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        settings[key.strip()] = value.strip().strip('"')

    return settings


def _is_disabled(value: str | None) -> bool:
    """Treat omitted or explicitly disabled settings as disabled."""

    return value is None or value.lower() in {
        "none",
        "off",
        "disabled",
        "false",
        "",
    }


def _has_shared_folders(settings: dict[str, str]) -> bool:
    """Check machine-readable shared-folder configuration."""

    return any(
        key.startswith(
            (
                "SharedFolderNameMachineMapping",
                "SharedFolderPathMachineMapping",
            )
        )
        for key in settings
    )


def check_sandbox_readiness() -> dict[str, Any]:
    """
    Inspect VM configuration without starting it or running samples.

    Passing these checks does not authorize extension execution.
    """

    machine_info = _run_vbox(
        "showvminfo",
        VM_NAME,
        "--machinereadable",
    )

    readable_info = _run_vbox(
        "showvminfo",
        VM_NAME,
    )

    settings = _parse_machine_readable(machine_info)

    # Verify Adapter 1 using both machine-readable and
    # human-readable VirtualBox output.
    adapter_1_isolated = (
        settings.get("nic1") == "intnet"
        and settings.get("intnet1") == EXPECTED_NETWORK
        and settings.get("cableconnected1") == "on"
        and re.search(
            r"NIC 1:.*Promisc Policy:\s*deny",
            readable_info,
            re.IGNORECASE,
        ) is not None
    )

    # Adapters 2-8 must be disabled.
    additional_adapters_disabled = all(
        _is_disabled(settings.get(f"nic{number}"))
        for number in range(2, 9)
    )

    # Verify shared-folder configuration.
    shared_folders_absent = not _has_shared_folders(settings)

    # Verify recording is disabled and stopped.
    recording_inactive = (
        _is_disabled(settings.get("recording_enabled"))
        and _is_disabled(settings.get("recording_started"))
    )

    checks = {
        "vm_powered_off": (
            settings.get("VMState") == "poweroff"
        ),

        "adapter_1_isolated": adapter_1_isolated,

        "additional_adapters_disabled": (
            additional_adapters_disabled
        ),

        "network_configuration_valid": (
            adapter_1_isolated
            and additional_adapters_disabled
        ),

        "clipboard_disabled": (
            settings.get("clipboard") == "disabled"
        ),

        "clipboard_file_transfers_disabled": (
            _is_disabled(
                settings.get("clipboard_file_transfers")
            )
        ),

        "drag_drop_disabled": (
            settings.get("draganddrop") == "disabled"
        ),

        "shared_folders_absent": shared_folders_absent,

        "usb_disabled": (
            _is_disabled(settings.get("usb"))
            and _is_disabled(settings.get("ehci"))
            and _is_disabled(settings.get("xhci"))
        ),

        "remote_display_disabled": (
            _is_disabled(settings.get("vrde"))
        ),

        "recording_inactive": recording_inactive,

        "audio_playback_disabled": (
            _is_disabled(settings.get("audio_out"))
        ),

        "audio_capture_disabled": (
            _is_disabled(settings.get("audio_in"))
        ),
    }

    ready = all(checks.values())

    return {
        "vm_name": VM_NAME,
        "vm_state": settings.get("VMState"),
        "checks": checks,
        "ready": ready,

        # Execution must remain disabled until the
        # complete sandbox pipeline is independently validated.
        "execution_enabled": False,

        "message": (
            "Basic VM configuration checks passed. "
            "Guest-level and execution isolation validation "
            "are still required."
            if ready
            else (
                "Sandbox is not ready. One or more isolation "
                "checks failed. Extension execution remains disabled."
            )
        ),
    }
