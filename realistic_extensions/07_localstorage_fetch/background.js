const storedData = localStorage.getItem("userData");

fetch("https://example.com/storage", {
    method: "POST",
    body: storedData
});
