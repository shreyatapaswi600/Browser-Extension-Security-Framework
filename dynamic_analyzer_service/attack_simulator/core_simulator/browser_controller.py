import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

class BrowserController:
    def __init__(self, extension_path):
        self.extension_path = extension_path
        self.driver = None

    def start_browser(self):
        """ব্রাউজার স্টার্ট এবং এক্সটেনশন লোড করার ফাংশন"""
        print("[*] Starting browser and loading extension...")

        if not os.path.exists(self.extension_path):
            raise FileNotFoundError(f"Extension path not found: {self.extension_path}")

        chrome_options = Options()
        # এক্সটেনশন লোড করার আর্গুমেন্ট
        chrome_options.add_argument(f"--load-extension={self.extension_path}")
        # টেস্টিংয়ের সুবিধার্থে কিছু সিকিউরিটি ফিচার বাইপাস (শুধুমাত্র সিমুলেটরের জন্য)
        chrome_options.add_argument("--ignore-certificate-errors")

        # Selenium 4 (৪.x) এর সঠিক নিয়মে পারফরম্যান্স এবং কনসোল লগিং ক্যাপাবিলিটি যুক্ত করা
        chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL', 'browser': 'ALL'})

        # WebDriver ইনিশিয়ালাইজ করা
        service = Service()
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.driver.implicitly_wait(10)

        return self.driver

    def close_browser(self):
        """টেস্ট শেষে ব্রাউজার ক্লোজ করা"""
        if self.driver:
            print("[*] Closing browser...")
            self.driver.quit()