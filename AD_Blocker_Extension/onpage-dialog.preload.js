/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/core/messaging/shared/emitter.ts
class MessageEmitter {
    constructor() {
        this.listeners = new Set();
    }
    addListener(listener) {
        this.listeners.add(listener);
    }
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    dispatch(message, sender) {
        const results = [];
        for (const listener of this.listeners) {
            results.push(listener(message, sender));
        }
        return results;
    }
}

;// ./src/core/messaging/shared/messaging.ts
function getMessageResponse(responses) {
    for (const response of responses) {
        if (typeof response !== "undefined") {
            return response;
        }
    }
}
function isEventMessage(candidate) {
    return isMessage(candidate) && "action" in candidate && "args" in candidate;
}
function isMessage(candidate) {
    return (candidate !== null && typeof candidate === "object" && "type" in candidate);
}
function isListenMessage(candidate) {
    return isMessage(candidate) && "filter" in candidate;
}
function isPremiumSubscriptionsAddRemoveOptions(candidate) {
    return (candidate !== null &&
        typeof candidate === "object" &&
        "subscriptionType" in candidate);
}

;// ./src/core/messaging/front/messaging.ts

let port;
const connectListeners = new Set();
const disconnectListeners = new Set();
const messageListeners = new Set();
const messageEmitter = new MessageEmitter();
function addConnectListener(listener) {
    connectListeners.add(listener);
    listener();
}
function addDisconnectListener(listener) {
    disconnectListeners.add(listener);
}
function addMessageListener(listener) {
    messageListeners.add(listener);
}
const connect = () => {
    if (port) {
        return port;
    }
    try {
        port = browser.runtime.connect({ name: "ui" });
    }
    catch (ex) {
        port = null;
        disconnectListeners.forEach((listener) => {
            listener();
        });
        return port;
    }
    port.onMessage.addListener((message) => {
        if (!isMessage(message)) {
            return;
        }
        onMessage(message);
    });
    port.onDisconnect.addListener(onDisconnect);
    connectListeners.forEach((listener) => {
        listener();
    });
    return port;
};
function isContentScript() {
    const extensionUrl = new URL(browser.runtime.getURL("/"));
    return location.protocol !== extensionUrl.protocol;
}
function listen({ type, filter, ...options }) {
    addConnectListener(() => {
        if (port) {
            port.postMessage({
                type: `${type}.listen`,
                filter,
                ...options
            });
        }
    });
}
function onDisconnect() {
    port = null;
    setTimeout(() => connect(), 100);
}
function onMessage(message) {
    if (!message.type.endsWith(".respond")) {
        return;
    }
    messageListeners.forEach((listener) => {
        listener(message);
    });
}
function removeDisconnectListener(listener) {
    disconnectListeners.delete(listener);
}
function start() {
    if (!isContentScript()) {
        connect();
    }
    if (typeof browser.devtools === "undefined") {
        browser.runtime.onMessage.addListener((message, sender) => {
            if (!isMessage(message)) {
                return;
            }
            const responses = messageEmitter.dispatch(message, sender);
            const response = getMessageResponse(responses);
            if (typeof response === "undefined") {
                return;
            }
            return Promise.resolve(response);
        });
    }
}
start();

;// ./src/core/messaging/front/category-app.ts
/* unused harmony import specifier */ var messaging;
/* unused harmony import specifier */ var send;


const platformToStore = new Map([
    ["chromium", "chrome"],
    ["edgehtml", "edge"],
    ["gecko", "firefox"]
]);
async function get(what) {
    const options = { what };
    return await send("app.get", options);
}
async function getInfo() {
    var _a;
    const [application, platform] = await Promise.all([
        get("application"),
        get("platform")
    ]);
    let store;
    if (application !== "edge" && application !== "opera") {
        store = (_a = platformToStore.get(platform)) !== null && _a !== void 0 ? _a : "chrome";
    }
    else {
        store = application;
    }
    return {
        application,
        manifestVersion: browser.runtime.getManifest().manifest_version,
        platform,
        store
    };
}
function category_app_listen(filter) {
    messaging.listen({ type: "app", filter });
}
async function category_app_open(what, parameters = {}) {
    const options = { what, ...parameters };
    await send("app.open", options);
}
async function getAdFilteringState() {
    return await send("app.getAdFilteringState");
}
async function category_app_close() {
    await send("app.close");
}

;// ./src/core/messaging/front/category-filters.ts
/* unused harmony import specifier */ var category_filters_messaging;
/* unused harmony import specifier */ var category_filters_send;


async function category_filters_get() {
    return await category_filters_send("filters.get");
}
function category_filters_listen(filter) {
    category_filters_messaging.listen({ type: "filters", filter });
}

;// ./src/core/messaging/front/category-prefs.ts
/* unused harmony import specifier */ var category_prefs_messaging;
/* unused harmony import specifier */ var category_prefs_send;


async function category_prefs_get(key) {
    const options = { key };
    return await category_prefs_send("prefs.get", options);
}
function category_prefs_listen(filter) {
    category_prefs_messaging.listen({ type: "prefs", filter });
}

;// ./src/core/messaging/front/category-premium.ts
/* unused harmony import specifier */ var category_premium_messaging;
/* unused harmony import specifier */ var category_premium_send;


async function add(subscriptionType) {
    const options = { subscriptionType };
    await category_premium_send("premium.subscriptions.add", options);
}
async function category_premium_get() {
    return await category_premium_send("premium.get");
}
async function getPremiumSubscriptionsState() {
    return await category_premium_send("premium.subscriptions.getState");
}
function category_premium_listen(filter) {
    category_premium_messaging.listen({ type: "premium", filter });
}
async function remove(subscriptionType) {
    const options = { subscriptionType };
    await category_premium_send("premium.subscriptions.remove", options);
}

;// ./src/core/messaging/front/category-requests.ts
/* unused harmony import specifier */ var category_requests_messaging;

function category_requests_listen(filter, tabId) {
    category_requests_messaging.listen({ type: "requests", filter, tabId });
}

;// ./src/core/messaging/front/category-stats.ts
/* unused harmony import specifier */ var category_stats_messaging;
/* unused harmony import specifier */ var category_stats_send;


async function getBlockedPerPage(tab) {
    const options = { tab };
    return await category_stats_send("stats.getBlockedPerPage", options);
}
async function getBlockedTotal() {
    return await category_stats_send("stats.getBlockedTotal");
}
function category_stats_listen(filter) {
    category_stats_messaging.listen({ type: "stats", filter });
}

;// ./src/core/messaging/front/category-subscriptions.ts
/* unused harmony import specifier */ var category_subscriptions_messaging;
/* unused harmony import specifier */ var category_subscriptions_send;


async function category_subscriptions_add(url) {
    const options = { url };
    return await category_subscriptions_send("subscriptions.add", options);
}
async function category_subscriptions_get(options) {
    return await category_subscriptions_send("subscriptions.get", options !== null && options !== void 0 ? options : {});
}
async function getInitIssues() {
    return await category_subscriptions_send("subscriptions.getInitIssues");
}
async function getRecommendations() {
    return await category_subscriptions_send("subscriptions.getRecommendations");
}
function category_subscriptions_listen(filter) {
    category_subscriptions_messaging.listen({ type: "subscriptions", filter });
}
async function category_subscriptions_remove(url) {
    const options = { url };
    await category_subscriptions_send("subscriptions.remove", options);
}

;// ./src/core/messaging/front/index.ts




















;// ./src/unload-cleanup/content/unload-cleanup.ts
async function prepareElementForUnload(element, displayValue) {
    const message = {
        type: "unload-cleanup.getClassName"
    };
    const className = await browser.runtime.sendMessage(message);
    if (typeof className === "undefined") {
        return;
    }
    element.classList.add(`${className}--${displayValue}`);
    element.style.display = "none";
}

;// ./src/unload-cleanup/shared/unload-cleanup.types.ts
var DisplayValue;
(function (DisplayValue) {
    DisplayValue["block"] = "block";
})(DisplayValue || (DisplayValue = {}));
const displayValueList = Object.values(DisplayValue);

;// ./src/unload-cleanup/shared/index.ts



;// ./src/onpage-dialog/content/frame-manager.ts




let iframe = null;
let overlay = null;
function handleMessage(message) {
    if (!isMessage(message)) {
        return;
    }
    switch (message.type) {
        case "onpage-dialog.hide":
            hideDialog();
            break;
        case "onpage-dialog.resize":
            if (!iframe) {
                break;
            }
            if (!isResizeMessage(message)) {
                break;
            }
            iframe.style.setProperty("--abp-overlay-onpage-dialog-height", `${message.height}px`);
            break;
        case "onpage-dialog.show":
            if (!isShowMessage(message)) {
                break;
            }
            showDialog(message.platform);
            break;
        default:
    }
}
function hideDialog() {
    if (overlay === null || overlay === void 0 ? void 0 : overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
    iframe = null;
    overlay = null;
}
function isResizeMessage(message) {
    return message.type === "onpage-dialog.resize" && "height" in message;
}
function isShowMessage(message) {
    return message.type === "onpage-dialog.show" && "platform" in message;
}
function showDialog(platform) {
    hideDialog();
    overlay = document.createElement("div");
    overlay.setAttribute("id", "__abp-overlay-onpage-dialog");
    iframe = document.createElement("iframe");
    iframe.setAttribute("frameborder", "0");
    if (platform !== "gecko") {
        iframe.setAttribute("sandbox", "");
    }
    iframe.addEventListener("load", () => {
        if (!(iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow)) {
            return;
        }
        iframe.contentWindow.postMessage("onpage-dialog.start", "*");
    });
    overlay.appendChild(iframe);
    const container = document.body && document.body.tagName !== "FRAMESET"
        ? document.body
        : document.documentElement;
    container.appendChild(overlay);
    void prepareElementForUnload(overlay, DisplayValue.block);
    if (platform === "gecko") {
        iframe.setAttribute("sandbox", "");
    }
}
function frame_manager_start() {
    browser.runtime.onMessage.addListener(handleMessage);
    addDisconnectListener(() => {
        stop();
    });
}
function stop() {
    browser.runtime.onMessage.removeListener(handleMessage);
    hideDialog();
}
frame_manager_start();

;// ./src/onpage-dialog/content/index.ts


/******/ })()
;
//# sourceMappingURL=onpage-dialog.preload.js.map