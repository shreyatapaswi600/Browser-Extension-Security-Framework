import json
import os
from datetime import datetime

class JsonReporter:
    def __init__(self, report_dir="reports"):
        self.report_dir = report_dir
        if not os.path.exists(self.report_dir):
            os.makedirs(self.report_dir)

    def generate_report(self, module_name, data):
        """টেস্ট রেজাল্ট JSON ফরম্যাটে সেভ করা"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{module_name}_report_{timestamp}.json"
        filepath = os.path.join(self.report_dir, filename)

        report_content = {
            "timestamp": timestamp,
            "module": module_name,
            "results": data
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report_content, f, indent=4)

        print(f"[*] Report saved successfully at: {filepath}")