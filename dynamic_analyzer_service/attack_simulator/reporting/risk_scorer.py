class RiskScorer:
    def __init__(self):
        # বিভিন্ন অ্যাটাক মডিউলের জন্য ডিফল্ট রিস্ক স্কোর (০ থেকে ১০ এর মধ্যে)
        self.vuln_base_scores = {
            "message_fuzzing": 6.5,
            "xss": 8.5,
            "csrf": 7.0,
            "dom_manipulation": 7.5
        }

        # কিছু ঝুঁকিপূর্ণ পারমিশন যা এক্সটেনশনে থাকলে রিস্ক বেড়ে যায়
        self.critical_permissions = [
            "<all_urls>", "tabs", "cookies",
            "webRequest", "webRequestBlocking", "storage"
        ]

    def calculate_risk(self, module_name, test_results, metadata=None):
        """
        টেস্ট রেজাল্ট এবং মেটাডেটার ওপর ভিত্তি করে ফাইনাল রিস্ক স্কোর ক্যালকুলেট করে।
        """
        total_score = 0.0
        vulnerabilities_found = 0

        # ১. টেস্ট রেজাল্টে কোনো দুর্বলতা পাওয়া গেছে কিনা তা চেক করা
        for result in test_results:
            if result.get("vulnerable") == True:
                vulnerabilities_found += 1

        # ২. যদি দুর্বলতা পাওয়া যায়, তবে মডিউল অনুযায়ী বেস স্কোর যোগ করা
        if vulnerabilities_found > 0:
            # মডিউলের নাম অনুযায়ী স্কোর নেওয়া, না পেলে ডিফল্ট ৫.০ ধরা
            base_score = self.vuln_base_scores.get(module_name.lower(), 5.0)
            total_score += base_score

        # ৩. মেটাডেটা (পারমিশন) চেক করে স্কোর আপডেট করা
        if metadata and "permissions" in metadata:
            extension_permissions = metadata["permissions"]
            for perm in self.critical_permissions:
                if perm in extension_permissions:
                    # প্রতিটি ঝুঁকিপূর্ণ পারমিশনের জন্য ০.৫ করে রিস্ক বাড়ানো হবে
                    total_score += 0.5

        # ৪. স্কোর যেন কোনোভাবেই ১০-এর বেশি না হয় তা নিশ্চিত করা
        final_score = min(total_score, 10.0)

        # ৫. স্কোরের ওপর ভিত্তি করে রিস্ক লেভেল (Risk Level) ঠিক করা
        if vulnerabilities_found == 0:
            risk_level = "SAFE"
            final_score = 0.0
        elif final_score >= 8.0:
            risk_level = "CRITICAL"
        elif final_score >= 6.0:
            risk_level = "HIGH"
        elif final_score >= 4.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "module": module_name,
            "vulnerabilities_found": vulnerabilities_found,
            "risk_score": round(final_score, 2),
            "risk_level": risk_level
        }