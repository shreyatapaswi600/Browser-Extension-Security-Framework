import os
from datetime import datetime

class HtmlGenerator:
    def __init__(self, report_dir="reports"):
        """রিপোর্ট সেভ করার জন্য ফোল্ডার সেটআপ করা"""
        self.report_dir = os.path.abspath(report_dir)
        os.makedirs(self.report_dir, exist_ok=True)

    def generate_report(self, report_name, data):
        """টেস্ট রেজাল্ট থেকে একটি HTML রিপোর্ট তৈরি করে"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{report_name}_report_{timestamp}.html"
        filepath = os.path.join(self.report_dir, filename)

        # HTML-এর বেসিক স্ট্রাকচার এবং CSS স্টাইলিং
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Extension Security Analyzer Report</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f4f7f6; color: #333; }}
                h1 {{ text-align: center; color: #2c3e50; }}
                .summary {{ background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }}
                table {{ width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                th, td {{ padding: 12px 15px; border: 1px solid #ddd; text-align: left; }}
                th {{ background-color: #34495e; color: white; text-transform: uppercase; font-size: 14px; }}
                tr:nth-child(even) {{ background-color: #f9f9f9; }}
                .vulnerable {{ color: #e74c3c; font-weight: bold; }}
                .safe {{ color: #27ae60; font-weight: bold; }}
                .error {{ color: #f39c12; }}
            </style>
        </head>
        <body>
            <h1>Extension Security Simulator Report</h1>

            <div class="summary">
                <h2>Scan Summary</h2>
                <p><strong>Module Name:</strong> {report_name}</p>
                <p><strong>Date & Time:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
                <p><strong>Total Tests Executed:</strong> {len(data) if data else 0}</p>
            </div>

            <h2>Detailed Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test / Payload ID</th>
                        <th>Status</th>
                        <th>Details / Observation</th>
                    </tr>
                </thead>
                <tbody>
        """

        # ডেটা থেকে টেবিলের রো (Row) তৈরি করা
        if not data:
            html_content += '<tr><td colspan="3" style="text-align:center;">No data available for this report.</td></tr>'
        else:
            for index, item in enumerate(data, start=1):
                # JSON/Dictionary এর কি (Key) অনুযায়ী ভ্যালু বের করা
                payload = item.get("payload", f"Test Case #{index}")
                is_vulnerable = item.get("vulnerable", False)
                error_msg = item.get("error", None)

                # স্ট্যাটাস নির্ধারণ করা
                if error_msg:
                    status_class = "error"
                    status_text = "ERROR"
                    details = str(error_msg)
                elif is_vulnerable:
                    status_class = "vulnerable"
                    status_text = "VULNERABLE"
                    details = "Security flaw detected with this payload."
                else:
                    status_class = "safe"
                    status_text = "SAFE"
                    details = "No vulnerability detected."

                html_content += f"""
                    <tr>
                        <td><code>{payload}</code></td>
                        <td class="{status_class}">{status_text}</td>
                        <td>{details}</td>
                    </tr>
                """

        # HTML ট্যাগগুলো ক্লোজ করা
        html_content += """
                </tbody>
            </table>
        </body>
        </html>
        """

        # ফাইলটি সেভ করা
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"[*] HTML Report generated successfully: {filepath}")
            return filepath
        except Exception as e:
            print(f"[-] Error generating HTML report: {e}")
            return None