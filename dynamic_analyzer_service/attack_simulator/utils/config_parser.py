import os
import json
import ruamel.yaml as yaml
import logging

class ConfigParser:
    def __init__(self, config_dir="config"):
        """
        কনফিগারেশন ফোল্ডারের পাথ সেটআপ করা।
        ডিফল্টভাবে এটি মেইন ডিরেক্টরির 'config' ফোল্ডার খুঁজবে।
        """
        self.config_dir = os.path.abspath(config_dir)
        self.logger = logging.getLogger("ConfigParser")

    def load_yaml(self, filename):
        """YAML কনফিগারেশন ফাইল (যেমন- simulator_config.yaml) লোড করে"""
        filepath = os.path.join(self.config_dir, filename)

        if not os.path.exists(filepath):
            self.logger.error(f"[-] Config file not found: {filepath}")
            return {}

        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                config = yaml.safe_load(file)
                self.logger.info(f"[*] Loaded YAML config from {filename}")
                return config if config else {}
        except yaml.YAMLError as e:
            self.logger.error(f"[-] Error parsing YAML config {filename}: {e}")
            return {}
        except Exception as e:
            self.logger.error(f"[-] Unexpected error loading {filename}: {e}")
            return {}

    def load_json(self, filename):
        """JSON পলিসি বা কনফিগারেশন ফাইল (যেমন- test_policies.json) লোড করে"""
        filepath = os.path.join(self.config_dir, filename)

        if not os.path.exists(filepath):
            self.logger.error(f"[-] Config file not found: {filepath}")
            return {}

        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                config = json.load(file)
                self.logger.info(f"[*] Loaded JSON config from {filename}")
                return config if config else {}
        except json.JSONDecodeError as e:
            self.logger.error(f"[-] Error parsing JSON config {filename}: {e}")
            return {}
        except Exception as e:
            self.logger.error(f"[-] Unexpected error loading {filename}: {e}")
            return {}