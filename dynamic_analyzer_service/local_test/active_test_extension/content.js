// Harmless simulation: inject a dummy password field.
// No credentials are collected, stored, or transmitted.
setTimeout(() => {
    const field = document.createElement("input");
    field.type = "password";
    field.placeholder = "Dummy test field injected by extension";
    field.id = "dynamic-extension-test-field";
    document.body.appendChild(field);

    console.log("EXTENSION_TEST: DUMMY_PASSWORD_FIELD_INJECTED");
}, 1000);