const sessionData = sessionStorage.getItem("sessionData");

fetch("https://example.com/session", {
    method: "POST",
    body: sessionData
});
