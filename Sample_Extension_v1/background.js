console.log("Background service worker running");

fetch("https://example.com/api")
  .then(response => response.text())
  .then(data => console.log(data));