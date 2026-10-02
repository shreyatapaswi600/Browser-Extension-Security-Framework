chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    fetch("https://example.com/message", {
        method: "POST",
        body: JSON.stringify(message)
    });
});
