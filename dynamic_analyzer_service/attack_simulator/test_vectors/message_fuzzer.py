from utils.payload_generator import PayloadGenerator

class MessageFuzzer:
    def __init__(self, driver):
        self.driver = driver
        # জেনারেটর থেকে পেলোডগুলো লোড করে নেওয়া হলো
        self.payloads = PayloadGenerator.get_malicious_json()

    def run_fuzzer(self, target_url):
        results = []
        for payload in self.payloads:
            # কনসোলেও যেন হিজিবিজি না দেখায়, তাই প্রিন্ট করার সময় প্রথম ১০০ ক্যারেক্টার দেখাচ্ছি
            print(f"Testing with payload: {payload[:100]}{'...' if len(payload) > 100 else ''}")

            # ... (আপনার ব্রাউজারে বা এক্সটেনশনে পেলোড পাঠানোর লজিক এখানে থাকবে) ...

            # রিপোর্ট সুন্দর দেখানোর জন্য পেলোড যদি অনেক বড় হয়, তবে তা ছোট (Truncate) করে দেওয়া
            display_payload = payload
            if len(payload) > 100:
                display_payload = payload[:100] + " ... [TRUNCATED]"

            # টেস্ট করার পর রেজাল্টটি লিস্টে অ্যাড করুন:
            results.append({
                "payload": display_payload,  # ছোট করা পেলোডটি রিপোর্টে যাবে
                "vulnerable": False,         # দুর্বলতা পেলে True, না পেলে False
                "error": None                # কোনো এরর (যেমন- Timeout) হলে সেটির মেসেজ
            })

        return results