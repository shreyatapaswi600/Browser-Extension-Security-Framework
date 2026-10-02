/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 3651
(module, __unused_webpack_exports, __webpack_require__) {


if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) {
    throw new Error("This script should only be loaded in a browser extension.");
}
if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
    const ERROR_TO_IGNORE = `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`;
    const wrapAPIs = extensionAPIs => {
        const apiMetadata = __webpack_require__(2058);
        if (Object.keys(apiMetadata).length === 0) {
            throw new Error("api-metadata.json has not been included in browser-polyfill");
        }
        class DefaultWeakMap extends WeakMap {
            constructor(createItem, items = undefined) {
                super(items);
                this.createItem = createItem;
            }
            get(key) {
                if (!this.has(key)) {
                    this.set(key, this.createItem(key));
                }
                return super.get(key);
            }
        }
        const isThenable = value => {
            return value && typeof value === "object" && typeof value.then === "function";
        };
        const makeCallback = (promise, metadata) => {
            let error = new Error();
            return (...callbackArgs) => {
                if (extensionAPIs.runtime.lastError) {
                    error.message = extensionAPIs.runtime.lastError.message;
                    promise.reject(error);
                }
                else if (metadata.singleCallbackArg ||
                    (callbackArgs.length <= 1 && metadata.singleCallbackArg !== false)) {
                    promise.resolve(callbackArgs[0]);
                }
                else {
                    promise.resolve(callbackArgs);
                }
            };
        };
        const pluralizeArguments = (numArgs) => numArgs == 1 ? "argument" : "arguments";
        const wrapAsyncFunction = (name, metadata) => {
            return function asyncFunctionWrapper(target, ...args) {
                if (args.length < metadata.minArgs) {
                    throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
                }
                if (args.length > metadata.maxArgs) {
                    throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
                }
                return new Promise((resolve, reject) => {
                    if (metadata.fallbackToNoCallback) {
                        try {
                            target[name](...args, makeCallback({ resolve, reject }, metadata));
                        }
                        catch (cbError) {
                            console.warn(`${name} API method doesn't seem to support the callback parameter, ` +
                                "falling back to call it without a callback: ", cbError);
                            target[name](...args);
                            metadata.fallbackToNoCallback = false;
                            metadata.noCallback = true;
                            resolve();
                        }
                    }
                    else if (metadata.noCallback) {
                        target[name](...args);
                        resolve();
                    }
                    else {
                        target[name](...args, makeCallback({ resolve, reject }, metadata));
                    }
                });
            };
        };
        const wrapMethod = (target, method, wrapper) => {
            return new Proxy(method, {
                apply(targetMethod, thisObj, args) {
                    return wrapper.call(thisObj, target, ...args);
                },
            });
        };
        let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
        const wrapObject = (target, wrappers = {}, metadata = {}) => {
            let cache = Object.create(null);
            let handlers = {
                has(proxyTarget, prop) {
                    return prop in target || prop in cache;
                },
                get(proxyTarget, prop, receiver) {
                    if (prop in cache) {
                        return cache[prop];
                    }
                    if (!(prop in target)) {
                        return undefined;
                    }
                    let value = target[prop];
                    if (typeof value === "function") {
                        if (typeof wrappers[prop] === "function") {
                            value = wrapMethod(target, target[prop], wrappers[prop]);
                        }
                        else if (hasOwnProperty(metadata, prop)) {
                            let wrapper = wrapAsyncFunction(prop, metadata[prop]);
                            value = wrapMethod(target, target[prop], wrapper);
                        }
                        else {
                            value = value.bind(target);
                        }
                    }
                    else if (typeof value === "object" && value !== null &&
                        (hasOwnProperty(wrappers, prop) ||
                            hasOwnProperty(metadata, prop))) {
                        value = wrapObject(value, wrappers[prop], metadata[prop]);
                    }
                    else if (hasOwnProperty(metadata, "*")) {
                        value = wrapObject(value, wrappers[prop], metadata["*"]);
                    }
                    else {
                        Object.defineProperty(cache, prop, {
                            configurable: true,
                            enumerable: true,
                            get() {
                                return target[prop];
                            },
                            set(value) {
                                target[prop] = value;
                            },
                        });
                        return value;
                    }
                    cache[prop] = value;
                    return value;
                },
                set(proxyTarget, prop, value, receiver) {
                    if (prop in cache) {
                        cache[prop] = value;
                    }
                    else {
                        target[prop] = value;
                    }
                    return true;
                },
                defineProperty(proxyTarget, prop, desc) {
                    return Reflect.defineProperty(cache, prop, desc);
                },
                deleteProperty(proxyTarget, prop) {
                    return Reflect.deleteProperty(cache, prop);
                },
            };
            let proxyTarget = Object.create(target);
            return new Proxy(proxyTarget, handlers);
        };
        const wrapEvent = wrapperMap => ({
            addListener(target, listener, ...args) {
                target.addListener(wrapperMap.get(listener), ...args);
            },
            hasListener(target, listener) {
                return target.hasListener(wrapperMap.get(listener));
            },
            removeListener(target, listener) {
                target.removeListener(wrapperMap.get(listener));
            },
        });
        const onRequestFinishedWrappers = new DefaultWeakMap(listener => {
            if (typeof listener !== "function") {
                return listener;
            }
            return function onRequestFinished(req) {
                const wrappedReq = wrapObject(req, {}, {
                    getContent: {
                        minArgs: 0,
                        maxArgs: 0,
                    },
                });
                listener(wrappedReq);
            };
        });
        const onMessageWrappers = new DefaultWeakMap(listener => {
            if (typeof listener !== "function") {
                return listener;
            }
            return function onMessage(message, sender, sendResponse) {
                let didCallSendResponse = false;
                let wrappedSendResponse;
                let sendResponsePromise = new Promise(resolve => {
                    wrappedSendResponse = function (response) {
                        didCallSendResponse = true;
                        resolve(response);
                    };
                });
                let result;
                try {
                    result = listener(message, sender, wrappedSendResponse);
                }
                catch (err) {
                    result = Promise.reject(err);
                }
                const isResultThenable = result !== true && isThenable(result);
                if (result !== true && !isResultThenable && !didCallSendResponse) {
                    return false;
                }
                const sendPromisedResult = (promise) => {
                    promise.then(msg => {
                        sendResponse(msg);
                    }, error => {
                        let message;
                        if (error && (error instanceof Error ||
                            typeof error.message === "string")) {
                            message = error.message;
                        }
                        else {
                            message = "An unexpected error occurred";
                        }
                        sendResponse({
                            __mozWebExtensionPolyfillReject__: true,
                            message,
                        });
                    }).catch(err => {
                        console.error("Failed to send onMessage rejected reply", err);
                    });
                };
                if (isResultThenable) {
                    sendPromisedResult(result);
                }
                else {
                    sendPromisedResult(sendResponsePromise);
                }
                return true;
            };
        });
        const wrappedSendMessageCallback = ({ reject, resolve }, reply) => {
            if (extensionAPIs.runtime.lastError) {
                if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE || extensionAPIs.runtime.lastError.message.includes(ERROR_TO_IGNORE)) {
                    resolve();
                }
                else {
                    reject(new Error(extensionAPIs.runtime.lastError.message));
                }
            }
            else if (reply && reply.__mozWebExtensionPolyfillReject__) {
                reject(new Error(reply.message));
            }
            else {
                resolve(reply);
            }
        };
        const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
            if (args.length < metadata.minArgs) {
                throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
            }
            if (args.length > metadata.maxArgs) {
                throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
            }
            return new Promise((resolve, reject) => {
                const wrappedCb = wrappedSendMessageCallback.bind(null, { resolve, reject });
                args.push(wrappedCb);
                apiNamespaceObj.sendMessage(...args);
            });
        };
        const staticWrappers = {
            devtools: {
                network: {
                    onRequestFinished: wrapEvent(onRequestFinishedWrappers),
                },
            },
            runtime: {
                onMessage: wrapEvent(onMessageWrappers),
                onMessageExternal: wrapEvent(onMessageWrappers),
                sendMessage: wrappedSendMessage.bind(null, "sendMessage", { minArgs: 1, maxArgs: 3 }),
            },
            tabs: {
                sendMessage: wrappedSendMessage.bind(null, "sendMessage", { minArgs: 2, maxArgs: 3 }),
            },
        };
        const settingMetadata = {
            clear: { minArgs: 1, maxArgs: 1 },
            get: { minArgs: 1, maxArgs: 1 },
            set: { minArgs: 1, maxArgs: 1 },
        };
        apiMetadata.privacy = {
            network: { "*": settingMetadata },
            services: { "*": settingMetadata },
            websites: { "*": settingMetadata },
        };
        return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
    };
    module.exports = wrapAPIs(chrome);
}
else {
    module.exports = globalThis.browser;
}


/***/ },

/***/ 2058
(module) {

module.exports = /*#__PURE__*/JSON.parse('{"alarms":{"clear":{"minArgs":0,"maxArgs":1},"clearAll":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0}},"bookmarks":{"create":{"minArgs":1,"maxArgs":1},"get":{"minArgs":1,"maxArgs":1},"getChildren":{"minArgs":1,"maxArgs":1},"getRecent":{"minArgs":1,"maxArgs":1},"getSubTree":{"minArgs":1,"maxArgs":1},"getTree":{"minArgs":0,"maxArgs":0},"move":{"minArgs":2,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeTree":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}},"browserAction":{"disable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"enable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"getBadgeBackgroundColor":{"minArgs":1,"maxArgs":1},"getBadgeText":{"minArgs":1,"maxArgs":1},"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"openPopup":{"minArgs":0,"maxArgs":0},"setBadgeBackgroundColor":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setBadgeText":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"browsingData":{"remove":{"minArgs":2,"maxArgs":2},"removeCache":{"minArgs":1,"maxArgs":1},"removeCookies":{"minArgs":1,"maxArgs":1},"removeDownloads":{"minArgs":1,"maxArgs":1},"removeFormData":{"minArgs":1,"maxArgs":1},"removeHistory":{"minArgs":1,"maxArgs":1},"removeLocalStorage":{"minArgs":1,"maxArgs":1},"removePasswords":{"minArgs":1,"maxArgs":1},"removePluginData":{"minArgs":1,"maxArgs":1},"settings":{"minArgs":0,"maxArgs":0}},"commands":{"getAll":{"minArgs":0,"maxArgs":0}},"contextMenus":{"remove":{"minArgs":1,"maxArgs":1},"removeAll":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"cookies":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":1,"maxArgs":1},"getAllCookieStores":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"devtools":{"inspectedWindow":{"eval":{"minArgs":1,"maxArgs":2,"singleCallbackArg":false}},"panels":{"create":{"minArgs":3,"maxArgs":3,"singleCallbackArg":true},"elements":{"createSidebarPane":{"minArgs":1,"maxArgs":1}}}},"downloads":{"cancel":{"minArgs":1,"maxArgs":1},"download":{"minArgs":1,"maxArgs":1},"erase":{"minArgs":1,"maxArgs":1},"getFileIcon":{"minArgs":1,"maxArgs":2},"open":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"pause":{"minArgs":1,"maxArgs":1},"removeFile":{"minArgs":1,"maxArgs":1},"resume":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"extension":{"isAllowedFileSchemeAccess":{"minArgs":0,"maxArgs":0},"isAllowedIncognitoAccess":{"minArgs":0,"maxArgs":0}},"history":{"addUrl":{"minArgs":1,"maxArgs":1},"deleteAll":{"minArgs":0,"maxArgs":0},"deleteRange":{"minArgs":1,"maxArgs":1},"deleteUrl":{"minArgs":1,"maxArgs":1},"getVisits":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1}},"i18n":{"detectLanguage":{"minArgs":1,"maxArgs":1},"getAcceptLanguages":{"minArgs":0,"maxArgs":0}},"identity":{"launchWebAuthFlow":{"minArgs":1,"maxArgs":1}},"idle":{"queryState":{"minArgs":1,"maxArgs":1}},"management":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"getSelf":{"minArgs":0,"maxArgs":0},"setEnabled":{"minArgs":2,"maxArgs":2},"uninstallSelf":{"minArgs":0,"maxArgs":1}},"notifications":{"clear":{"minArgs":1,"maxArgs":1},"create":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":0},"getPermissionLevel":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"pageAction":{"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"hide":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"permissions":{"contains":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"request":{"minArgs":1,"maxArgs":1}},"runtime":{"getBackgroundPage":{"minArgs":0,"maxArgs":0},"getPlatformInfo":{"minArgs":0,"maxArgs":0},"openOptionsPage":{"minArgs":0,"maxArgs":0},"requestUpdateCheck":{"minArgs":0,"maxArgs":0},"sendMessage":{"minArgs":1,"maxArgs":3},"sendNativeMessage":{"minArgs":2,"maxArgs":2},"setUninstallURL":{"minArgs":1,"maxArgs":1}},"sessions":{"getDevices":{"minArgs":0,"maxArgs":1},"getRecentlyClosed":{"minArgs":0,"maxArgs":1},"restore":{"minArgs":0,"maxArgs":1}},"storage":{"local":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"managed":{"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1}},"sync":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}}},"tabs":{"captureVisibleTab":{"minArgs":0,"maxArgs":2},"create":{"minArgs":1,"maxArgs":1},"detectLanguage":{"minArgs":0,"maxArgs":1},"discard":{"minArgs":0,"maxArgs":1},"duplicate":{"minArgs":1,"maxArgs":1},"executeScript":{"minArgs":1,"maxArgs":2},"get":{"minArgs":1,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":0},"getZoom":{"minArgs":0,"maxArgs":1},"getZoomSettings":{"minArgs":0,"maxArgs":1},"goBack":{"minArgs":0,"maxArgs":1},"goForward":{"minArgs":0,"maxArgs":1},"highlight":{"minArgs":1,"maxArgs":1},"insertCSS":{"minArgs":1,"maxArgs":2},"move":{"minArgs":2,"maxArgs":2},"query":{"minArgs":1,"maxArgs":1},"reload":{"minArgs":0,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeCSS":{"minArgs":1,"maxArgs":2},"sendMessage":{"minArgs":2,"maxArgs":3},"setZoom":{"minArgs":1,"maxArgs":2},"setZoomSettings":{"minArgs":1,"maxArgs":2},"update":{"minArgs":1,"maxArgs":2}},"topSites":{"get":{"minArgs":0,"maxArgs":0}},"webNavigation":{"getAllFrames":{"minArgs":1,"maxArgs":1},"getFrame":{"minArgs":1,"maxArgs":1}},"webRequest":{"handlerBehaviorChanged":{"minArgs":0,"maxArgs":0}},"windows":{"create":{"minArgs":0,"maxArgs":1},"get":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":1},"getLastFocused":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}}}');

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/

// EXTERNAL MODULE: ../../node_modules/webextension-polyfill/src/browser-polyfill.js
var browser_polyfill = __webpack_require__(3651);
;// ../../fragment/fragments/reverse-trial/dist/shared/constants.js
const EXPERIMENT_FLAG_PREFIX = "show-reverse-trial-opd-";
const TOUCH_POINT_CONFIG_FLAG_PREFIX = "reverse-trial-opd-config-";
const GET_DIALOG_MESSAGE_TYPE = "reverse-trial.get-dialog";
const STEP_PREF_KEY = "reverse_trial_step";
const TRIAL_START_DATE_PREF_KEY = "reverse_trial_start_date";
const DIALOG_ACTION_MESSAGE_TYPE = "reverse-trial.dialog-action";
const DIALOG_SHOWN_MESSAGE_TYPE = "reverse-trial.dialog-shown";
const DISMISS_DIALOG_MESSAGE_TYPE = "reverse-trial.dismiss-dialog";
const GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE = "reverse-trial.get-dialog-should-still-show";
const DIALOG_MARKER_ATTRIBUTE = "data-rt-opd";
const MS_PER_DAY = (/* unused pure expression or super */ null && (1000 * 60 * 60 * 24));
const YT_MASTHEAD_TIMEOUT_MS = 10000;

;// ../../fragment/fragments/reverse-trial/dist/shared/types.js
const DialogAction = {
    CLOSE: "CLOSE",
    END_TRIAL: "END_TRIAL",
    NAVIGATE: "NAVIGATE",
    AUTO_DISMISS: "AUTO_DISMISS",
    START_TRIAL: "START_TRIAL",
};

;// ../../fragment/fragments/reverse-trial/dist/content/reverse-trial-dialog.js



function sendDialogAction(touchPointStep, action) {
    void browser_polyfill.runtime.sendMessage({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep,
        action,
    });
}
function sendDialogShown(touchPointStep) {
    void browser_polyfill.runtime.sendMessage({
        type: DIALOG_SHOWN_MESSAGE_TYPE,
        touchPointStep,
    });
}
async function detectYouTubePremium(timeoutMs = (/* inlined export .YT_MASTHEAD_TIMEOUT_MS */10000)) {
    const masthead = document.querySelector("#masthead");
    if (masthead) {
        return masthead.getAttribute("logo-type") === "YOUTUBE_PREMIUM_LOGO";
    }
    return await new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const el = document.querySelector("#masthead");
            if (el) {
                observer.disconnect();
                resolve(el.getAttribute("logo-type") === "YOUTUBE_PREMIUM_LOGO");
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
        setTimeout(() => {
            observer.disconnect();
            resolve(false);
        }, timeoutMs);
    });
}
function isDarkMode() {
    const docAttr = document.documentElement.getAttribute("dark");
    const ytdApp = document.querySelector("ytd-app");
    return docAttr !== null || (ytdApp === null || ytdApp === void 0 ? void 0 : ytdApp.hasAttribute("dark")) === true;
}
let dialogContainer = null;
let dialogRemoved = false;
let autoDismissTimer = null;
let autoDismissMs = null;
let currentTouchPointStep = null;
let startCalled = false;
const DIALOG_STYLES = `
  :host {
    position: fixed;
    top: 37px;
    right: 37px;
    z-index: 2147483647;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
  }

  #dialog {
    position: relative;
    border-radius: 12px;
    padding: 20px 24px;
    width: 300px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
  }

  #header {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
    gap: 8px;
  }

  #logo {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    user-select: none;
  }

  #title {
    font-size: 14px;
    font-weight: 700;
    flex: 1;
    line-height: 1.3;
  }

  #close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    user-select: none;
  }

  #cta-btn {
    display: block;
    width: auto;
    margin-top: 18px;
    margin-left: auto;
    margin-right: auto;
    padding: 10px 40px;
    background: #e53935;
    color: #fff;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    font-family: Arial, Helvetica, sans-serif;
  }

  #cta-btn:hover {
    background: #c62828;
  }

  #links-row {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    font-size: 13px;
  }

  #links-row.no-cta {
    margin-top: 32px;
  }

  #links-row a {
    text-decoration: none;
  }

  .links-separator {
    user-select: none;
  }

  .heading {
    font-size: 13px;
    font-weight: 600;
    margin: 12px 0 6px 0;
    text-align: left;
  }

  .list-item {
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    text-align: left;
    padding-left: 8px;
  }

  .check {
    color: #e53935;
    margin-right: 8px;
  }

  .body-text {
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 8px 0;
    padding: 0 8px;
  }
`;
const DARK_DIALOG_STYLES = `
  #dialog {
    background: #282828;
    color: #e0e0e0;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }

  #title {
    color: #fff;
  }

  #close-btn {
    color: #888;
  }

  #close-btn:hover {
    color: #fff;
  }

  #links-row a {
    color: #aaa;
  }

  #links-row a:hover {
    color: #e0e0e0;
  }

  .links-separator {
    color: #aaa;
  }

  .heading {
    color: #e0e0e0;
  }

  .list-item {
    color: #aaa;
  }

  .body-text {
    color: #aaa;
  }

  strong {
    color: #e0e0e0;
  }

  em, u {
    color: inherit;
  }
`;
const LIGHT_DIALOG_STYLES = `
  #dialog {
    background: #ffffff;
    color: #333333;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  #title {
    color: #111111;
  }

  #close-btn {
    color: #777777;
  }

  #close-btn:hover {
    color: #111111;
  }

  #links-row a {
    color: #666666;
  }

  #links-row a:hover {
    color: #333333;
  }

  .links-separator {
    color: #666666;
  }

  .heading {
    color: #333333;
  }

  .list-item {
    color: #555555;
  }

  .body-text {
    color: #555555;
  }

  strong {
    color: #333333;
  }

  em, u {
    color: inherit;
  }
`;
function appendRichText(parent, text) {
    const parts = text.split(/(<(?:strong|em|u)>.*?<\/(?:strong|em|u)>)/g);
    for (const part of parts) {
        const match = /^<(strong|em|u)>(.*?)<\/\1>$/.exec(part);
        if (match) {
            const el = document.createElement(match[1]);
            el.textContent = match[2];
            parent.appendChild(el);
        }
        else if (part) {
            parent.appendChild(document.createTextNode(part));
        }
    }
}
function renderBodyLine(line) {
    if (line.style === "heading") {
        const el = document.createElement("p");
        el.className = "heading";
        el.textContent = line.text;
        return el;
    }
    if (line.style === "list-item") {
        const el = document.createElement("p");
        el.className = "list-item";
        const check = document.createElement("span");
        check.className = "check";
        check.textContent = "\u2713";
        el.appendChild(check);
        el.appendChild(document.createTextNode(line.text));
        return el;
    }
    const el = document.createElement("p");
    el.className = "body-text";
    appendRichText(el, line.text);
    return el;
}
function removeDialog() {
    dialogRemoved = true;
    currentTouchPointStep = null;
    autoDismissMs = null;
    if (autoDismissTimer !== null) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
    }
    if (dialogContainer) {
        dialogContainer.remove();
        dialogContainer = null;
    }
}
function startAutoDismissTimer() {
    if (autoDismissMs === null) {
        return;
    }
    const touchPointStep = currentTouchPointStep;
    autoDismissTimer = setTimeout(() => {
        removeDialog();
        if (touchPointStep !== null) {
            sendDialogAction(touchPointStep, DialogAction.AUTO_DISMISS);
        }
    }, autoDismissMs);
}
function stopAutoDismissTimer() {
    if (autoDismissTimer !== null) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
    }
}
function buildDialog(payload) {
    var _a;
    const host = document.createElement("div");
    host.setAttribute(DIALOG_MARKER_ATTRIBUTE, "");
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent =
        DIALOG_STYLES + (isDarkMode() ? DARK_DIALOG_STYLES : LIGHT_DIALOG_STYLES);
    shadow.appendChild(style);
    const dialog = document.createElement("div");
    dialog.id = "dialog";
    const header = document.createElement("div");
    header.id = "header";
    if (payload.logoUrl) {
        const logo = document.createElement("img");
        logo.id = "logo";
        logo.src = payload.logoUrl;
        header.appendChild(logo);
    }
    const title = document.createElement("span");
    title.id = "title";
    title.textContent = payload.title;
    header.appendChild(title);
    dialog.appendChild(header);
    if (payload.showCloseButton) {
        const closeBtn = document.createElement("button");
        closeBtn.id = "close-btn";
        closeBtn.textContent = "\u00d7";
        closeBtn.addEventListener("click", () => {
            sendDialogAction(payload.touchPointStep, DialogAction.CLOSE);
            removeDialog();
        });
        dialog.appendChild(closeBtn);
    }
    for (const line of payload.body) {
        dialog.appendChild(renderBodyLine(line));
    }
    if (payload.ctaButton) {
        const ctaBtn = document.createElement("button");
        ctaBtn.id = "cta-btn";
        ctaBtn.textContent = payload.ctaButton.text;
        const ctaButton = payload.ctaButton;
        ctaBtn.addEventListener("click", () => {
            if (ctaButton.url) {
                window.open(ctaButton.url, "_blank");
            }
            else {
                removeDialog();
            }
            sendDialogAction(payload.touchPointStep, ctaButton.key);
        });
        dialog.appendChild(ctaBtn);
    }
    const links = (_a = payload.links) !== null && _a !== void 0 ? _a : [];
    if (links.length > 0) {
        const linksRow = document.createElement("div");
        linksRow.id = "links-row";
        if (!payload.ctaButton) {
            linksRow.classList.add("no-cta");
        }
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const el = document.createElement("a");
            el.textContent = link.text;
            if (link.url) {
                el.href = link.url;
                el.target = "_blank";
            }
            else {
                el.href = "#";
            }
            el.addEventListener("click", (e) => {
                if (!link.url) {
                    e.preventDefault();
                    removeDialog();
                }
                sendDialogAction(payload.touchPointStep, link.key);
            });
            linksRow.appendChild(el);
            if (i < links.length - 1) {
                const sep = document.createElement("span");
                sep.className = "links-separator";
                sep.textContent = "\u2022";
                linksRow.appendChild(sep);
            }
        }
        dialog.appendChild(linksRow);
    }
    shadow.appendChild(dialog);
    return host;
}
function renderDialog(payload) {
    if (dialogContainer !== null || dialogRemoved) {
        return;
    }
    if (document.querySelector(`[${DIALOG_MARKER_ATTRIBUTE}]`)) {
        return;
    }
    dialogContainer = buildDialog(payload);
    currentTouchPointStep = payload.touchPointStep;
    document.body.appendChild(dialogContainer);
    sendDialogShown(payload.touchPointStep);
    if (payload.autoDismissMs) {
        autoDismissMs = payload.autoDismissMs;
        startAutoDismissTimer();
        dialogContainer.addEventListener("pointerenter", stopAutoDismissTimer);
        dialogContainer.addEventListener("pointerleave", startAutoDismissTimer);
        dialogContainer.addEventListener("focusin", stopAutoDismissTimer);
        dialogContainer.addEventListener("focusout", startAutoDismissTimer);
    }
}
async function start() {
    if (startCalled) {
        return;
    }
    startCalled = true;
    document.addEventListener("visibilitychange", () => {
        const needsCheck = document.visibilityState === "visible" &&
            dialogContainer !== null &&
            document.contains(dialogContainer);
        if (needsCheck) {
            void browser_polyfill.runtime
                .sendMessage({
                type: GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
                touchPointStep: currentTouchPointStep,
            })
                .then((shouldStillShow) => {
                if (!shouldStillShow) {
                    removeDialog();
                }
            });
        }
    });
    browser_polyfill.runtime.onMessage.addListener(function dismissListener(message) {
        if ((message === null || message === void 0 ? void 0 : message.type) !== DISMISS_DIALOG_MESSAGE_TYPE) {
            return undefined;
        }
        removeDialog();
        browser_polyfill.runtime.onMessage.removeListener(dismissListener);
        return Promise.resolve();
    });
    const ytPremium = await detectYouTubePremium();
    let payload = null;
    try {
        payload = await browser_polyfill.runtime.sendMessage({
            type: GET_DIALOG_MESSAGE_TYPE,
            ytPremium,
        });
    }
    catch (_a) {
        return;
    }
    if (!payload) {
        return;
    }
    renderDialog(payload);
}

;// ../../fragment/fragments/reverse-trial/dist/content/index.js

void start();

/******/ })()
;
//# sourceMappingURL=reverse-trial.preload.js.map