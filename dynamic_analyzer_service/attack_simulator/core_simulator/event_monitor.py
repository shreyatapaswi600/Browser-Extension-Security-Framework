import json
import logging
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

class EventMonitor:
    def __init__(self, driver):
        self.driver = driver
        self.logger = logging.getLogger("EventMonitor")

    def get_console_logs(self):
        """ব্রাউজারের কনসোল লগগুলো (Error, Warning, Info) সংগ্রহ করে"""
        logs = []
        try:
            # Selenium-এর মাধ্যমে ব্রাউজারের লগ ফেচ করা
            for entry in self.driver.get_log('browser'):
                logs.append(entry)
                # লেভেল অনুযায়ী লগ প্রিন্ট করা
                if entry['level'] == 'SEVERE':
                    self.logger.error(f"Console Error: {entry['message']}")
                else:
                    self.logger.info(f"Console Log: {entry['message']}")
        except Exception as e:
            self.logger.error(f"Error fetching console logs: {e}")
        return logs

    def get_network_logs(self):
        """ব্রাউজারের পারফরম্যান্স এবং নেটওয়ার্ক রিকোয়েস্ট লগগুলো সংগ্রহ করে"""
        network_logs = []
        try:
            # পারফরম্যান্স লগ থেকে নেটওয়ার্ক ইভেন্ট বের করা
            logs = self.driver.get_log('performance')
            for entry in logs:
                log_data = json.loads(entry['message'])['message']

                # শুধুমাত্র Network সম্পর্কিত রিকোয়েস্ট বা রেসপন্স ফিল্টার করা
                if log_data['method'].startswith('Network'):
                    network_logs.append(log_data)
                    self.logger.debug(f"Network Event: {log_data['method']}")
        except Exception as e:
            self.logger.error(f"Error fetching network logs: {e}")
        return network_logs

    def analyze_logs(self):
        """সংগৃহীত লগগুলো অ্যানালাইজ করে কোনো সন্দেহজনক অ্যাক্টিভিটি খোঁজে"""
        console_logs = self.get_console_logs()
        network_logs = self.get_network_logs()

        findings = {
            "suspicious_console_errors": len([log for log in console_logs if log.get('level') == 'SEVERE']),
            "total_network_requests": len(network_logs),
            "raw_console_logs": console_logs,
            "raw_network_logs": network_logs
        }

        return findings