import sys
import os

# ফোল্ডার পাথগুলো ঠিকঠাক ইমপোর্ট করার জন্য
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core_simulator.browser_controller import BrowserController
from test_vectors.message_fuzzer import MessageFuzzer
from reporting.json_reporter import JsonReporter
from reporting.html_generator import HtmlGenerator  # HTML জেনারেটর এখানে ইমপোর্ট করা হলো
from core_simulator.extension_loader import ExtensionLoader
from reporting.risk_scorer import RiskScorer
from utils.config_parser import ConfigParser

def main():
    print("=========================================")
    print("   Extension Security Simulator - v1.0   ")
    print("=========================================\n")

    # কনফিগারেশন লোড করা
    config_parser = ConfigParser(config_dir="config")

    # YAML থেকে সিমুলেটর সেটিংস লোড করা
    sim_settings = config_parser.load_yaml("simulator_config.yaml")

    # JSON থেকে টেস্ট পলিসি লোড করা
    test_policies = config_parser.load_json("test_policies.json")

    print(f"[*] Loaded timeout setting: {sim_settings.get('timeout', 10)} seconds\n")

    # এক্সটেনশনের পাথ দিন (যে ফোল্ডারে manifest.json আছে)
    EXTENSION_PATH = os.path.abspath("./sample_extension_folder")

    # ১. এক্সটেনশন ভ্যালিডেশন এবং মেটাডেটা লোড করা
    loader = ExtensionLoader(EXTENSION_PATH)
    if not loader.validate_path():
        print("[-] Error: Invalid extension path or missing manifest.json. Simulation aborted.")
        return

    metadata = loader.get_extension_metadata()
    print(f"[*] Testing Extension: {metadata.get('name', 'Unknown')}\n")

    # মডিউলগুলো ইনিশিয়ালাইজ করা
    controller = BrowserController(EXTENSION_PATH)
    json_reporter = JsonReporter()
    html_reporter = HtmlGenerator()  # HTML জেনারেটর ইনিশিয়ালাইজ করা হলো
    scorer = RiskScorer()

    try:
        # ২. ব্রাউজার স্টার্ট করা
        driver = controller.start_browser()

        # ৩. ফাজার (টেস্ট ভেক্টর) রান করা
        fuzzer = MessageFuzzer(driver)
        fuzz_results = fuzzer.run_fuzzer(target_url="https://example.com")

        # ৪. রিস্ক স্কোর ক্যালকুলেট করা (metadata আগের লোডার থেকে পাওয়া)
        risk_assessment = scorer.calculate_risk("message_fuzzing", fuzz_results, metadata)

        print("\n[+] Risk Assessment Completed:")
        print(f"    - Vulnerabilities Found: {risk_assessment['vulnerabilities_found']}")
        print(f"    - Risk Score: {risk_assessment['risk_score']} / 10")
        print(f"    - Risk Level: {risk_assessment['risk_level']}\n")

        # ৫. রিপোর্ট জেনারেট করা (JSON এবং HTML উভয়ই)
        json_reporter.generate_report("message_fuzzing", fuzz_results)
        html_reporter.generate_report("Message_Fuzzing", fuzz_results)

    except Exception as e:
        print(f"[-] Critical Error: {e}")

    finally:
        # ৬. শেষে ব্রাউজার ক্লোজ করা
        controller.close_browser()
        print("\n[*] Simulation Completed.")

if __name__ == "__main__":
    main()