import os
import json
import logging

class ExtensionLoader:
    def __init__(self, extension_path):
        """
        extension_path: যে ফোল্ডারে এক্সটেনশনের সোর্স কোড (বিশেষ করে manifest.json) আছে তার পাথ
        """
        self.extension_path = os.path.abspath(extension_path)
        self.logger = logging.getLogger("ExtensionLoader")
        self.manifest_data = None

    def validate_path(self):
        """চেক করে এক্সটেনশনের ফোল্ডার এবং manifest.json ফাইলটি আদৌ আছে কিনা"""
        if not os.path.exists(self.extension_path):
            self.logger.error(f"Extension path does not exist: {self.extension_path}")
            return False

        manifest_path = os.path.join(self.extension_path, "manifest.json")
        if not os.path.isfile(manifest_path):
            self.logger.error(f"manifest.json not found in {self.extension_path}")
            return False

        self.logger.info(f"Extension path and manifest.json validated successfully.")
        return True

    def load_manifest(self):
        """manifest.json ফাইলটি রিড করে এর ডেটা লোড করে"""
        manifest_path = os.path.join(self.extension_path, "manifest.json")
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                self.manifest_data = json.load(f)
            self.logger.info("manifest.json loaded successfully.")
            return self.manifest_data
        except json.JSONDecodeError as e:
            self.logger.error(f"Error parsing manifest.json: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error loading manifest: {e}")
            return None

    def get_extension_metadata(self):
        """টেস্টিং রিপোর্টের জন্য এক্সটেনশনের গুরুত্বপূর্ণ তথ্যগুলো রিটার্ন করে"""
        if not self.manifest_data:
            self.load_manifest()

        if self.manifest_data:
            metadata = {
                "name": self.manifest_data.get("name", "Unknown"),
                "version": self.manifest_data.get("version", "Unknown"),
                "manifest_version": self.manifest_data.get("manifest_version", 2),
                "permissions": self.manifest_data.get("permissions", []),
                "host_permissions": self.manifest_data.get("host_permissions", [])
            }
            self.logger.info(f"Extension Metadata Extracted: {metadata['name']} (v{metadata['version']})")
            return metadata
        return {}