import json
import os


def analyze_manifest(extension_path):
    manifest_path = os.path.join(extension_path, "manifest.json")

    if not os.path.exists(manifest_path):
        return {
            "error": "manifest.json not found"
        }

    try:
        with open(manifest_path, "r", encoding="utf-8") as file:
            manifest = json.load(file)

    except json.JSONDecodeError as error:
        return {
            "error": f"Invalid manifest.json: {error}"
        }

    result = {
        "name": manifest.get("name", "Unknown"),
        "version": manifest.get("version", "Unknown"),
        "manifest_version": manifest.get(
            "manifest_version",
            "Unknown"
        ),

        # These are collected as context.
        # They are NOT automatically considered malicious.
        "permissions": manifest.get("permissions", []),
        "host_permissions": manifest.get(
            "host_permissions",
            []
        ),

        "content_scripts": manifest.get(
            "content_scripts",
            []
        ),

        "background": manifest.get(
            "background",
            {}
        )
    }

    return result