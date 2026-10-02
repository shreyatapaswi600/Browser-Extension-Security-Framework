chrome.storage.local.get(["settings"], function(result) {
    console.log(result.settings);
});
