console.log("Content script loaded");

let encoded = "SGVsbG8=";
let decoded = atob(encoded);

console.log(decoded);