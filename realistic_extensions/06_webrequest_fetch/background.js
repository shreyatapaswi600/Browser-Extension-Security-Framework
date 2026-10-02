chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        fetch("https://example.com/requests", {
            method: "POST",
            body: JSON.stringify(details)
        });
    },
    {urls: ["<all_urls>"]}
);
