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

/***/ 1287
(module) {


module.exports = function (cssWithMappingToString) {
    var list = [];
    list.toString = function toString() {
        return this.map(function (item) {
            var content = "";
            var needLayer = typeof item[5] !== "undefined";
            if (item[4]) {
                content += "@supports (".concat(item[4], ") {");
            }
            if (item[2]) {
                content += "@media ".concat(item[2], " {");
            }
            if (needLayer) {
                content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
            }
            content += cssWithMappingToString(item);
            if (needLayer) {
                content += "}";
            }
            if (item[2]) {
                content += "}";
            }
            if (item[4]) {
                content += "}";
            }
            return content;
        }).join("");
    };
    list.i = function i(modules, media, dedupe, supports, layer) {
        if (typeof modules === "string") {
            modules = [[null, modules, undefined]];
        }
        var alreadyImportedModules = {};
        if (dedupe) {
            for (var k = 0; k < this.length; k++) {
                var id = this[k][0];
                if (id != null) {
                    alreadyImportedModules[id] = true;
                }
            }
        }
        for (var _k = 0; _k < modules.length; _k++) {
            var item = [].concat(modules[_k]);
            if (dedupe && alreadyImportedModules[item[0]]) {
                continue;
            }
            if (typeof layer !== "undefined") {
                if (typeof item[5] === "undefined") {
                    item[5] = layer;
                }
                else {
                    item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
                    item[5] = layer;
                }
            }
            if (media) {
                if (!item[2]) {
                    item[2] = media;
                }
                else {
                    item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
                    item[2] = media;
                }
            }
            if (supports) {
                if (!item[4]) {
                    item[4] = "".concat(supports);
                }
                else {
                    item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
                    item[4] = supports;
                }
            }
            list.push(item);
        }
    };
    return list;
};


/***/ },

/***/ 2929
(module) {


module.exports = function (item) {
    var content = item[1];
    var cssMapping = item[3];
    if (!cssMapping) {
        return content;
    }
    if (typeof btoa === "function") {
        var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(cssMapping))));
        var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
        var sourceMapping = "/*# ".concat(data, " */");
        return [content].concat([sourceMapping]).join("\n");
    }
    return [content].join("\n");
};


/***/ },

/***/ 3230
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6054);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_common_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6350);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_light_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4341);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_steps_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(5882);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(342);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_fixes_css__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(7984);
// Imports








var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_common_css__WEBPACK_IMPORTED_MODULE_3__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_light_css__WEBPACK_IMPORTED_MODULE_4__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_steps_css__WEBPACK_IMPORTED_MODULE_5__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_css__WEBPACK_IMPORTED_MODULE_6__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_fixes_css__WEBPACK_IMPORTED_MODULE_7__/* ["default"] */ .A);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

html {
  font-size: 16px;
}

body {
  display: flex;
  flex-direction: column;
  margin: 0rem;
  color: #494949;
  background-color: #f3f3f3;
  font-size: 1.25rem;
  align-items: center;
}

input,
button {
  font-family: inherit;
}

header,
main,
footer {
  width: 46.3rem;
}

header {
  display: flex;
  flex-direction: column;
  margin-top: 1.2rem;
  margin-bottom: 2rem;
  align-items: stretch;
}

header > .logo {
  display: flex;
  flex-direction: column;
  align-items: center;
}

#logo {
  height: 2.8rem;
}

.logo > p {
  margin: 0;
  margin-top: 1.2rem;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.8rem;
  text-transform: uppercase;
}

main {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 1.4rem;
  flex-grow: 1;
}

main,
#other-issues,
.modalContent {
  border: 1px solid #cdcdcd;
  background-color: #fff;
}

.page:not([hidden]) {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.page > p {
  font-size: 0.9rem;
}

main h1 {
  margin: 0;
  padding: 0;
  font-size: 1.5rem;
}

#typeSelectorGroup {
  font-size: 1rem;
}

#typeSelectorGroup > label {
  font-weight: 700;
}

#typeSelectorGroup > p {
  margin-top: 0.5em;
  margin-bottom: 1em;
  font-size: 0.9rem;
}

#typeSelectorGroup > p:first-of-type {
  margin-bottom: 30px;
}

html:not([dir="rtl"]) #typeSelectorGroup > p {
  margin-left: 30px;
}

html[dir="rtl"] #typeSelectorGroup > p {
  margin-right: 30px;
}

#anonymousSubmissionContainer {
  margin-top: 0.5em;
}

#anonymousSubmissionWarning,
#error {
  margin-top: 0.3em;
  margin-bottom: 1em;
  color: var(--color-error);
}

#comment {
  min-height: 2em;
  flex-grow: 1;
}

#sendingProgressContainer:not([hidden]) {
  display: flex;
  flex-direction: row;
  margin-top: 2rem;
  justify-content: center;
}

#result {
  border-width: 0px;
  flex-grow: 1;
}

#showData {
  margin: 0;
}

#showDataValue {
  overflow: auto;
  box-sizing: border-box;
  width: 100%;
  margin: 0 0 1rem;
  padding: 20px;
  border: 1px solid #ccc;
  font-size: 1rem;
  flex-grow: 1;
}

footer,
footer > div {
  box-sizing: border-box;
  padding-bottom: 16px;
}

footer > div:not(#other-issues) {
  display: flex;
  flex-direction: row;
  margin-top: 2rem;
}

footer > div:not(#other-issues) > div {
  flex-grow: 1;
  align-self: flex-end;
}

#privacyPolicy,
#other-issues {
  font-size: 1rem;
}

#other-issues {
  margin-top: 1rem;
  padding-top: 16px;
  background-image: url(/skin/icons/info-big.svg);
  background-repeat: no-repeat;
}

html[dir="ltr"] #other-issues {
  padding-left: 72px;
  background-position: 24px center;
}

html[dir="rtl"] #other-issues {
  padding-right: 72px;
  background-position: calc(100% - 24px) center;
}

#other-issues a,
#other-issues a:visited {
  font-weight: 600;
  text-decoration: none;
}

#privacyPolicy,
#privacyPolicy:visited,
#other-issues a,
#other-issues a:visited {
  color: #0797e1;
}

/*
 * Generic styles
 */

[data-invisible="true"] {
  visibility: hidden;
}

button {
  padding: 0.8rem 1.2rem;
  background-color: transparent;
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
  flex-shrink: 0;
}

html:not([dir="rtl"]) button {
  margin-left: 0.5rem;
}

html[dir="rtl"] button {
  margin-right: 0.5rem;
}

button.primary:not(.icon) {
  border: 0px;
  color: #fff;
  background-color: #0797e1;
}

button.primary:not([disabled]):not(.icon):hover {
  box-shadow: inset 0 0 0 3px #005d80;
}

button.primary[disabled]:not(.icon) {
  background-color: #5cbce1;
}

button.secondary {
  border: 1px solid #0797e1;
  color: #0797e1;
}

button.secondary:hover {
  box-shadow: inset 0 0 0 2px #0797e1;
}

button.link {
  padding: 0.2rem;
  border: 0px;
  color: #0797e1;
  background-color: transparent;
  font-weight: 400;
  text-decoration: underline;
  text-transform: none;
}

button.link:hover {
  color: #5cbce1;
}

button.link:disabled,
button.link:disabled:hover {
  color: #ccc;
  cursor: default;
}

input[type="text"],
input[type="email"],
textarea {
  border: 2px solid #0797e1;
  font-size: 1.25rem;
}

input[type="email"]:invalid {
  border-color: var(--color-error);
}

input[type="checkbox"],
input[type="radio"] {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin: 0px 3px;
  padding: 0px;
  border: 0px;
  background-color: transparent;
  background-repeat: no-repeat;
  -webkit-appearance: none;
  -moz-appearance: none;
}

input[type="checkbox"] {
  background-image: url(/skin/icons/checkbox.svg?off#off);
}

input[type="checkbox"]:checked {
  background-image: url(/skin/icons/checkbox.svg?on#on);
}

input[type="radio"] {
  background-image: url(/skin/icons/radio.svg?normal#normal);
}

input[type="radio"]:hover {
  background-image: url(/skin/icons/radio.svg?hover#hover);
}

input[type="radio"]:checked {
  background-image: url(/skin/icons/radio.svg?selected#selected);
}

.modal:not([hidden]) {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 5rem;
  background-color: rgba(0, 0, 0, 0.5);
}

.modalContent {
  display: flex;
  overflow: auto;
  flex-direction: column;
  padding: 2rem;
  flex-grow: 1;
  align-items: flex-end;
}

[aria-hidden="true"] {
  display: none !important;
}

#notification {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  padding: 2px;
  opacity: 0.8;
  color: #4a4a4a;
  background-color: #d8d8d8;
  font-size: 1rem;
}

#notification-text {
  text-align: center;
  flex: 1;
}

.icon {
  padding: 0px;
  border: 0px;
  background-color: transparent;
}

.icon:hover {
  box-shadow: none;
}

.icon::before {
  display: block;
  border: 0.2rem solid transparent;
  background-repeat: no-repeat;
  content: "";
}

.close.icon::before {
  width: 1rem;
  height: 1rem;
}

.icon.close.tertiary::before {
  background-image: url(/skin/icons/close.svg?tertiary#tertiary);
}

.icon.close.tertiary:hover::before {
  background-image: url(/skin/icons/close.svg?tertiary-hover#tertiary-hover);
}

body[data-page="commentPage"] #continue {
  display: none;
}

#commentPage > label {
  font-size: 1rem;
  font-weight: 700;
}

#anonymousSubmissionContainer {
  font-size: 0.9rem;
}

input[type="checkbox"],
input[type="radio"] {
  vertical-align: top;
}
`, "",{"version":3,"sources":["webpack://./src/issue-reporter/ui/issue-reporter.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AASF;EACE,eAAe;AACjB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,YAAY;EACZ,cAAc;EACd,yBAAyB;EACzB,kBAAkB;EAClB,mBAAmB;AACrB;;AAEA;;EAEE,oBAAoB;AACtB;;AAEA;;;EAGE,cAAc;AAChB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,kBAAkB;EAClB,mBAAmB;EACnB,oBAAoB;AACtB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,mBAAmB;AACrB;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,SAAS;EACT,kBAAkB;EAClB,UAAU;EACV,iBAAiB;EACjB,gBAAgB;EAChB,mBAAmB;EACnB,yBAAyB;AAC3B;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,sBAAsB;EACtB,eAAe;EACf,YAAY;AACd;;AAEA;;;EAGE,yBAAyB;EACzB,sBAAsB;AACxB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,YAAY;AACd;;AAEA;EACE,iBAAiB;AACnB;;AAEA;EACE,SAAS;EACT,UAAU;EACV,iBAAiB;AACnB;;AAEA;EACE,eAAe;AACjB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,iBAAiB;EACjB,kBAAkB;EAClB,iBAAiB;AACnB;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,iBAAiB;AACnB;;AAEA;;EAEE,iBAAiB;EACjB,kBAAkB;EAClB,yBAAyB;AAC3B;;AAEA;EACE,eAAe;EACf,YAAY;AACd;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,gBAAgB;EAChB,uBAAuB;AACzB;;AAEA;EACE,iBAAiB;EACjB,YAAY;AACd;;AAEA;EACE,SAAS;AACX;;AAEA;EACE,cAAc;EACd,sBAAsB;EACtB,WAAW;EACX,gBAAgB;EAChB,aAAa;EACb,sBAAsB;EACtB,eAAe;EACf,YAAY;AACd;;AAEA;;EAEE,sBAAsB;EACtB,oBAAoB;AACtB;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,gBAAgB;AAClB;;AAEA;EACE,YAAY;EACZ,oBAAoB;AACtB;;AAEA;;EAEE,eAAe;AACjB;;AAEA;EACE,gBAAgB;EAChB,iBAAiB;EACjB,+CAA+C;EAC/C,4BAA4B;AAC9B;;AAEA;EACE,kBAAkB;EAClB,gCAAgC;AAClC;;AAEA;EACE,mBAAmB;EACnB,6CAA6C;AAC/C;;AAEA;;EAEE,gBAAgB;EAChB,qBAAqB;AACvB;;AAEA;;;;EAIE,cAAc;AAChB;;AAEA;;EAEE;;AAEF;EACE,kBAAkB;AACpB;;AAEA;EACE,sBAAsB;EACtB,6BAA6B;EAC7B,mBAAmB;EACnB,gBAAgB;EAChB,qBAAqB;EACrB,yBAAyB;EACzB,eAAe;EACf,cAAc;AAChB;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,oBAAoB;AACtB;;AAEA;EACE,WAAW;EACX,WAAW;EACX,yBAAyB;AAC3B;;AAEA;EACE,mCAAmC;AACrC;;AAEA;EACE,yBAAyB;AAC3B;;AAEA;EACE,yBAAyB;EACzB,cAAc;AAChB;;AAEA;EACE,mCAAmC;AACrC;;AAEA;EACE,eAAe;EACf,WAAW;EACX,cAAc;EACd,6BAA6B;EAC7B,gBAAgB;EAChB,0BAA0B;EAC1B,oBAAoB;AACtB;;AAEA;EACE,cAAc;AAChB;;AAEA;;EAEE,WAAW;EACX,eAAe;AACjB;;AAEA;;;EAGE,yBAAyB;EACzB,kBAAkB;AACpB;;AAEA;EACE,gCAAgC;AAClC;;AAEA;;EAEE,qBAAqB;EACrB,WAAW;EACX,YAAY;EACZ,eAAe;EACf,YAAY;EACZ,WAAW;EACX,6BAA6B;EAC7B,4BAA4B;EAC5B,wBAAwB;EACxB,qBAAqB;AACvB;;AAEA;EACE,uDAAuD;AACzD;;AAEA;EACE,qDAAqD;AACvD;;AAEA;EACE,0DAA0D;AAC5D;;AAEA;EACE,wDAAwD;AAC1D;;AAEA;EACE,8DAA8D;AAChE;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,eAAe;EACf,MAAM;EACN,QAAQ;EACR,SAAS;EACT,OAAO;EACP,aAAa;EACb,oCAAoC;AACtC;;AAEA;EACE,aAAa;EACb,cAAc;EACd,sBAAsB;EACtB,aAAa;EACb,YAAY;EACZ,qBAAqB;AACvB;;AAEA;EACE,wBAAwB;AAC1B;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,WAAW;EACX,YAAY;EACZ,YAAY;EACZ,cAAc;EACd,yBAAyB;EACzB,eAAe;AACjB;;AAEA;EACE,kBAAkB;EAClB,OAAO;AACT;;AAEA;EACE,YAAY;EACZ,WAAW;EACX,6BAA6B;AAC/B;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,cAAc;EACd,gCAAgC;EAChC,4BAA4B;EAC5B,WAAW;AACb;;AAEA;EACE,WAAW;EACX,YAAY;AACd;;AAEA;EACE,8DAA8D;AAChE;;AAEA;EACE,0EAA0E;AAC5E;;AAEA;EACE,aAAa;AACf;;AAEA;EACE,eAAe;EACf,gBAAgB;AAClB;;AAEA;EACE,iBAAiB;AACnB;;AAEA;;EAEE,mBAAmB;AACrB","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n@import \"../../theme/ui/font.css\";\n@import \"../../theme/ui/common.css\";\n@import \"../../theme/ui/light.css\";\n@import \"../../components/ui/io-steps.css\";\n@import \"../../components/ui/io-highlighter.css\";\n@import \"../../components/ui/io-highlighter-fixes.css\";\n\nhtml {\n  font-size: 16px;\n}\n\nbody {\n  display: flex;\n  flex-direction: column;\n  margin: 0rem;\n  color: #494949;\n  background-color: #f3f3f3;\n  font-size: 1.25rem;\n  align-items: center;\n}\n\ninput,\nbutton {\n  font-family: inherit;\n}\n\nheader,\nmain,\nfooter {\n  width: 46.3rem;\n}\n\nheader {\n  display: flex;\n  flex-direction: column;\n  margin-top: 1.2rem;\n  margin-bottom: 2rem;\n  align-items: stretch;\n}\n\nheader > .logo {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n}\n\n#logo {\n  height: 2.8rem;\n}\n\n.logo > p {\n  margin: 0;\n  margin-top: 1.2rem;\n  padding: 0;\n  font-size: 1.5rem;\n  font-weight: 700;\n  line-height: 1.8rem;\n  text-transform: uppercase;\n}\n\nmain {\n  display: flex;\n  flex-direction: column;\n  box-sizing: border-box;\n  padding: 1.4rem;\n  flex-grow: 1;\n}\n\nmain,\n#other-issues,\n.modalContent {\n  border: 1px solid #cdcdcd;\n  background-color: #fff;\n}\n\n.page:not([hidden]) {\n  display: flex;\n  flex-direction: column;\n  flex-grow: 1;\n}\n\n.page > p {\n  font-size: 0.9rem;\n}\n\nmain h1 {\n  margin: 0;\n  padding: 0;\n  font-size: 1.5rem;\n}\n\n#typeSelectorGroup {\n  font-size: 1rem;\n}\n\n#typeSelectorGroup > label {\n  font-weight: 700;\n}\n\n#typeSelectorGroup > p {\n  margin-top: 0.5em;\n  margin-bottom: 1em;\n  font-size: 0.9rem;\n}\n\n#typeSelectorGroup > p:first-of-type {\n  margin-bottom: 30px;\n}\n\nhtml:not([dir=\"rtl\"]) #typeSelectorGroup > p {\n  margin-left: 30px;\n}\n\nhtml[dir=\"rtl\"] #typeSelectorGroup > p {\n  margin-right: 30px;\n}\n\n#anonymousSubmissionContainer {\n  margin-top: 0.5em;\n}\n\n#anonymousSubmissionWarning,\n#error {\n  margin-top: 0.3em;\n  margin-bottom: 1em;\n  color: var(--color-error);\n}\n\n#comment {\n  min-height: 2em;\n  flex-grow: 1;\n}\n\n#sendingProgressContainer:not([hidden]) {\n  display: flex;\n  flex-direction: row;\n  margin-top: 2rem;\n  justify-content: center;\n}\n\n#result {\n  border-width: 0px;\n  flex-grow: 1;\n}\n\n#showData {\n  margin: 0;\n}\n\n#showDataValue {\n  overflow: auto;\n  box-sizing: border-box;\n  width: 100%;\n  margin: 0 0 1rem;\n  padding: 20px;\n  border: 1px solid #ccc;\n  font-size: 1rem;\n  flex-grow: 1;\n}\n\nfooter,\nfooter > div {\n  box-sizing: border-box;\n  padding-bottom: 16px;\n}\n\nfooter > div:not(#other-issues) {\n  display: flex;\n  flex-direction: row;\n  margin-top: 2rem;\n}\n\nfooter > div:not(#other-issues) > div {\n  flex-grow: 1;\n  align-self: flex-end;\n}\n\n#privacyPolicy,\n#other-issues {\n  font-size: 1rem;\n}\n\n#other-issues {\n  margin-top: 1rem;\n  padding-top: 16px;\n  background-image: url(/skin/icons/info-big.svg);\n  background-repeat: no-repeat;\n}\n\nhtml[dir=\"ltr\"] #other-issues {\n  padding-left: 72px;\n  background-position: 24px center;\n}\n\nhtml[dir=\"rtl\"] #other-issues {\n  padding-right: 72px;\n  background-position: calc(100% - 24px) center;\n}\n\n#other-issues a,\n#other-issues a:visited {\n  font-weight: 600;\n  text-decoration: none;\n}\n\n#privacyPolicy,\n#privacyPolicy:visited,\n#other-issues a,\n#other-issues a:visited {\n  color: #0797e1;\n}\n\n/*\n * Generic styles\n */\n\n[data-invisible=\"true\"] {\n  visibility: hidden;\n}\n\nbutton {\n  padding: 0.8rem 1.2rem;\n  background-color: transparent;\n  font-size: 1.125rem;\n  font-weight: 700;\n  text-decoration: none;\n  text-transform: uppercase;\n  cursor: pointer;\n  flex-shrink: 0;\n}\n\nhtml:not([dir=\"rtl\"]) button {\n  margin-left: 0.5rem;\n}\n\nhtml[dir=\"rtl\"] button {\n  margin-right: 0.5rem;\n}\n\nbutton.primary:not(.icon) {\n  border: 0px;\n  color: #fff;\n  background-color: #0797e1;\n}\n\nbutton.primary:not([disabled]):not(.icon):hover {\n  box-shadow: inset 0 0 0 3px #005d80;\n}\n\nbutton.primary[disabled]:not(.icon) {\n  background-color: #5cbce1;\n}\n\nbutton.secondary {\n  border: 1px solid #0797e1;\n  color: #0797e1;\n}\n\nbutton.secondary:hover {\n  box-shadow: inset 0 0 0 2px #0797e1;\n}\n\nbutton.link {\n  padding: 0.2rem;\n  border: 0px;\n  color: #0797e1;\n  background-color: transparent;\n  font-weight: 400;\n  text-decoration: underline;\n  text-transform: none;\n}\n\nbutton.link:hover {\n  color: #5cbce1;\n}\n\nbutton.link:disabled,\nbutton.link:disabled:hover {\n  color: #ccc;\n  cursor: default;\n}\n\ninput[type=\"text\"],\ninput[type=\"email\"],\ntextarea {\n  border: 2px solid #0797e1;\n  font-size: 1.25rem;\n}\n\ninput[type=\"email\"]:invalid {\n  border-color: var(--color-error);\n}\n\ninput[type=\"checkbox\"],\ninput[type=\"radio\"] {\n  display: inline-block;\n  width: 18px;\n  height: 18px;\n  margin: 0px 3px;\n  padding: 0px;\n  border: 0px;\n  background-color: transparent;\n  background-repeat: no-repeat;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n}\n\ninput[type=\"checkbox\"] {\n  background-image: url(/skin/icons/checkbox.svg?off#off);\n}\n\ninput[type=\"checkbox\"]:checked {\n  background-image: url(/skin/icons/checkbox.svg?on#on);\n}\n\ninput[type=\"radio\"] {\n  background-image: url(/skin/icons/radio.svg?normal#normal);\n}\n\ninput[type=\"radio\"]:hover {\n  background-image: url(/skin/icons/radio.svg?hover#hover);\n}\n\ninput[type=\"radio\"]:checked {\n  background-image: url(/skin/icons/radio.svg?selected#selected);\n}\n\n.modal:not([hidden]) {\n  display: flex;\n  flex-direction: column;\n  position: fixed;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  padding: 5rem;\n  background-color: rgba(0, 0, 0, 0.5);\n}\n\n.modalContent {\n  display: flex;\n  overflow: auto;\n  flex-direction: column;\n  padding: 2rem;\n  flex-grow: 1;\n  align-items: flex-end;\n}\n\n[aria-hidden=\"true\"] {\n  display: none !important;\n}\n\n#notification {\n  display: flex;\n  box-sizing: border-box;\n  width: 100%;\n  padding: 2px;\n  opacity: 0.8;\n  color: #4a4a4a;\n  background-color: #d8d8d8;\n  font-size: 1rem;\n}\n\n#notification-text {\n  text-align: center;\n  flex: 1;\n}\n\n.icon {\n  padding: 0px;\n  border: 0px;\n  background-color: transparent;\n}\n\n.icon:hover {\n  box-shadow: none;\n}\n\n.icon::before {\n  display: block;\n  border: 0.2rem solid transparent;\n  background-repeat: no-repeat;\n  content: \"\";\n}\n\n.close.icon::before {\n  width: 1rem;\n  height: 1rem;\n}\n\n.icon.close.tertiary::before {\n  background-image: url(/skin/icons/close.svg?tertiary#tertiary);\n}\n\n.icon.close.tertiary:hover::before {\n  background-image: url(/skin/icons/close.svg?tertiary-hover#tertiary-hover);\n}\n\nbody[data-page=\"commentPage\"] #continue {\n  display: none;\n}\n\n#commentPage > label {\n  font-size: 1rem;\n  font-weight: 700;\n}\n\n#anonymousSubmissionContainer {\n  font-size: 0.9rem;\n}\n\ninput[type=\"checkbox\"],\ninput[type=\"radio\"] {\n  vertical-align: top;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 7984
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

html:not([dir="rtl"]) io-highlighter .options button,
html[dir="rtl"] io-highlighter .options button {
  margin: 0;
}
`, "",{"version":3,"sources":["webpack://./src/components/ui/io-highlighter-fixes.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;;EAEE,SAAS;AACX","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\nhtml:not([dir=\"rtl\"]) io-highlighter .options button,\nhtml[dir=\"rtl\"] io-highlighter .options button {\n  margin: 0;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 342
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

io-highlighter,
io-highlighter *,
io-highlighter *::before,
io-highlighter *::after {
  box-sizing: border-box;
}

io-highlighter {
  display: block;
  position: relative;
  border: 1px solid #979797;
}

io-highlighter .split {
  display: flex;
  height: 100%;
}

io-highlighter .options {
  width: 95px;
  padding: 12px;
  border-right: 1px solid #979797;
  color: #4a4a4a;
  background-color: #f1f1f1;
}

io-highlighter canvas {
  width: 100%;
  height: 100%;
  user-select: none;
  pointer-events: none;
  flex-grow: 1;
  touch-action: none;
}

io-highlighter[drawing] canvas {
  pointer-events: all;
}

io-highlighter .options .highlight {
  background-image: url(/skin/icons/highlight.svg?off#off);
}

io-highlighter[drawing="highlight"] .options .highlight {
  background-image: url(/skin/icons/highlight.svg?on#on);
}

io-highlighter .options .hide {
  background-image: url(/skin/icons/hide.svg?off#off);
}

io-highlighter[drawing="hide"] .options .hide {
  background-image: url(/skin/icons/hide.svg?on#on);
}

io-highlighter .options .highlight,
io-highlighter .options .hide {
  width: 70px;
  min-height: 70px;
  margin-bottom: 12px;
  padding: 0;
  padding-top: 40px;
  border-width: 0;
  border-radius: 12px;
  outline: none;
  color: inherit;
  background-repeat: no-repeat;
  background-position: center 12px;
  font-size: 0.7rem;
  word-break: break-all;
}

io-highlighter[drawing="highlight"] .options .highlight,
io-highlighter[drawing="hide"] .options .hide {
  color: #fff;
  background-color: #9b9b9b;
}

io-highlighter .closer {
  display: block;
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 24px;
  background-color: #4a4a4a;
  cursor: pointer;
  transform: translateX(-12px) translateY(-12px);
}

io-highlighter .closer img {
  width: 12px;
  margin: 6px;
}
`, "",{"version":3,"sources":["webpack://./src/components/ui/io-highlighter.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;;;;EAIE,sBAAsB;AACxB;;AAEA;EACE,cAAc;EACd,kBAAkB;EAClB,yBAAyB;AAC3B;;AAEA;EACE,aAAa;EACb,YAAY;AACd;;AAEA;EACE,WAAW;EACX,aAAa;EACb,+BAA+B;EAC/B,cAAc;EACd,yBAAyB;AAC3B;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,iBAAiB;EACjB,oBAAoB;EACpB,YAAY;EACZ,kBAAkB;AACpB;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,wDAAwD;AAC1D;;AAEA;EACE,sDAAsD;AACxD;;AAEA;EACE,mDAAmD;AACrD;;AAEA;EACE,iDAAiD;AACnD;;AAEA;;EAEE,WAAW;EACX,gBAAgB;EAChB,mBAAmB;EACnB,UAAU;EACV,iBAAiB;EACjB,eAAe;EACf,mBAAmB;EACnB,aAAa;EACb,cAAc;EACd,4BAA4B;EAC5B,gCAAgC;EAChC,iBAAiB;EACjB,qBAAqB;AACvB;;AAEA;;EAEE,WAAW;EACX,yBAAyB;AAC3B;;AAEA;EACE,cAAc;EACd,kBAAkB;EAClB,WAAW;EACX,YAAY;EACZ,mBAAmB;EACnB,yBAAyB;EACzB,eAAe;EACf,8CAA8C;AAChD;;AAEA;EACE,WAAW;EACX,WAAW;AACb","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\nio-highlighter,\nio-highlighter *,\nio-highlighter *::before,\nio-highlighter *::after {\n  box-sizing: border-box;\n}\n\nio-highlighter {\n  display: block;\n  position: relative;\n  border: 1px solid #979797;\n}\n\nio-highlighter .split {\n  display: flex;\n  height: 100%;\n}\n\nio-highlighter .options {\n  width: 95px;\n  padding: 12px;\n  border-right: 1px solid #979797;\n  color: #4a4a4a;\n  background-color: #f1f1f1;\n}\n\nio-highlighter canvas {\n  width: 100%;\n  height: 100%;\n  user-select: none;\n  pointer-events: none;\n  flex-grow: 1;\n  touch-action: none;\n}\n\nio-highlighter[drawing] canvas {\n  pointer-events: all;\n}\n\nio-highlighter .options .highlight {\n  background-image: url(/skin/icons/highlight.svg?off#off);\n}\n\nio-highlighter[drawing=\"highlight\"] .options .highlight {\n  background-image: url(/skin/icons/highlight.svg?on#on);\n}\n\nio-highlighter .options .hide {\n  background-image: url(/skin/icons/hide.svg?off#off);\n}\n\nio-highlighter[drawing=\"hide\"] .options .hide {\n  background-image: url(/skin/icons/hide.svg?on#on);\n}\n\nio-highlighter .options .highlight,\nio-highlighter .options .hide {\n  width: 70px;\n  min-height: 70px;\n  margin-bottom: 12px;\n  padding: 0;\n  padding-top: 40px;\n  border-width: 0;\n  border-radius: 12px;\n  outline: none;\n  color: inherit;\n  background-repeat: no-repeat;\n  background-position: center 12px;\n  font-size: 0.7rem;\n  word-break: break-all;\n}\n\nio-highlighter[drawing=\"highlight\"] .options .highlight,\nio-highlighter[drawing=\"hide\"] .options .hide {\n  color: #fff;\n  background-color: #9b9b9b;\n}\n\nio-highlighter .closer {\n  display: block;\n  position: absolute;\n  width: 24px;\n  height: 24px;\n  border-radius: 24px;\n  background-color: #4a4a4a;\n  cursor: pointer;\n  transform: translateX(-12px) translateY(-12px);\n}\n\nio-highlighter .closer img {\n  width: 12px;\n  margin: 6px;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 5882
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

io-steps {
  display: flex;
  position: relative;
  margin: 0;
  margin-top: 2rem;
  padding: 0;
  justify-content: space-between;
}

/* this element is used only to decorate via horizontal line */
io-steps::before {
  position: absolute;
  z-index: -1;
  top: 12px;
  width: 100%;
  height: 1px;
  background-color: #bcbcbc;
  font-size: 1px;
  line-height: 1px;
  content: " ";
}

html:not([dir="rtl"]) io-steps button,
html[dir="rtl"] io-steps button {
  margin: initial;
  padding: initial;
}

io-steps button {
  min-width: 80px;
  border: 0;
  outline: none;
  color: #0797e1;
  background: #f3f3f3;
  font-size: small;
  font-weight: initial;
  text-transform: inherit;
}

io-steps button::before {
  display: block;
  width: 24px;
  height: 24px;
  margin: auto;
  margin-bottom: 8px;
  border-radius: 12px;
  color: #fafbfd;
  background-color: #0797e1;
  font-size: 0.8rem;
  font-weight: 400;
  line-height: 24px;
  content: attr(data-value);
}

io-steps button:disabled::before {
  background-color: #9b9b9b;
}

io-steps button:disabled {
  color: #d8d8d8;
}

io-steps button.completed::before {
  content: "✔";
  animation: io-steps-completed 0.3s ease-in-out;
}

@keyframes io-steps-completed {
  0% {
    content: " ";
  }

  30% {
    font-size: 0;
    content: "✔";
    transform: scale(0.5);
  }
}
`, "",{"version":3,"sources":["webpack://./src/components/ui/io-steps.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;EACE,aAAa;EACb,kBAAkB;EAClB,SAAS;EACT,gBAAgB;EAChB,UAAU;EACV,8BAA8B;AAChC;;AAEA,8DAA8D;AAC9D;EACE,kBAAkB;EAClB,WAAW;EACX,SAAS;EACT,WAAW;EACX,WAAW;EACX,yBAAyB;EACzB,cAAc;EACd,gBAAgB;EAChB,YAAY;AACd;;AAEA;;EAEE,eAAe;EACf,gBAAgB;AAClB;;AAEA;EACE,eAAe;EACf,SAAS;EACT,aAAa;EACb,cAAc;EACd,mBAAmB;EACnB,gBAAgB;EAChB,oBAAoB;EACpB,uBAAuB;AACzB;;AAEA;EACE,cAAc;EACd,WAAW;EACX,YAAY;EACZ,YAAY;EACZ,kBAAkB;EAClB,mBAAmB;EACnB,cAAc;EACd,yBAAyB;EACzB,iBAAiB;EACjB,gBAAgB;EAChB,iBAAiB;EACjB,yBAAyB;AAC3B;;AAEA;EACE,yBAAyB;AAC3B;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,YAAY;EACZ,8CAA8C;AAChD;;AAEA;EACE;IACE,YAAY;EACd;;EAEA;IACE,YAAY;IACZ,YAAY;IACZ,qBAAqB;EACvB;AACF","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\nio-steps {\n  display: flex;\n  position: relative;\n  margin: 0;\n  margin-top: 2rem;\n  padding: 0;\n  justify-content: space-between;\n}\n\n/* this element is used only to decorate via horizontal line */\nio-steps::before {\n  position: absolute;\n  z-index: -1;\n  top: 12px;\n  width: 100%;\n  height: 1px;\n  background-color: #bcbcbc;\n  font-size: 1px;\n  line-height: 1px;\n  content: \" \";\n}\n\nhtml:not([dir=\"rtl\"]) io-steps button,\nhtml[dir=\"rtl\"] io-steps button {\n  margin: initial;\n  padding: initial;\n}\n\nio-steps button {\n  min-width: 80px;\n  border: 0;\n  outline: none;\n  color: #0797e1;\n  background: #f3f3f3;\n  font-size: small;\n  font-weight: initial;\n  text-transform: inherit;\n}\n\nio-steps button::before {\n  display: block;\n  width: 24px;\n  height: 24px;\n  margin: auto;\n  margin-bottom: 8px;\n  border-radius: 12px;\n  color: #fafbfd;\n  background-color: #0797e1;\n  font-size: 0.8rem;\n  font-weight: 400;\n  line-height: 24px;\n  content: attr(data-value);\n}\n\nio-steps button:disabled::before {\n  background-color: #9b9b9b;\n}\n\nio-steps button:disabled {\n  color: #d8d8d8;\n}\n\nio-steps button.completed::before {\n  content: \"✔\";\n  animation: io-steps-completed 0.3s ease-in-out;\n}\n\n@keyframes io-steps-completed {\n  0% {\n    content: \" \";\n  }\n\n  30% {\n    font-size: 0;\n    content: \"✔\";\n    transform: scale(0.5);\n  }\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 6350
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
  Used for translatable screen reader only content.
  e.g.: Use instead of aria-label to avoid complex attribute value translation
*/
.sr-only {
  clip: rect(0, 0, 0, 0);
  overflow: hidden;
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0px;
  border: 0px;
}
`, "",{"version":3,"sources":["webpack://./src/theme/ui/common.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;;;CAGC;AACD;EACE,sBAAsB;EACtB,gBAAgB;EAChB,kBAAkB;EAClB,UAAU;EACV,WAAW;EACX,YAAY;EACZ,YAAY;EACZ,WAAW;AACb","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n/*\n  Used for translatable screen reader only content.\n  e.g.: Use instead of aria-label to avoid complex attribute value translation\n*/\n.sr-only {\n  clip: rect(0, 0, 0, 0);\n  overflow: hidden;\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0px;\n  border: 0px;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 6054
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 300;
  src:
    local("Source Sans Pro Light"),
    local("SourceSansPro-Light"),
    url(/skin/fonts/source-sans-pro-300.woff2) format("woff2");
}

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 400;
  src:
    local("Source Sans Pro Regular"),
    local("SourceSansPro-Regular"),
    url(/skin/fonts/source-sans-pro-400.woff2) format("woff2");
}

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 700;
  src:
    local("Source Sans Pro Bold"),
    local("SourceSansPro-Bold"),
    url(/skin/fonts/source-sans-pro-700.woff2) format("woff2");
}

body {
  font-family: "Source Sans Pro", sans-serif;
  font-size: inherit;
}
`, "",{"version":3,"sources":["webpack://./src/theme/ui/font.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;EACE,8BAA8B;EAC9B,kBAAkB;EAClB,gBAAgB;EAChB;;;8DAG4D;AAC9D;;AAEA;EACE,8BAA8B;EAC9B,kBAAkB;EAClB,gBAAgB;EAChB;;;8DAG4D;AAC9D;;AAEA;EACE,8BAA8B;EAC9B,kBAAkB;EAClB,gBAAgB;EAChB;;;8DAG4D;AAC9D;;AAEA;EACE,0CAA0C;EAC1C,kBAAkB;AACpB","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n@font-face {\n  font-family: \"Source Sans Pro\";\n  font-style: normal;\n  font-weight: 300;\n  src:\n    local(\"Source Sans Pro Light\"),\n    local(\"SourceSansPro-Light\"),\n    url(/skin/fonts/source-sans-pro-300.woff2) format(\"woff2\");\n}\n\n@font-face {\n  font-family: \"Source Sans Pro\";\n  font-style: normal;\n  font-weight: 400;\n  src:\n    local(\"Source Sans Pro Regular\"),\n    local(\"SourceSansPro-Regular\"),\n    url(/skin/fonts/source-sans-pro-400.woff2) format(\"woff2\");\n}\n\n@font-face {\n  font-family: \"Source Sans Pro\";\n  font-style: normal;\n  font-weight: 700;\n  src:\n    local(\"Source Sans Pro Bold\"),\n    local(\"SourceSansPro-Bold\"),\n    url(/skin/fonts/source-sans-pro-700.woff2) format(\"woff2\");\n}\n\nbody {\n  font-family: \"Source Sans Pro\", sans-serif;\n  font-size: inherit;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 4341
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

:root {
  --background-color-cta-primary: #0797e1;
  --background-color-cta-primary-hover: #0797e1ee;
  --background-color-cta-secondary: #fff;
  --background-color-cta-secondary-hover: #0001;
  --background-color-error: #f7dde1;
  --background-color-info: #0797e1;
  --background-color-secondary: #f7f7f7;
  --background-color-primary: #fff;
  --background-color-ternary: #edf9ff;
  --border-color-cta-primary: var(--background-color-cta-primary);
  --border-color-cta-secondary: var(--color-primary);
  --border-color-secondary: #d2d2d2;
  --border-color-primary: #cdcdcd;
  --border-color-ternary: #c0e6f9;
  --border-color-outline: #acacac;
  --border-radius: 4px;
  --border-radius-primary: 6px;
  --border-style-primary: solid;
  --border-width-thick: 4px;
  --border-width-thin: 1px;
  --box-shadow-primary: 0 2px 4px 0 hsla(0, 0%, 84%, 0.5);
  --color-brand-primary: #ed1e45;
  --color-cta-primary: #fff;
  --color-cta-secondary: #666;
  --color-primary: #585858;
  --color-secondary: #000;
  --color-dimmed: #4a4a4a;
  --color-critical: var(--color-brand-primary);
  --color-default: #ff8f00;
  --color-error: var(--color-brand-primary);
  --color-link: #0797e1;
  --color-info: #0797e1;
  --color-premium: #eda51e;
  --color-premium-hover: #eb9b05;
  --font-size-heavy: 20px;
  --font-size-big: 17px;
  --font-size-medium: 16px;
  --font-size-primary: 13px;
  --font-size-small: 12px;
  --margin-primary: 16px;
  --margin-secondary: calc(var(--margin-primary) / 2);
  --padding-primary: 16px;
  --padding-secondary: calc(var(--padding-primary) / 2);
  --primary-outline: var(--border-color-outline) dotted 1px;
}
`, "",{"version":3,"sources":["webpack://./src/theme/ui/light.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAEF;EACE,uCAAuC;EACvC,+CAA+C;EAC/C,sCAAsC;EACtC,6CAA6C;EAC7C,iCAAiC;EACjC,gCAAgC;EAChC,qCAAqC;EACrC,gCAAgC;EAChC,mCAAmC;EACnC,+DAA+D;EAC/D,kDAAkD;EAClD,iCAAiC;EACjC,+BAA+B;EAC/B,+BAA+B;EAC/B,+BAA+B;EAC/B,oBAAoB;EACpB,4BAA4B;EAC5B,6BAA6B;EAC7B,yBAAyB;EACzB,wBAAwB;EACxB,uDAAuD;EACvD,8BAA8B;EAC9B,yBAAyB;EACzB,2BAA2B;EAC3B,wBAAwB;EACxB,uBAAuB;EACvB,uBAAuB;EACvB,4CAA4C;EAC5C,wBAAwB;EACxB,yCAAyC;EACzC,qBAAqB;EACrB,qBAAqB;EACrB,wBAAwB;EACxB,8BAA8B;EAC9B,uBAAuB;EACvB,qBAAqB;EACrB,wBAAwB;EACxB,yBAAyB;EACzB,uBAAuB;EACvB,sBAAsB;EACtB,mDAAmD;EACnD,uBAAuB;EACvB,qDAAqD;EACrD,yDAAyD;AAC3D","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n:root {\n  --background-color-cta-primary: #0797e1;\n  --background-color-cta-primary-hover: #0797e1ee;\n  --background-color-cta-secondary: #fff;\n  --background-color-cta-secondary-hover: #0001;\n  --background-color-error: #f7dde1;\n  --background-color-info: #0797e1;\n  --background-color-secondary: #f7f7f7;\n  --background-color-primary: #fff;\n  --background-color-ternary: #edf9ff;\n  --border-color-cta-primary: var(--background-color-cta-primary);\n  --border-color-cta-secondary: var(--color-primary);\n  --border-color-secondary: #d2d2d2;\n  --border-color-primary: #cdcdcd;\n  --border-color-ternary: #c0e6f9;\n  --border-color-outline: #acacac;\n  --border-radius: 4px;\n  --border-radius-primary: 6px;\n  --border-style-primary: solid;\n  --border-width-thick: 4px;\n  --border-width-thin: 1px;\n  --box-shadow-primary: 0 2px 4px 0 hsla(0, 0%, 84%, 0.5);\n  --color-brand-primary: #ed1e45;\n  --color-cta-primary: #fff;\n  --color-cta-secondary: #666;\n  --color-primary: #585858;\n  --color-secondary: #000;\n  --color-dimmed: #4a4a4a;\n  --color-critical: var(--color-brand-primary);\n  --color-default: #ff8f00;\n  --color-error: var(--color-brand-primary);\n  --color-link: #0797e1;\n  --color-info: #0797e1;\n  --color-premium: #eda51e;\n  --color-premium-hover: #eb9b05;\n  --font-size-heavy: 20px;\n  --font-size-big: 17px;\n  --font-size-medium: 16px;\n  --font-size-primary: 13px;\n  --font-size-small: 12px;\n  --margin-primary: 16px;\n  --margin-secondary: calc(var(--margin-primary) / 2);\n  --padding-primary: 16px;\n  --padding-secondary: calc(var(--padding-primary) / 2);\n  --primary-outline: var(--border-color-outline) dotted 1px;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ 8848
(__webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {


;// ../../node_modules/@eyeo/webext-ad-filtering-solution/dist/ewe-ui.js
var ewe_ui_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {

(function webpackUniversalModuleDefinition(root, factory) {
    if (true)
        module.exports = factory();
    else // removed by dead control flow
{}
})(self, () => {
    return (() => {
        "use strict";
        var __webpack_modules__ = ({
            7795(module, __unused_webpack_exports, __nested_webpack_require_530__) {
                if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) {
                    throw new Error("This script should only be loaded in a browser extension.");
                }
                if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
                    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
                    const ERROR_TO_IGNORE = `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`;
                    const wrapAPIs = extensionAPIs => {
                        const apiMetadata = __nested_webpack_require_530__(9438);
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
            },
            9438(module) {
                module.exports = JSON.parse('{"alarms":{"clear":{"minArgs":0,"maxArgs":1},"clearAll":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0}},"bookmarks":{"create":{"minArgs":1,"maxArgs":1},"get":{"minArgs":1,"maxArgs":1},"getChildren":{"minArgs":1,"maxArgs":1},"getRecent":{"minArgs":1,"maxArgs":1},"getSubTree":{"minArgs":1,"maxArgs":1},"getTree":{"minArgs":0,"maxArgs":0},"move":{"minArgs":2,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeTree":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}},"browserAction":{"disable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"enable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"getBadgeBackgroundColor":{"minArgs":1,"maxArgs":1},"getBadgeText":{"minArgs":1,"maxArgs":1},"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"openPopup":{"minArgs":0,"maxArgs":0},"setBadgeBackgroundColor":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setBadgeText":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"browsingData":{"remove":{"minArgs":2,"maxArgs":2},"removeCache":{"minArgs":1,"maxArgs":1},"removeCookies":{"minArgs":1,"maxArgs":1},"removeDownloads":{"minArgs":1,"maxArgs":1},"removeFormData":{"minArgs":1,"maxArgs":1},"removeHistory":{"minArgs":1,"maxArgs":1},"removeLocalStorage":{"minArgs":1,"maxArgs":1},"removePasswords":{"minArgs":1,"maxArgs":1},"removePluginData":{"minArgs":1,"maxArgs":1},"settings":{"minArgs":0,"maxArgs":0}},"commands":{"getAll":{"minArgs":0,"maxArgs":0}},"contextMenus":{"remove":{"minArgs":1,"maxArgs":1},"removeAll":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"cookies":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":1,"maxArgs":1},"getAllCookieStores":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"devtools":{"inspectedWindow":{"eval":{"minArgs":1,"maxArgs":2,"singleCallbackArg":false}},"panels":{"create":{"minArgs":3,"maxArgs":3,"singleCallbackArg":true},"elements":{"createSidebarPane":{"minArgs":1,"maxArgs":1}}}},"downloads":{"cancel":{"minArgs":1,"maxArgs":1},"download":{"minArgs":1,"maxArgs":1},"erase":{"minArgs":1,"maxArgs":1},"getFileIcon":{"minArgs":1,"maxArgs":2},"open":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"pause":{"minArgs":1,"maxArgs":1},"removeFile":{"minArgs":1,"maxArgs":1},"resume":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"extension":{"isAllowedFileSchemeAccess":{"minArgs":0,"maxArgs":0},"isAllowedIncognitoAccess":{"minArgs":0,"maxArgs":0}},"history":{"addUrl":{"minArgs":1,"maxArgs":1},"deleteAll":{"minArgs":0,"maxArgs":0},"deleteRange":{"minArgs":1,"maxArgs":1},"deleteUrl":{"minArgs":1,"maxArgs":1},"getVisits":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1}},"i18n":{"detectLanguage":{"minArgs":1,"maxArgs":1},"getAcceptLanguages":{"minArgs":0,"maxArgs":0}},"identity":{"launchWebAuthFlow":{"minArgs":1,"maxArgs":1}},"idle":{"queryState":{"minArgs":1,"maxArgs":1}},"management":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"getSelf":{"minArgs":0,"maxArgs":0},"setEnabled":{"minArgs":2,"maxArgs":2},"uninstallSelf":{"minArgs":0,"maxArgs":1}},"notifications":{"clear":{"minArgs":1,"maxArgs":1},"create":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":0},"getPermissionLevel":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"pageAction":{"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"hide":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"permissions":{"contains":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"request":{"minArgs":1,"maxArgs":1}},"runtime":{"getBackgroundPage":{"minArgs":0,"maxArgs":0},"getPlatformInfo":{"minArgs":0,"maxArgs":0},"openOptionsPage":{"minArgs":0,"maxArgs":0},"requestUpdateCheck":{"minArgs":0,"maxArgs":0},"sendMessage":{"minArgs":1,"maxArgs":3},"sendNativeMessage":{"minArgs":2,"maxArgs":2},"setUninstallURL":{"minArgs":1,"maxArgs":1}},"sessions":{"getDevices":{"minArgs":0,"maxArgs":1},"getRecentlyClosed":{"minArgs":0,"maxArgs":1},"restore":{"minArgs":0,"maxArgs":1}},"storage":{"local":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"managed":{"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1}},"sync":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}}},"tabs":{"captureVisibleTab":{"minArgs":0,"maxArgs":2},"create":{"minArgs":1,"maxArgs":1},"detectLanguage":{"minArgs":0,"maxArgs":1},"discard":{"minArgs":0,"maxArgs":1},"duplicate":{"minArgs":1,"maxArgs":1},"executeScript":{"minArgs":1,"maxArgs":2},"get":{"minArgs":1,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":0},"getZoom":{"minArgs":0,"maxArgs":1},"getZoomSettings":{"minArgs":0,"maxArgs":1},"goBack":{"minArgs":0,"maxArgs":1},"goForward":{"minArgs":0,"maxArgs":1},"highlight":{"minArgs":1,"maxArgs":1},"insertCSS":{"minArgs":1,"maxArgs":2},"move":{"minArgs":2,"maxArgs":2},"query":{"minArgs":1,"maxArgs":1},"reload":{"minArgs":0,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeCSS":{"minArgs":1,"maxArgs":2},"sendMessage":{"minArgs":2,"maxArgs":3},"setZoom":{"minArgs":1,"maxArgs":2},"setZoomSettings":{"minArgs":1,"maxArgs":2},"update":{"minArgs":1,"maxArgs":2}},"topSites":{"get":{"minArgs":0,"maxArgs":0}},"webNavigation":{"getAllFrames":{"minArgs":1,"maxArgs":1},"getFrame":{"minArgs":1,"maxArgs":1}},"webRequest":{"handlerBehaviorChanged":{"minArgs":0,"maxArgs":0}},"windows":{"create":{"minArgs":0,"maxArgs":1},"get":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":1},"getLastFocused":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}}}');
            }
        });
        const __webpack_module_cache__ = {};
        function __nested_webpack_require_24729__(moduleId) {
            const cachedModule = __webpack_module_cache__[moduleId];
            if (cachedModule !== undefined) {
                return cachedModule.exports;
            }
            const module = __webpack_module_cache__[moduleId] = {
                exports: {}
            };
            __webpack_modules__[moduleId](module, module.exports, __nested_webpack_require_24729__);
            return module.exports;
        }
        (() => {
            __nested_webpack_require_24729__.d = (exports, definition) => {
                if (Array.isArray(definition)) {
                    var i = 0;
                    while (i < definition.length) {
                        var key = definition[i++];
                        var binding = definition[i++];
                        if (!__nested_webpack_require_24729__.o(exports, key)) {
                            if (binding === 0) {
                                Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
                            }
                            else {
                                Object.defineProperty(exports, key, { enumerable: true, get: binding });
                            }
                        }
                        else if (binding === 0) {
                            i++;
                        }
                    }
                }
                else {
                    for (var key in definition) {
                        if (__nested_webpack_require_24729__.o(definition, key) && !__nested_webpack_require_24729__.o(exports, key)) {
                            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
                        }
                    }
                }
            };
        })();
        (() => {
            __nested_webpack_require_24729__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
        })();
        (() => {
            __nested_webpack_require_24729__.r = (exports) => {
                if (Symbol.toStringTag) {
                    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                }
                Object.defineProperty(exports, '__esModule', { value: true });
            };
        })();
        let __nested_webpack_exports__ = {};
        __nested_webpack_require_24729__.r(__nested_webpack_exports__);
        __nested_webpack_require_24729__.d(__nested_webpack_exports__, {
            account: () => (account),
            experiments: () => (experiments),
            sentry: () => (sentry),
            telemetry: () => (telemetry)
        });
        var browser_polyfill = __nested_webpack_require_24729__(7795);
        ;
        const ERROR_NO_CONNECTION = "Could not establish connection. " +
            "Receiving end does not exist.";
        const ERROR_CLOSED_CONNECTION = "A listener indicated an asynchronous " +
            "response by returning true, but the message channel closed before a " +
            "response was received";
        const ERROR_MANAGER_DISCONNECTED = "Message manager disconnected";
        function fromSerializableError(errorData) {
            const error = new Error(errorData.message);
            error.cause = errorData.cause;
            error.name = errorData.name;
            error.stack = errorData.stack;
            return error;
        }
        function ignoreNoConnectionError(promise) {
            return promise.catch(error => {
                if (typeof error == "object" &&
                    (error.message == ERROR_NO_CONNECTION ||
                        error.message == ERROR_CLOSED_CONNECTION ||
                        error.message == ERROR_MANAGER_DISCONNECTED)) {
                    return;
                }
                throw error;
            });
        }
        function toSerializableError(error) {
            return {
                cause: error.cause instanceof Error ?
                    toSerializableError(error.cause) :
                    error.cause,
                message: error.message,
                name: error.name,
                stack: error.stack
            };
        }
        ;
        async function forwardError(error) {
            ignoreNoConnectionError(browser_polyfill.runtime.sendMessage({
                type: "ewe:sentry-error",
                error: toSerializableError(error)
            }));
        }
        const sentry = ({
            async reportError(error) {
                return await forwardError(error);
            },
            start() {
                self.addEventListener("error", event => {
                    const { error } = event;
                    if (!(error instanceof Error)) {
                        return;
                    }
                    forwardError(error);
                });
                self.addEventListener("unhandledrejection", event => {
                    const { reason } = event;
                    if (!(reason instanceof Error)) {
                        return;
                    }
                    forwardError(reason);
                });
            }
        });
        ;
        async function callAPI(methodName, ...params) {
            return await ignoreNoConnectionError(browser_polyfill.runtime.sendMessage({
                type: "ewe:api-call",
                apiName: "account",
                methodName,
                params
            }));
        }
        const account = ({
            async getProfile() {
                return await callAPI("getProfile");
            },
            async hasPremium() {
                return await callAPI("hasPremium");
            },
            async isTrial() {
                return await callAPI("isTrial");
            },
            async getPreferences() {
                return await callAPI("getPreferences");
            },
            async getTrialDaysLeft() {
                return await callAPI("getTrialDaysLeft");
            }
        });
        ;
        async function experiments_callAPI(methodName, ...params) {
            return await ignoreNoConnectionError(browser_polyfill.runtime.sendMessage({
                type: "ewe:api-call",
                apiName: "experiments",
                methodName,
                params
            }));
        }
        const experiments = ({
            async getFlag(flagId) {
                return await experiments_callAPI("getFlag", flagId);
            },
            async getFlags() {
                return await experiments_callAPI("getFlags");
            },
            async getAssignments() {
                return await experiments_callAPI("getAssignments");
            }
        });
        ;
        const events = ({
            adblock_ui: {
                options_clicked: {
                    description: "User clicked the gear icon"
                },
                support_icon_clicked: {
                    description: "User clicked the support icon on the header of the Adblock popup"
                },
                opt_out_acceptable_ads_clicked: {
                    description: "The user clicked the opt-out link to disable Acceptable Ads on the getadblock.com installed page"
                },
                cm_pause_on_site: {
                    description: "User right clicked on the page to open the context menu and selected 'Pause on this site' from the AdBlock section."
                },
                cm_pause_on_all_sites: {
                    description: "User right clicked on the page to open the context menu and selected 'Pause on all sites' from the AdBlock section."
                },
                cm_resume_adblock: {
                    description: "User right clicked on the page to open the context menu and selected 'Resume blocking ads' from the AdBlock section."
                },
                pause_on_site: {
                    description: "User clicked 'Pause on this site' on the Adblock popup"
                },
                resume_adblock: {
                    description: "User clicked 'Resume Ad blocking' on the Adblock popup"
                },
                popup_opened: {
                    description: "User clicked the AdBlock toolbar icon to open the popup menu",
                    data: {
                        description: "Data about the popup opened event",
                        type: "object",
                        properties: {
                            isBadgeTextNew: {
                                description: "The 'new' badge is shown on the popup icon",
                                type: "boolean"
                            },
                            reason: {
                                description: "The reason why the 'new' badge was shown",
                                type: "string"
                            }
                        }
                    }
                },
                hide_on_this_page_clicked: {
                    description: "User clicked on the three dots in the popup menu, then clicked the 'Hide something on this page' link"
                },
                titletext_clicked: {
                    description: "User clicked the AdBlock logo in the popup menu header"
                },
                more_pause_options_clicked: {
                    description: "User clicked on the three dots in the popup menu, then clicked 'More pause options' link"
                },
                help_flow_results: {
                    description: "Emitted when a user completes the help flow in the popup. The flow presents different options based on the user's issue (e.g., ads not blocked, site broken, etc.), and the emitted event includes the path representing the sequence of choices the user made",
                    data: {
                        description: "Data about the help flow results",
                        type: "object",
                        properties: {
                            helpFlowPath: {
                                description: "The path of the help flow (e.g. 'start,seeAd,seeAdEverywhere,link')",
                                type: "string"
                            }
                        }
                    }
                },
                premium_options_clicked: {
                    description: "Triggered when a premium user clicks the 'Premium' label in the popup header which is shown next to the Adblock logo. The label is only visible to premium users and opens the Premium tab in the settings page"
                },
                popup_sub_clicked_cookies_premium: {
                    description: "Triggered when a premium user clicks the toggle to enable the Premium Cookie Blocking filter list in the popup. The list is not enabled automatically when upgrading to premium"
                },
                popup_sub_clicked_distraction_control: {
                    description: "Triggered when a premium user clicks the toggle to enable the Premium Block Distractions filter list in the popup. The list is not enabled automatically when upgrading to premium"
                },
                skip_cookie_walls_learn_more_clicked: {
                    description: "A free user clicked the Learn More button on the 'Skip Cookie Walls' section in the AdBlock popup"
                },
                block_distractions_learn_more_clicked: {
                    description: "A free user clicked the Learn More button on the 'Block Distractions' section in the AdBlock popup"
                },
                options_page_tab_premium_cta: {
                    description: "User interacted with a premium CTA on a premium tab in the options page",
                    data: {
                        description: "Data about which tab the user was viewing",
                        type: "object",
                        properties: {
                            tab: {
                                description: "The name of the tab being viewed when the CTA was clicked",
                                type: "string",
                                enum: ["premium", "themes", "image_swap", "premium_filters"]
                            },
                            action: {
                                description: "Type of interaction with the Premium CTA",
                                type: "string",
                                enum: ["clicked"]
                            }
                        }
                    }
                },
                options_page_tab: {
                    description: "User clicked or opened a tab on the options page side bar",
                    data: {
                        description: "Data about the user interaction with the options page tab",
                        type: "object",
                        properties: {
                            tab: {
                                description: "The tab that the user interacted with",
                                type: "string",
                                enum: ["stats", "general", "filter_lists", "customize", "support", "premium", "themes", "image_swap", "premium_filters"]
                            },
                            action: {
                                description: "Type of interaction with the options page tab",
                                type: "string",
                                enum: ["opened", "clicked"]
                            }
                        }
                    }
                },
                vpn_cta: {
                    description: "User interacted with AdBlock VPN promotional banner in the popup menu. This CTA promotes the VPN with 'Introducing AdBlock VPN' message",
                    data: {
                        description: "Data about the user interaction with the AdBlock VPN promotional banner",
                        type: "object",
                        properties: {
                            action: {
                                description: "Type of interaction with the AdBlock VPN promotional banner",
                                type: "string",
                                enum: ["seen", "clicked", "closed"]
                            }
                        }
                    }
                },
                premium_themes_cta: {
                    description: "User interacted with themes customization CTA in the popup menu, opening the themes section in options page",
                    data: {
                        description: "Information about the theme that was being promoted when clicked",
                        type: "object",
                        properties: {
                            theme: {
                                description: "The name of the theme being showcased when the user clicked",
                                type: "string",
                                enum: ["solarized", "solarized_light", "watermelon", "sunshine", "ocean"]
                            },
                            action: {
                                description: "Type of interaction with the themes customization CTA",
                                type: "string",
                                enum: ["seen", "clicked", "closed"]
                            }
                        }
                    }
                },
                free_dc_cta: {
                    description: "User interacted with Distraction Control promotional banner in the popup menu. This CTA promotes the premium Distraction Control feature with 'Block Floating Videos' message",
                    data: {
                        description: "Data about the user interaction with the Distraction Control promotional banner",
                        type: "object",
                        properties: {
                            action: {
                                description: "Type of interaction with the Distraction Control promotional banner",
                                type: "string",
                                enum: ["seen", "clicked", "closed"]
                            }
                        }
                    }
                },
                premium_dc_cta: {
                    description: "Premium user interacted with the enhanced Distraction Control CTA in the popup menu. This CTA highlights 'New Premium feature available!' to promote advanced distraction blocking options",
                    data: {
                        description: "Data about the user interaction with the Distraction Control CTA",
                        type: "object",
                        properties: {
                            action: {
                                description: "Type of interaction with the Distraction Control CTA",
                                type: "string",
                                enum: ["seen", "clicked", "closed"]
                            }
                        }
                    }
                },
                premium_upsell_cta: {
                    description: "User interacted with Premium upsell upgrade banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
                    data: {
                        description: "Data about the user interaction with the Premium upsell upgrade banner",
                        type: "object",
                        properties: {
                            action: {
                                description: "Type of interaction with the Premium upsell upgrade banner",
                                type: "string",
                                enum: ["seen", "clicked", "closed"]
                            }
                        }
                    }
                },
                premium_filter_list_cta: {
                    description: "User interacted with Premium filter list banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
                    data: {
                        description: "Data about the user interaction with the premium filter list CTA",
                        type: "object",
                        properties: {
                            action: {
                                description: "Type of interaction with the premium filter list CTA",
                                type: "string",
                                enum: ["seen", "clicked"]
                            }
                        }
                    }
                },
                data_collection_opt_out: {
                    description: "User opted out of data collection in the options page"
                }
            },
            extensions_ui: {
                acceptable_ads_toggled: {
                    description: "User toggled the Acceptable Ads checkbox on the extension options page. This is a shared event fired by both AB and ABP.",
                    data: {
                        description: "Data about the acceptable ads toggle interaction",
                        type: "object",
                        properties: {
                            action: {
                                description: "Whether the user opted in or out of acceptable ads",
                                type: "string",
                                enum: ["opted_in", "opted_out"]
                            },
                            source: {
                                description: "Where the toggle occurred. This could be from the general or filter lists options tabs.",
                                type: "string",
                                enum: ["options_general", "options_filter_list"]
                            }
                        }
                    }
                }
            },
            adblockplus_ui: {
                issue_report_submitted: {
                    description: "Issue report was submitted"
                }
            },
            smart_allowlisting: {
                allowlisting_expired: {
                    description: "An allowlisting filter expired automatically",
                    data: {
                        description: "Details about the filter at the time of expiration.",
                        type: "object",
                        properties: {
                            allowlistExtendDuration: {
                                description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
                                type: "number"
                            }
                        }
                    }
                },
                allowlisting_renewed: {
                    description: "An allowlisting filter was renewed automatically",
                    data: {
                        description: "Details about the filter at the time of renewal.",
                        type: "object",
                        properties: {
                            allowlistExtendDuration: {
                                description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
                                type: "number"
                            }
                        }
                    }
                }
            },
            cdp: {
                built_cdp_payload: {
                    description: "A payload has been built with the intention of sending it to CDP. This is debug information, and will temporarily include the eventStats until the CDP server is ready to ingest them.",
                    data: {
                        description: "Data about the built payload",
                        type: "object",
                        properties: {
                            eventStats: {
                                description: "Counts of behavior event logs since the last payload.",
                                type: "any"
                            },
                            uncompressedPayloadSize: {
                                description: "Size in bytes of the uncompressed and unencrypted payload.",
                                type: "integer"
                            }
                        }
                    }
                }
            },
            detection_snippets: {
                snippet_detection_event: {
                    description: "Recorded when a snippet detects a condition on a page (e.g. wall detection). Each detection snippet calls this event from a single location with a unique type value. Other snippet concerns (blocking, breakage) should register separate events. Data is reliable from 2026-04-29 onwards; data before this date may have schema mismatches due to ongoing pipeline development.",
                    data: {
                        description: "Metadata about the detected condition",
                        type: "object",
                        properties: {
                            type: {
                                description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'. Each snippet can have multiple types within a distinct type group for traceability.",
                                type: "string"
                            },
                            domain: {
                                description: "Domain where the condition was detected, e.g. 'example.com'",
                                type: "string"
                            },
                            specifier: {
                                description: "Optional additional context for filtering in BigQuery, e.g. the CSS selector that matched ('.overlay-wall-container') or a filter list identifier",
                                type: ["string", "null"]
                            }
                        }
                    }
                }
            },
            hit_snippets: {
                snippet_hit_event: {
                    description: "Recorded when a snippet successfully executes on a page.",
                    data: {
                        description: "Metadata about the snippet execution",
                        type: "object",
                        properties: {
                            filter: {
                                description: "Snippet filter body, e.g. 'json-prune ads userId'",
                                type: "string"
                            },
                            domain: {
                                description: "Domain where the snippet fired (document.location.hostname of the frame)",
                                type: "string"
                            },
                            topLevelDomain: {
                                description: "Top-level page domain. Equals domain for main-frame snippets; differs for cross-origin iframe snippets.",
                                type: "string"
                            }
                        }
                    }
                }
            },
            snippets: {
                context_tampering: {
                    description: "Recorded when the website is trying to disable the snippets"
                },
                local_storage_unavailable: {
                    description: "The extension intended to use localStorage as a cache, but localStorage was unavailable",
                    data: {
                        description: "Metadata about the context where localStorage was unavailable",
                        type: "object",
                        properties: {
                            isMainFrame: {
                                description: "This occurred in the main frame, not in an iframe",
                                type: "boolean"
                            }
                        }
                    }
                },
                zero_delay_cleanup: {
                    description: "Recorded when we cleaned up zero-delay storage key from previous extension versions.",
                    data: {
                        description: "Metadata about the cleanup operation",
                        type: "object",
                        properties: {
                            key: {
                                description: "The storage key that was cleaned up",
                                type: "string"
                            }
                        }
                    }
                },
                snippet_detection_domainless: {
                    description: "Domain omitted intentionally to support user-level retention signals without per-domain identification. Introduced on 2026-04-29; no data exists before this date.",
                    data: {
                        description: "Metadata about the detected condition",
                        type: "object",
                        properties: {
                            type: {
                                description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'.",
                                type: "string"
                            },
                            specifier: {
                                description: "Extra context from the detection snippet, e.g. a matched CSS selector or filter rule identifier. null when no specifier is available.",
                                type: ["string", "null"]
                            }
                        }
                    }
                }
            },
            youtube: {
                yt_site_navigation: {
                    description: "Recorded 5 seconds after a user navigates to a YouTube page. This event is sent only once per session. Refreshing or opening a new tab will start a new session. Navigating through videos without refreshing (aka SPA navigation) will not trigger another event.",
                    data: {
                        description: "Data about the YouTube navigation event",
                        type: "object",
                        properties: {
                            userLoggedIn: {
                                description: "Indicates whether the user is logged in to a YouTube account. '1' for logged in, '0' for not logged in.",
                                type: "string",
                                enum: ["1", "0"]
                            }
                        }
                    }
                },
                yt_site_ad_shown: {
                    description: "Recorded when a video ad on YouTube stops playing, either because it was skipped, the user navigated away, or it finished playing",
                    data: {
                        description: "Data for the YouTube ad shown event",
                        type: "object",
                        properties: {
                            isAllowListed: {
                                description: "Indicates whether the page is allowlisted. '1' for allowlisted, '0' for not allowlisted.",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isPremium: {
                                description: "Specifies whether the user has a Premium subscription. Used to be called 'p' in getadblock.logs_unified.logs_fact",
                                type: "boolean"
                            },
                            adFormat: {
                                description: "Format ID of the displayed ad. Used to be called 'category' in getadblock.logs_unified.logs_fact",
                                type: "string"
                            },
                            totalAdDurationMs: {
                                description: "Total duration of the ad, in milliseconds. Used to be called 'bc' in getadblock.logs_unified.logs_fact",
                                type: "number"
                            },
                            adShownDurationMs: {
                                description: "Actual playback duration of the ad, in milliseconds. Used to be called 'amount' in getadblock.logs_unified.logs_fact",
                                type: "number"
                            }
                        }
                    }
                },
                yt_site_ad_wall_detected: {
                    description: "Recorded when the YouTube ad wall is detected and the page is not yet allowlisted.",
                    data: {
                        description: "Data for YouTube ad wall detection when the page is not yet allowlisted",
                        type: "object",
                        properties: {
                            adwallCategory: {
                                description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
                                type: "string",
                                enum: ["soft", "hard"]
                            },
                            userLoggedIn: {
                                description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isAllowListed: {
                                description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '0' for this event.",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            allowlistScope: {
                                description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
                                type: "string",
                                enum: ["video", "tab"]
                            }
                        }
                    }
                },
                yt_site_already_allowlisted: {
                    description: "Recorded when the YouTube ad wall is detected, but the page was already allowlisted.",
                    data: {
                        description: "Data for YouTube ad wall detection when the page is already allowlisted",
                        type: "object",
                        properties: {
                            adwallCategory: {
                                description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
                                type: "string",
                                enum: ["soft", "hard"]
                            },
                            userLoggedIn: {
                                description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isAllowListed: {
                                description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '1' for this event.",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            allowlistScope: {
                                description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
                                type: "string",
                                enum: ["video", "tab"]
                            }
                        }
                    }
                },
                yt_auto_allowlisted: {
                    description: "Recorded immediately after the extension automatically allowlists a YouTube page in response to an ad wall.",
                    data: {
                        description: "Data for the YouTube auto allowlisted event",
                        type: "object",
                        properties: {
                            allowlistScope: {
                                description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
                                type: "string",
                                enum: ["video", "tab"]
                            }
                        }
                    }
                },
                yt_site_toast_shown: {
                    description: "Recorded when the YouTube 'ad blocker' toast notification appears in the DOM. This is an experiment ran by YouTube that only appears for certain adblocking users, warning them that their adblocker might be causing interruptions.",
                    data: {
                        description: "Data for the YouTube toast shown event",
                        type: "object",
                        properties: {
                            isAllowListed: {
                                description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isPremium: {
                                description: "Specifies whether the user has a Premium subscription",
                                type: "boolean"
                            }
                        }
                    }
                },
                yt_site_context_tampering: {
                    description: "Recorded when the YouTube error_204 beacon indicates a possible script conflict that could interfere with the extension.",
                    data: {
                        description: "Data for the YouTube context tampering event",
                        type: "object",
                        properties: {
                            isAllowListed: {
                                description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isPremium: {
                                description: "Specifies whether the user has a Premium subscription",
                                type: "boolean"
                            },
                            applicationVersion: {
                                description: "YouTube client version from the client.version query param on the error_204 request.",
                                type: "string"
                            }
                        }
                    }
                },
                yt_site_yt_error: {
                    description: "This event is triggered in the event of an error on YouTube. There could be multiple types of errors happening on the page, so we try to differentiate them via the category parameter.",
                    data: {
                        description: "Data for the YouTube error event",
                        type: "object",
                        properties: {
                            category: {
                                description: "Indicates the error type as defined in our extension code. It can be one of the following: 'uncaught_exception', 'player_error' or 'sww_error'.",
                                type: "string",
                                enum: ["uncaught_exception", "player_error", "sww_error"]
                            },
                            applicationVersion: {
                                description: "The client version of the YouTube application (e.g., '2.20251020.01.00').",
                                type: "string"
                            },
                            error: {
                                description: "Indicates the exception type of JavaScript error, captured by the YouTube error handler (e.g., 'TypeError').",
                                type: "string"
                            },
                            errorMsg: {
                                description: "Either the stack trace of the error or an empty string.",
                                type: "string"
                            },
                            isAllowListed: {
                                description: "String flag indicating whether the site is allowlisted ('1' if allowlisted, otherwise '0').",
                                type: "string",
                                enum: ["1", "0"]
                            },
                            isPremium: {
                                description: "Specifies whether the user has a Premium subscription.",
                                type: "boolean"
                            }
                        }
                    }
                }
            },
            conflict_detection: {
                bt_loader_blocked: {
                    description: "Recorded on every website when the script from Blockthrough fails to load. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event indicates the script was blocked, which can happen when the user has disabled Acceptable Ads, installed another ad blocker that blocks BTLoader, or allowlisted the page. When BTLoader is blocked, ad recovery cannot occur and monetization is lost.",
                    data: {
                        description: "Data about why BTLoader was blocked",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            },
                            errorMsg: {
                                description: "Browser string indicating the error that occurred",
                                type: "string"
                            }
                        }
                    }
                },
                bt_loader_success: {
                    description: "Recorded on every website when the script from Blockthrough successfully loads. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event confirms that ad recovery can proceed normally on this page.",
                    data: {
                        description: "Data about the BTLoader success event",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            }
                        }
                    }
                },
                aa_bait1_blocked: {
                    description: "Acceptable Ads bait 1 was blocked",
                    data: {
                        description: "Data about why Acceptable Ads bait 1 was blocked",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            },
                            errorMsg: {
                                description: "Browser string indicating the error that occurred",
                                type: "string"
                            }
                        }
                    }
                },
                aa_bait1_success: {
                    description: "Acceptable Ads bait 1 was successfully loaded",
                    data: {
                        description: "Data about the Acceptable Ads bait 1 success event",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            }
                        }
                    }
                },
                aa_bait2_blocked: {
                    description: "Acceptable Ads bait 2 was blocked",
                    data: {
                        description: "Data about why Acceptable Ads bait 2 was blocked",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            },
                            errorMsg: {
                                description: "Browser string indicating the error that occurred",
                                type: "string"
                            }
                        }
                    }
                },
                aa_bait2_success: {
                    description: "Acceptable Ads bait 2 was successfully loaded",
                    data: {
                        description: "Data about the Acceptable Ads bait 2 success event",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            }
                        }
                    }
                },
                aa_other_blocked: {
                    description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were blocked",
                    data: {
                        description: "Data about why Acceptable Ads filters were blocked",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            },
                            errorMsg: {
                                description: "Browser string indicating the error that occurred",
                                type: "string"
                            }
                        }
                    }
                },
                aa_other_success: {
                    description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were successfully loaded",
                    data: {
                        description: "Data about the Acceptable Ads filters success event",
                        type: "object",
                        properties: {
                            isPageAllowlisted: {
                                description: "Whether the page is allowlisted",
                                type: "boolean"
                            },
                            aaListsStatus: {
                                description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
                                type: "number"
                            }
                        }
                    }
                }
            },
            cohorts: {
                facts_snapshot: {
                    description: "Cohorts facts snapshot used for cohort estimation",
                    data: {
                        description: "The updated facts",
                        type: "object",
                        properties: {
                            extName: {
                                description: "The name of the extension",
                                type: "string"
                            },
                            extVersion: {
                                description: "The version of the extension",
                                type: "string"
                            },
                            browserName: {
                                description: "The name of the browser",
                                type: "string"
                            },
                            browserVersion: {
                                description: "The version of the browser",
                                type: "string"
                            },
                            browserLanguage: {
                                description: "The language of the browser",
                                type: "string"
                            },
                            countryCode: {
                                description: "The 2-letter country code of the user",
                                type: "string"
                            },
                            aaEnabled: {
                                description: "Whether Acceptable Ads is enabled",
                                type: "boolean"
                            },
                            installType: {
                                description: "The installation type of the extension",
                                type: "string"
                            },
                            hasPremium: {
                                description: "Whether the user has a premium subscription",
                                type: "boolean"
                            },
                            installDate: {
                                description: "The timestamp when the extension was installed",
                                type: "number"
                            },
                            blockedCount: {
                                description: "The number of blocked requests",
                                type: "number"
                            },
                            isTrial: {
                                description: "Whether the user is on a trial",
                                type: "boolean"
                            },
                            trialDaysLeft: {
                                description: "Days left in trial",
                                type: ["number", "null"]
                            },
                            marketingConsent: {
                                description: "Whether the user consented to marketing emails",
                                type: "boolean"
                            },
                            dynamicRuleCount: {
                                description: "The number of dynamic DNR rules (MV3 only)",
                                type: "number"
                            },
                            staticRuleCount: {
                                description: "The number of static DNR rules (MV3 only)",
                                type: ["number", "null"]
                            },
                            filterLists: {
                                description: "Hashes of the first 10 active filter list URLs",
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            },
                            clientIdStability: {
                                description: "Frequency of the most common client ID in the client ID history, as a percentage of all entries. 0 if there isn't enough history yet.",
                                type: "number"
                            },
                            clientIdRotationFrequency: {
                                description: "How often the client ID rotates, in days (e.g. 1 for daily, 7 for weekly). 0 if there isn't enough history yet, or no rotation was observed.",
                                type: "number"
                            }
                        }
                    }
                }
            },
            dnr_filters: {
                recreated_dnr_rules: {
                    description: "On extension upgrade, our DNR filter management module will compare the dynamic DNR rules that the browser has with the filters that we know about. If these do not match, we recreate the DNR rules and log this report.",
                    data: {
                        description: "Report on the before and after state of the recreation",
                        type: "object",
                        properties: {
                            recreateStats: {
                                description: "Stats on how many DNR rules were recreated",
                                type: "object",
                                properties: {
                                    recreatedRulesCount: {
                                        description: "How many DNR rules were recreated",
                                        type: "integer"
                                    },
                                    removedRulesCount: {
                                        description: "How many existing DNR rules were removed",
                                        type: "integer"
                                    }
                                }
                            },
                            checkResultBefore: {
                                description: "Results of the data integrity check done before recreating the DNR rules.",
                                type: "object",
                                properties: {
                                    valid: {
                                        description: "True if the data integrity check passed. We only do the recreation if it failed, so this would be expected to always be false.",
                                        type: "boolean"
                                    },
                                    extraRulesInDNRCount: {
                                        description: "Count of the number of active dynamic DNR rules which we do not expect to see",
                                        type: "integer"
                                    },
                                    missingRulesInDNRCount: {
                                        description: "Count of the number of rules that our filters expected to exist but didn't",
                                        type: "integer"
                                    }
                                }
                            },
                            checkResultAfter: {
                                description: "Results of the data integrity check done after recreating the DNR rules.",
                                type: "object",
                                properties: {
                                    valid: {
                                        description: "True if the data integrity check passed. We expect this to be true after the rule recreation has run.",
                                        type: "boolean"
                                    },
                                    extraRulesInDNRCount: {
                                        description: "Count of the number of active dynamic DNR rules which we do not expect to see. We expect this to be 0 after the rule recreation has run.",
                                        type: "integer"
                                    },
                                    missingRulesInDNRCount: {
                                        description: "Count of the number of rules that our filters expected to exist but didn't. We expect this to be 0 after the rule recreation has run.",
                                        type: "integer"
                                    }
                                }
                            }
                        }
                    }
                },
                exceeded_static_rule_count_limit: {
                    description: "Debug log when someone runs into the 'set of enabled rulesets exceeds the rule count limit' error when enabling static rulesets",
                    data: {
                        description: "Data on the current state of static rules and the rulesets being enabled or disabled. Rule counts refer to static DNR rules, bundled in the extension at build time in rulesets.",
                        type: "object",
                        properties: {
                            enableRulesetIds: {
                                description: "Ruleset IDs that were to be enabled",
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            },
                            enableRuleCount: {
                                description: "Static rules that we are trying to enable",
                                type: "integer"
                            },
                            disableRulesetIds: {
                                description: "Ruleset IDs that were to be disabled",
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            },
                            disableRuleCount: {
                                description: "Static rules that we are trying to disable",
                                type: "integer"
                            },
                            currentEnabledRulesetIdsBefore: {
                                description: "Currently enabled ruleset IDs, gathered before calling updateEnabledRulesets",
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            },
                            currentEnabledRulesetIdsAfter: {
                                description: "Currently enabled ruleset IDs, gathered after calling updateEnabledRulesets",
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            },
                            currentEnabledRuleCountBefore: {
                                description: "Used static rules, gathered before calling updateEnabledRulesets",
                                type: "integer"
                            },
                            currentEnabledRuleCountAfter: {
                                description: "Used static rules, gathered after calling updateEnabledRulesets",
                                type: "integer"
                            },
                            availableRuleCountBefore: {
                                description: "Available static rules, gathered before calling updateEnabledRulesets",
                                type: "integer"
                            },
                            availableRuleCountAfter: {
                                description: "Available static rules, gathered after calling updateEnabledRulesets",
                                type: "integer"
                            }
                        }
                    }
                }
            },
            in_product_messaging: {
                command_received: {
                    description: "Extension received a valid IPM command from the remote config",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                }
            },
            startup: {
                startup_error: {
                    description: "Errors recorded during the initialization of the extension",
                    data: {
                        description: "Data about the initializion error",
                        type: "object",
                        properties: {
                            errorMsg: {
                                description: "The error message that was recorded",
                                type: "string"
                            },
                            hasInternalError: {
                                description: "Whether or not the error string matched 'internal error' which indicates that it is a browser error",
                                type: "boolean"
                            },
                            timings: {
                                description: "Profiling information about startup performance",
                                type: "object",
                                properties: {
                                    marks: {
                                        type: "array",
                                        description: "Specific points in time when something happened",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: {
                                                    description: "Name of the initialization step",
                                                    type: "string"
                                                },
                                                startTime: {
                                                    description: "Milliseconds elapsed since the service worker started",
                                                    type: "number"
                                                }
                                            }
                                        }
                                    },
                                    measures: {
                                        type: "array",
                                        description: "Measurements of how long steps took",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: {
                                                    description: "Name of the initialization step",
                                                    type: "string"
                                                },
                                                startTime: {
                                                    description: "When the measure started, in milliseconds elapsed since the service worker started",
                                                    type: "number"
                                                },
                                                duration: {
                                                    description: "Duration that the step took in milliseconds",
                                                    type: "number"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                subscriptions_reset: {
                    description: "Event logged when subscriptions are reset to defaults due to zero enabled subscriptions",
                    data: {
                        description: "Debug metadata about the subscription reset",
                        type: "object",
                        properties: {
                            subs: {
                                description: "The total number of subscriptions after reset",
                                type: "number"
                            },
                            enabledSubs: {
                                description: "The number of enabled subscriptions after reset",
                                type: "number"
                            },
                            enabledRulesets: {
                                description: "The number of enabled DNR rulesets after reset",
                                type: "number"
                            },
                            totalUserFilters: {
                                description: "The total number of user filters after reset",
                                type: "number"
                            },
                            dynamicRules: {
                                description: "The number of dynamic DNR rules after reset",
                                type: "number"
                            },
                            dataCorrupted: {
                                description: "Whether the data is corrupted. True if the extension has detected that storage has thrown an error.",
                                type: "boolean"
                            },
                            firstRun: {
                                description: "Whether this is the first run of the extension based on the number of subscriptions and user filters.",
                                type: "boolean"
                            },
                            reinitialized: {
                                description: "Whether the extension was reinitialized before reset.",
                                type: "boolean"
                            },
                            errorMsg: {
                                description: "Errors that occurred when readding subscriptions, if any, joined together with \"; \" if there was more than one",
                                type: ["string", "null"]
                            },
                            lastErrorMsg: {
                                description: "The last error in the browser runtime, if any",
                                type: ["string", "null"]
                            }
                        }
                    }
                }
            },
            customer_lifecycle: {
                new_install_normal: {
                    description: "The extension was installed from the browser's official web store (Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons)"
                },
                new_install_development: {
                    description: "The extension was installed manually in development mode, either as an unpacked directory or from a local .zip/.crx/.xpi package"
                },
                new_install_admin: {
                    description: "The extension was installed and managed by an administrator through a policy setting"
                },
                new_install_sideload: {
                    description: "The extension was installed by other software on the user's computer"
                },
                new_install_other: {
                    description: "The extension was installed through an unrecognized method not covered by other install types(normal/development/admin/sideload)"
                },
                new_install_unknown: {
                    description: "The extension was installed but the installation type could not be determined"
                },
                trial_license_expired: {
                    description: "The premium trial license has expired"
                }
            },
            new_tab: {
                command_ready: {
                    description: "'create_tab' IPM command has passed all checks and new tab is going to be created at the next possible opportunity",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                tab_created: {
                    description: "A tab has been created for the IPM command",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                tab_loaded: {
                    description: "The contents of the tab for the IPM command have been loaded",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                }
            },
            onpage_dialog: {
                command_ready: {
                    description: "'create_on_page_dialog' IPM command has passed all checks and on-page dialog is going to be created at the next possible opportunity",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                }
            },
            onpage_dialog_ui: {
                dialog_button_clicked: {
                    description: "The user clicked on the button presented on the dialog",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                dialog_closed: {
                    description: "The user closed the dialog by clicking the close icon in the dialog header",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                dialog_ignored: {
                    description: "The user did not interact with the dialog while being injected into the page, and the dialog no longer can be interacted with",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                dialog_injected: {
                    description: "The extension injected the dialog into the page and rendered it. This doesn't mean that the dialog is visible to the user, or that it looks as expected",
                    data: {
                        description: "IPM command ID",
                        type: "string"
                    }
                },
                dialog_display_duration: {
                    description: "How long the dialog was visible in MS before it was dismissed",
                    data: {
                        description: "Information about the dismissal",
                        type: "object",
                        properties: {
                            terminationCause: {
                                description: "Termination reason closed: tab_navigated or tab_removed",
                                type: "string"
                            },
                            durationMs: {
                                description: "How long the OPD was displayed",
                                type: "number"
                            },
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            }
                        }
                    }
                }
            },
            persistent_opd: {
                rendered: {
                    description: "The on-page dialog was rendered, recording which impression this was for the campaign. Every qualifying page load counts, including a refresh of the same page, so impressions are not the same as distinct visits",
                    data: {
                        description: "Impression details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "Which impression this was for the campaign, 1-based",
                                type: "number"
                            }
                        }
                    }
                },
                clicked: {
                    description: "The user clicked the button on the dialog, recording which impression this was",
                    data: {
                        description: "Impression details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "Which impression this was for the campaign, 1-based",
                                type: "number"
                            }
                        }
                    }
                },
                closed: {
                    description: "The user closed the dialog with the close icon, recording which impression this was",
                    data: {
                        description: "Impression details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "Which impression this was for the campaign, 1-based",
                                type: "number"
                            }
                        }
                    }
                },
                ignored: {
                    description: "The impression ended without the user interacting with the dialog. Two code paths observe a tab navigating away and neither can claim the impression from the other, so a single impression can be reported more than once: deduplicate on campaign, impression and reason rather than summing events",
                    data: {
                        description: "Impression details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "Which impression this was for the campaign, 1-based",
                                type: "number"
                            },
                            reason: {
                                description: "How the impression ended: display_duration_elapsed, tab_navigated or tab_removed",
                                type: "string",
                                enum: ["display_duration_elapsed", "tab_navigated", "tab_removed"]
                            }
                        }
                    }
                },
                exhausted: {
                    description: "The campaign reached its impression cap without the user ever interacting with the dialog. Can be reported more than once for the same campaign, when page loads in separate tabs observe the cap at the same time, so count distinct campaigns rather than events",
                    data: {
                        description: "Impression details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "How many impressions the campaign had used when it was exhausted",
                                type: "number"
                            }
                        }
                    }
                },
                injection_failed: {
                    description: "An impression was counted but the dialog could not be injected into the page",
                    data: {
                        description: "Failure details",
                        type: "object",
                        properties: {
                            ipmId: {
                                description: "The ID of the IPM OPD campaign",
                                type: "string"
                            },
                            displayCount: {
                                description: "Which impression this was for the campaign, 1-based",
                                type: "number"
                            },
                            reason: {
                                description: "Classified failure reason: no_receiver, no_tab or other",
                                type: "string",
                                enum: ["no_receiver", "no_tab", "other"]
                            }
                        }
                    }
                }
            },
            test_ewe_background: {
                test_event: {
                    description: "TEST: A logging test event for various types of data",
                    data: {
                        description: "Arbitrary test data",
                        type: "any"
                    }
                },
                test_event_no_data: {
                    description: "TEST: A logging test event that has no associated data"
                }
            },
            test_ewe_content_api: {
                test_got_experiment_flag: {
                    description: "TEST: In the content test script, an experiment was loaded",
                    data: {
                        description: "Information about the loaded experiment",
                        type: "object",
                        properties: {
                            flagName: {
                                description: "The flag name that was loaded",
                                type: "string"
                            },
                            flag: {
                                description: "The loaded value",
                                type: "any"
                            }
                        }
                    }
                }
            },
            test_ewe_ui_api: {
                test_message_received: {
                    description: "TEST: A logger test event indicating the UI page received a request to log",
                    data: {
                        description: "The data sent to the test listener",
                        type: "any"
                    }
                },
                test_event: {
                    description: "TEST: A logging test event for various types of data",
                    data: {
                        description: "Arbitrary test data",
                        type: "any"
                    }
                },
                test_event_no_data: {
                    description: "TEST: A logging test event that has no associated data"
                }
            },
            reverse_trial: {
                dialog_shown: {
                    description: "The reverse trial dialog was shown to the user",
                    data: {
                        description: "Details about the dialog shown",
                        type: "object",
                        properties: {
                            touchPointStep: {
                                description: "The touch point step number of the dialog shown",
                                type: "number"
                            },
                            installDate: {
                                description: "The timestamp when the extension was installed",
                                type: "number"
                            },
                            reverseTrialStartDate: {
                                description: "The timestamp when the reverse trial started",
                                type: "number"
                            }
                        }
                    }
                },
                dialog_skipped_yt_premium: {
                    description: "The reverse trial dialog would have been shown but was skipped because the user has YouTube Premium",
                    data: {
                        description: "Details about the skipped dialog",
                        type: "object",
                        properties: {
                            touchPointStep: {
                                description: "The touch point step number of the dialog that was skipped",
                                type: "number"
                            },
                            installDate: {
                                description: "The timestamp when the extension was installed",
                                type: "number"
                            },
                            reverseTrialStartDate: {
                                description: "The timestamp when the reverse trial started",
                                type: "number"
                            }
                        }
                    }
                },
                dialog_should_still_show_checked: {
                    description: "The service worker checked whether a visible reverse trial dialog should still be shown after the tab became active",
                    data: {
                        description: "Details about the check",
                        type: "object",
                        properties: {
                            touchPointStep: {
                                description: "The touch point step number of the dialog being checked",
                                type: "number"
                            },
                            shouldStillShow: {
                                description: "Whether the dialog should remain visible",
                                type: "boolean"
                            },
                            installDate: {
                                description: "The timestamp when the extension was installed",
                                type: "number"
                            },
                            reverseTrialStartDate: {
                                description: "The timestamp when the reverse trial started",
                                type: "number"
                            }
                        }
                    }
                },
                dialog_action: {
                    description: "The user interacted with the reverse trial dialog",
                    data: {
                        description: "Details about the interaction",
                        type: "object",
                        properties: {
                            action: {
                                description: "Identifier of the clicked element: the i18n key of a configured ctaButton or link (e.g. 'mid_cta', 'mid_end_trial'), or an uppercase built-in value ('CLOSE' for the x button, 'AUTO_DISMISS' for the auto-dismiss timeout)",
                                type: "string"
                            },
                            touchPointStep: {
                                description: "The touch point step number of the dialog that was interacted with",
                                type: "number"
                            },
                            installDate: {
                                description: "The timestamp when the extension was installed",
                                type: "number"
                            },
                            reverseTrialStartDate: {
                                description: "The timestamp when the reverse trial started",
                                type: "number"
                            }
                        }
                    }
                },
                config_validation_failed: {
                    description: "The remote reverse-trial OPD config failed validation. Fires at load time when the experiment flag is present but the schema is invalid (e.g. missing field, unknown action type, URL not on the allowlist), and at runtime when a NAVIGATE URL fails the allowlist check after template substitution. The full URL is intentionally not logged because template variables may contain PII.",
                    data: {
                        description: "Details about the validation failure.",
                        type: "object",
                        properties: {
                            reason: {
                                description: "Why validation failed. Load-time reasons include 'config_missing' (flag absent despite the user being in a reverse-trial variant), 'trial_duration_days_invalid', 'require_opt_in_invalid', 'steps_invalid', 'step_id_invalid', 'step_title_invalid', 'step_body_invalid', 'step_i18n_en_missing', 'step_i18n_key_missing_in_en', 'navigate_url_missing', 'navigate_url_not_allowlisted', 'action_type_unknown'. Runtime reason is 'url_validation_failed_after_substitution'.",
                                type: "string"
                            },
                            hostname: {
                                description: "Hostname of the failing URL for runtime URL validation failures; absent for load-time schema failures.",
                                type: "string"
                            }
                        }
                    }
                }
            },
            remote_config: {
                validation_error: {
                    description: "The remote config failed validation and was not applied.",
                    data: {
                        description: "The error messages from the validator.",
                        type: "array",
                        items: {
                            type: "string"
                        }
                    }
                },
                invalid_condition: {
                    description: "The remote config contained conditions referencing facts or operators not recognized by this client version. The config was applied; affected conditions should be skipped at evaluation time.",
                    data: {
                        description: "The warning messages from the validator for each unrecognized fact or operator.",
                        type: "array",
                        items: {
                            type: "string"
                        }
                    }
                }
            }
        });
        ;
        const DEBUG = 1;
        const INFO = 2;
        const BEHAVIOR = 3;
        const WARN = 4;
        const OFF = 5;
        const logLevelNamesToNumbers = {
            debug: DEBUG,
            info: INFO,
            behavior: BEHAVIOR,
            warn: WARN,
            off: OFF
        };
        const logLevelNumbersToNames = Object.fromEntries(Object.entries(logLevelNamesToNumbers).map(([key, value]) => [value, key]));
        function isPlainObject(obj) {
            if (obj === null || typeof obj !== "object") {
                return false;
            }
            const proto = Object.getPrototypeOf(obj);
            return proto === Object.prototype || proto === null;
        }
        function isSerializableToJson(data, seen = new WeakSet()) {
            let type = typeof data;
            if (data === null || type == "undefined" || type == "string" || type == "boolean") {
                return true;
            }
            if (type == "number") {
                return Number.isFinite(data);
            }
            if (isPlainObject(data)) {
                if (seen.has(data)) {
                    return false;
                }
                seen.add(data);
                return Object.values(data).every(x => isSerializableToJson(x, seen));
            }
            if (Array.isArray(data)) {
                if (seen.has(data)) {
                    return false;
                }
                seen.add(data);
                return data.every(x => isSerializableToJson(x, seen));
            }
            return false;
        }
        function matchesEventSchema(data, dataSchema) {
            let dataType = typeof data;
            if (dataType === "undefined" || !dataSchema) {
                return (dataType === "undefined" || data === null) && !dataSchema;
            }
            let types = dataSchema.type;
            if (typeof types === "string") {
                types = [types];
            }
            let typeMatches = types.some(type => {
                switch (type) {
                    case "any":
                        return true;
                    case "boolean":
                    case "number":
                    case "string":
                        return dataType === type;
                    case "null":
                        return data === null;
                    case "integer":
                        return Number.isInteger(data);
                    case "object":
                        return isPlainObject(data) &&
                            Object.keys(dataSchema.properties).every(key => matchesEventSchema(data[key], dataSchema.properties[key]));
                    case "array":
                        return Array.isArray(data) && data.every(item => matchesEventSchema(item, dataSchema.items));
                }
                return false;
            });
            if (!typeMatches) {
                return false;
            }
            if (typeof dataSchema.enum !== "undefined") {
                if (!dataSchema.enum.includes(data)) {
                    return false;
                }
            }
            return true;
        }
        class AbstractLogger {
            constructor(module, defaultEvents = events) {
                this._module = module;
                this._events = defaultEvents;
                if (!this._events[this._module]) {
                    console.error(`Unknown module: ${module}. ` +
                        "Did you remember to add it to core/sdk/events.js?");
                }
            }
            _log(level, event, data, ipmId) {
                if (!this._events[this._module]) {
                    return;
                }
                if (!this._events[this._module][event]) {
                    console.error(`Unknown event: ${event} in module: ${this._module}. ` +
                        "Did you remember to add it to core/sdk/events.js?");
                    return;
                }
                if (!isSerializableToJson(data)) {
                    console.error(`Data for event: ${event} in module: ${this._module} cannot be serialized to JSON.`);
                    return;
                }
                const dataSchema = this._events[this._module][event].data;
                if (!matchesEventSchema(data, dataSchema)) {
                    console.error(`Data for event: ${event} in module: ${this._module} does not match the schema ` +
                        "provided in core/sdk/events.js. ", { data, dataSchema });
                    return;
                }
                const logTime = new Date().toISOString();
                this._validatedLog(logTime, level, event, data, ipmId);
            }
            _validatedLog(logTime, level, event, data, ipmId) {
            }
            debug(event, data) {
                this._log(DEBUG, event, data);
            }
            info(event, data) {
                this._log(INFO, event, data);
            }
            behavior(event, data, ipmId) {
                this._log(BEHAVIOR, event, data, ipmId);
            }
            warn(event, data) {
                this._log(WARN, event, data);
            }
        }
        ;
        class ServerLogger extends AbstractLogger {
            _validatedLog(logTime, level, event, data) {
                void ignoreNoConnectionError(browser_polyfill.runtime.sendMessage({
                    type: "ewe:telemetry-log",
                    logTime,
                    module: this._module,
                    level,
                    event,
                    data
                }));
            }
        }
        const telemetry = ({
            ServerLogger
        });
        ;
        return __nested_webpack_exports__;
    })();
});

});

;// ./src/id/shared/uuid.ts
const { crypto: uuid_crypto } = self;
function generateUUID() {
    const uuid = new Uint16Array(8);
    uuid_crypto.getRandomValues(uuid);
    uuid[3] = (uuid[3] & 0x0fff) | 0x4000;
    uuid[4] = (uuid[4] & 0x3fff) | 0x8000;
    const uuidChunks = [];
    for (let i = 0; i < uuid.length; i += 1) {
        const component = uuid[i].toString(16);
        uuidChunks.push(`000${component}`.slice(-4));
        if (i >= 1 && i <= 4) {
            uuidChunks.push("-");
        }
    }
    return uuidChunks.join("");
}
function getUUID() {
    return "randomUUID" in uuid_crypto ? uuid_crypto.randomUUID() : generateUUID();
}

;// ./js/common.mjs
function convertDoclinks() {
    const links = document.querySelectorAll("a[data-doclink]");
    for (const link of links) {
        getDoclink(link.dataset.doclink).then((url) => {
            link.target = link.target || "_blank";
            link.href = url;
        });
    }
}
function getDoclink(link) {
    return browser.runtime.sendMessage({
        type: "app.get",
        what: "doclink",
        link
    });
}
function getErrorMessage(error) {
    let message = null;
    if (error) {
        let messageId = error.reason || error.type;
        let placeholders = [];
        if (error.reason === "filter_unknown_option") {
            if (error.option)
                placeholders = [error.option];
            else
                messageId = "filter_invalid_option";
        }
        message = browser.i18n.getMessage(messageId, placeholders);
    }
    if (!message) {
        message = browser.i18n.getMessage("filter_action_failed");
    }
    if (!error || typeof error.lineno !== "number")
        return message;
    return browser.i18n.getMessage("line", [
        error.lineno.toLocaleString(),
        message
    ]);
}
function getSourceAttribute(element) {
    const sourceContainer = element.closest("[data-source]");
    if (!sourceContainer)
        return null;
    return sourceContainer.dataset.source;
}

;// ./js/dom.mjs
const $ = (selector, container) => {
    if (!container)
        container = document;
    return container.querySelector(selector);
};
const $$ = (selector, container) => {
    if (!container)
        container = document;
    return container.querySelectorAll(selector);
};
const clipboard = (/* unused pure expression or super */ null && ({
    copy(text) {
        const selection = document.getSelection();
        const selected = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.cssText = "position:fixed;top:-999px";
        document.body.appendChild(el).select();
        document.execCommand("copy");
        document.body.removeChild(el);
        if (selected) {
            selection.removeAllRanges();
            const range = document.createRange();
            range.setStart(selected.startContainer, selected.startOffset);
            range.setEnd(selected.endContainer, selected.endOffset);
            selection.addRange(range);
        }
    },
    paste(event) {
        if (!event)
            event = window;
        const clipboardData = event.clipboardData || window.clipboardData;
        return clipboardData ? clipboardData.getData("text") : "";
    }
}));
function relativeCoordinates(event) {
    return { x: event.offsetX, y: event.offsetY };
}
function asIndentedString(element, indentation = 0) {
    if (!indentation) {
        if (element.nodeType === Node.DOCUMENT_NODE)
            element = element.documentElement;
        if (element.nodeType !== Node.ELEMENT_NODE)
            throw new Error("Unable to serialize " + element);
        element = element.cloneNode(true);
    }
    const before = "  ".repeat(indentation + 1);
    const after = "  ".repeat(indentation);
    const doc = element.ownerDocument;
    for (const child of Array.from(element.childNodes)) {
        const { nodeType } = child;
        if (nodeType === Node.ELEMENT_NODE || nodeType === Node.TEXT_NODE) {
            if (nodeType === Node.TEXT_NODE) {
                const content = child.textContent.trim();
                child.textContent = content.length ? `\n${before}${content}` : "";
            }
            else {
                element.insertBefore(doc.createTextNode(`\n${before}`), child);
                asIndentedString(child, indentation + 1);
            }
        }
        if (child === element.lastChild)
            element.appendChild(doc.createTextNode(`\n${after}`));
    }
    if (indentation)
        return "";
    if (/^https?:\/\/www\.w3\.org\/1999\/xhtml$/.test(element.namespaceURI))
        return element.outerHTML;
    return new XMLSerializer().serializeToString(element);
}

// EXTERNAL MODULE: ../../node_modules/webextension-polyfill/src/browser-polyfill.js
var browser_polyfill = __webpack_require__(3651);
var browser_polyfill_default = /*#__PURE__*/__webpack_require__.n(browser_polyfill);
;// ./src/i18n/ui/i18n.ts

const i18nAttributes = ["alt", "placeholder", "title", "value"];
function assignAction(elements, action) {
    for (const element of elements) {
        switch (typeof action) {
            case "string":
                element.href = action;
                element.target = "_blank";
                break;
            case "function":
                element.href = "#";
                element.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    action();
                });
                break;
        }
    }
}
function* getRemainingLinks(parent) {
    const links = parent.querySelectorAll("a:not([data-i18n-index])");
    for (const link of links) {
        yield link;
    }
}
function setElementLinks(idOrElement, ...actions) {
    var _a;
    const element = typeof idOrElement === "string"
        ? document.getElementById(idOrElement)
        : idOrElement;
    if (element === null) {
        return;
    }
    const remainingLinks = getRemainingLinks(element);
    for (let i = 0; i < actions.length; i++) {
        const links = element.querySelectorAll(`a[data-i18n-index='${i}']`);
        if (links.length > 0) {
            assignAction(links, actions[i]);
            continue;
        }
        const link = remainingLinks.next();
        if ((_a = link.done) !== null && _a !== void 0 ? _a : false) {
            continue;
        }
        assignAction([link.value], actions[i]);
    }
}
function stripTagsUnsafe(text) {
    return text.replace(/<\/?[^>]+>/g, "");
}
function setElementText(element, stringName, args, children = []) {
    function processString(str, currentElement) {
        const match = /^(.*?)<(a|em|slot|strong)(\d)?>(.*?)<\/\2\3>(.*)$/.exec(str);
        if (match !== null) {
            const [, before, name, index, innerText, after] = match;
            processString(before, currentElement);
            if (name === "slot") {
                const e = children[Number(index)];
                if (e !== undefined) {
                    currentElement.appendChild(e);
                }
            }
            else {
                const e = document.createElement(name);
                if (typeof index !== "undefined") {
                    e.dataset.i18nIndex = index;
                }
                processString(innerText, e);
                currentElement.appendChild(e);
            }
            processString(after, currentElement);
        }
        else {
            currentElement.appendChild(document.createTextNode(str));
        }
    }
    while (element.lastChild !== null) {
        element.removeChild(element.lastChild);
    }
    processString(browser_polyfill_default().i18n.getMessage(stringName, args !== null && args !== void 0 ? args : undefined), element);
}
function loadI18nStrings() {
    function resolveStringNames(container) {
        var _a, _b;
        if (container === null || container === undefined) {
            return;
        }
        {
            const elements = container.querySelectorAll("[data-i18n]");
            for (const element of elements) {
                const children = Array.from(element.children);
                setElementText(element, (_a = element.dataset.i18n) !== null && _a !== void 0 ? _a : "", null, children);
            }
        }
        for (const attr of i18nAttributes) {
            const elements = container.querySelectorAll(`[data-i18n-${attr}]`);
            for (const element of elements) {
                const stringName = (_b = element.getAttribute(`data-i18n-${attr}`)) !== null && _b !== void 0 ? _b : "";
                element.setAttribute(attr, browser_polyfill_default().i18n.getMessage(stringName));
            }
        }
    }
    resolveStringNames(document);
    for (const template of document.querySelectorAll("template")) {
        resolveStringNames(template.content);
    }
}
function isLocaleInfo(candidate) {
    return (candidate !== null &&
        typeof candidate === "object" &&
        "bidiDir" in candidate &&
        "locale" in candidate);
}
async function setLanguageAttributes() {
    const localeInfo = await browser_polyfill_default().runtime.sendMessage({
        type: "app.get",
        what: "localeInfo"
    });
    if (!isLocaleInfo(localeInfo)) {
        return;
    }
    document.documentElement.lang = localeInfo.locale;
    document.documentElement.dir = localeInfo.bidiDir;
}
function initI18n() {
    void setLanguageAttributes();
    loadI18nStrings();
}

;// ./src/i18n/ui/index.ts


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

function category_requests_listen(filter, tabId) {
    listen({ type: "requests", filter, tabId });
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

;// ./src/core/messaging/front/utils.ts
async function utils_send(sendType, options = {}) {
    const args = {
        ...options,
        type: sendType
    };
    return await browser.runtime.sendMessage(args);
}

;// ./src/core/messaging/front/category-subscriptions.ts


async function category_subscriptions_add(url) {
    const options = { url };
    return await utils_send("subscriptions.add", options);
}
async function category_subscriptions_get(options) {
    return await utils_send("subscriptions.get", options !== null && options !== void 0 ? options : {});
}
async function getInitIssues() {
    return await utils_send("subscriptions.getInitIssues");
}
async function getRecommendations() {
    return await utils_send("subscriptions.getRecommendations");
}
function category_subscriptions_listen(filter) {
    listen({ type: "subscriptions", filter });
}
async function category_subscriptions_remove(url) {
    const options = { url };
    await utils_send("subscriptions.remove", options);
}

;// ./src/core/messaging/front/index.ts




















;// ./js/pages/issue-reporter/report.mjs


const reportData = new DOMParser().parseFromString("<report></report>", "text/xml");
let dataGatheringTabId = null;
let isMinimumTimeMet = false;
function getOriginalTabId() {
    const tabId = parseInt(location.search.replace(/^\?/, ""), 10);
    if (!tabId && tabId !== 0) {
        console.warn("Missing tab id. Try appending '?1' to the end of the url.");
        throw new Error("invalid tab id");
    }
    return tabId;
}
addMessageListener((message) => {
    if (message.type !== "requests.respond" || message.action !== "hits")
        return;
    const [request, filter, subscriptions] = message.args;
    const requestsContainerElem = $("requests", reportData);
    const filtersElem = $("filters", reportData);
    if (request.url) {
        let requestElem = $(`[location="${request.url}"]`, reportData);
        if (!requestElem) {
            requestElem = reportData.createElement("request");
            requestElem.setAttribute("location", censorURL(request.url));
            requestElem.setAttribute("type", request.type);
            requestElem.setAttribute("docDomain", request.docDomain);
            requestElem.setAttribute("thirdParty", request.thirdParty);
            requestElem.setAttribute("count", 0);
            requestsContainerElem.appendChild(requestElem);
        }
        const countNum = parseInt(requestElem.getAttribute("count"), 10);
        requestElem.setAttribute("count", countNum + 1);
        if (filter)
            requestElem.setAttribute("filter", filter.text);
    }
    if (filter) {
        const escapedText = CSS.escape(filter.text);
        const existingFilter = $(`[text="${escapedText}"]`, reportData);
        if (existingFilter) {
            const countNum = parseInt(existingFilter.getAttribute("hitCount"), 10);
            existingFilter.setAttribute("hitCount", countNum + 1);
        }
        else {
            const filterElem = reportData.createElement("filter");
            filterElem.setAttribute("text", filter.text);
            const subscriptionUrls = subscriptions.map((subscription) => subscription.url);
            filterElem.setAttribute("subscriptions", subscriptionUrls.join(" "));
            filterElem.setAttribute("hitCount", 1);
            filtersElem.appendChild(filterElem);
        }
    }
});
function collectRequests(tabId) {
    reportData.documentElement.appendChild(reportData.createElement("requests"));
    reportData.documentElement.appendChild(reportData.createElement("filters"));
    return browser.tabs
        .get(tabId)
        .then((tab) => {
        return browser.tabs.create({ active: false, url: tab.url });
    })
        .then((tab) => {
        dataGatheringTabId = tab.id;
        category_requests_listen(["hits"], dataGatheringTabId);
        function minimumTimeMet() {
            if (isMinimumTimeMet)
                return;
            isMinimumTimeMet = true;
            document.getElementById("showData").disabled = false;
            $("io-steps").dispatchEvent(new CustomEvent("requestcollected"));
            validateCommentsPage();
        }
        browser.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
            if (updatedTabId == dataGatheringTabId &&
                changeInfo.status == "complete")
                minimumTimeMet();
        });
        window.setTimeout(minimumTimeMet, 5000);
        window.addEventListener("beforeunload", (event) => {
            closeRequestsCollectingTab();
        });
    });
}
let closedRequestsCollectingTab;
function closeRequestsCollectingTab() {
    if (!closedRequestsCollectingTab)
        closedRequestsCollectingTab = browser.tabs.remove(dataGatheringTabId);
    return closedRequestsCollectingTab;
}
function retrieveAddonInfo() {
    const element = reportData.createElement("adblock-plus");
    return browser.runtime
        .sendMessage({
        type: "app.get",
        what: "addonVersion"
    })
        .then((addonVersion) => {
        element.setAttribute("version", addonVersion);
        return browser.runtime.sendMessage({
            type: "app.get",
            what: "localeInfo"
        });
    })
        .then(({ locale }) => {
        element.setAttribute("locale", locale);
        reportData.documentElement.appendChild(element);
    });
}
function retrieveApplicationInfo() {
    const element = reportData.createElement("application");
    return browser.runtime
        .sendMessage({
        type: "app.get",
        what: "application"
    })
        .then((application) => {
        element.setAttribute("name", capitalize(application));
        return browser.runtime.sendMessage({
            type: "app.get",
            what: "applicationVersion"
        });
    })
        .then((applicationVersion) => {
        element.setAttribute("version", applicationVersion);
        element.setAttribute("vendor", navigator.vendor);
        element.setAttribute("userAgent", navigator.userAgent);
        reportData.documentElement.appendChild(element);
    });
}
function retrievePlatformInfo() {
    const element = reportData.createElement("platform");
    const { getBrowserInfo, sendMessage } = browser.runtime;
    return Promise.all([
        getBrowserInfo ? getBrowserInfo() : null,
        sendMessage({
            type: "app.get",
            what: "platform"
        }),
        sendMessage({
            type: "app.get",
            what: "platformVersion"
        })
    ]).then(([browserInfo, platform, platformVersion]) => {
        if (browserInfo) {
            element.setAttribute("build", browserInfo.buildID);
        }
        element.setAttribute("name", capitalize(platform));
        element.setAttribute("version", platformVersion);
        reportData.documentElement.appendChild(element);
    });
}
async function retrieveWindowInfo(tabId) {
    const tab = await browser.tabs.get(tabId);
    let openerUrl = null;
    let referrerUrl = null;
    if (tab.openerTabId) {
        const openerTab = await browser.tabs.get(tab.openerTabId);
        openerUrl = openerTab.url;
    }
    if (browser.scripting) {
        const [frameResult] = await browser.scripting.executeScript({
            target: { tabId },
            func: () => document.referrer
        });
        referrerUrl = frameResult.result;
    }
    else {
        [referrerUrl] = await browser.tabs.executeScript(tabId, {
            code: "document.referrer"
        });
    }
    const element = reportData.createElement("window");
    if (openerUrl) {
        element.setAttribute("opener", censorURL(openerUrl));
    }
    if (referrerUrl) {
        element.setAttribute("referrer", censorURL(referrerUrl));
    }
    element.setAttribute("url", censorURL(tab.url));
    reportData.documentElement.appendChild(element);
}
function retrieveSubscriptions() {
    return category_subscriptions_get({
        ignoreDisabled: true,
        disabledFilters: true
    })
        .then((subscriptions) => {
        const element = reportData.createElement("subscriptions");
        for (const subscription of subscriptions) {
            if (!/^(http|https|ftp):/.test(subscription.url))
                continue;
            const now = Math.round(Date.now() / 1000);
            const subscriptionElement = reportData.createElement("subscription");
            subscriptionElement.setAttribute("id", subscription.url);
            if (subscription.version)
                subscriptionElement.setAttribute("version", subscription.version);
            if (subscription.lastDownload) {
                subscriptionElement.setAttribute("lastDownloadAttempt", subscription.lastDownload - now);
            }
            if (subscription.lastSuccess) {
                subscriptionElement.setAttribute("lastDownloadSuccess", subscription.lastSuccess - now);
            }
            if (subscription.softExpiration) {
                subscriptionElement.setAttribute("softExpiration", subscription.softExpiration - now);
            }
            if (subscription.expires) {
                subscriptionElement.setAttribute("hardExpiration", subscription.expires - now);
            }
            if (subscription.downloadStatus) {
                subscriptionElement.setAttribute("downloadStatus", subscription.downloadStatus);
            }
            subscriptionElement.setAttribute("disabledFilters", subscription.disabledFilters.length);
            element.appendChild(subscriptionElement);
        }
        reportData.documentElement.appendChild(element);
    });
}
function setConfigurationInfo(configInfo) {
    let extensionsContainer = $("extensions", reportData);
    let optionsContainer = $("options", reportData);
    if (!configInfo) {
        if (extensionsContainer) {
            extensionsContainer.parentNode.removeChild(extensionsContainer);
        }
        if (optionsContainer) {
            optionsContainer.parentNode.removeChild(optionsContainer);
        }
        return;
    }
    if (!extensionsContainer) {
        extensionsContainer = reportData.createElement("extensions");
        reportData.documentElement.appendChild(extensionsContainer);
    }
    if (!optionsContainer) {
        optionsContainer = reportData.createElement("options");
        reportData.documentElement.appendChild(optionsContainer);
    }
    extensionsContainer.innerHTML = "";
    optionsContainer.innerHTML = "";
    const { extensions, options } = configInfo;
    for (const id in options) {
        const element = reportData.createElement("option");
        element.setAttribute("id", id);
        element.textContent = options[id];
        optionsContainer.appendChild(element);
    }
    for (const extension of extensions) {
        const element = reportData.createElement("extension");
        element.setAttribute("id", extension.id);
        element.setAttribute("name", extension.name);
        element.setAttribute("type", extension.type);
        if (extension.version) {
            element.setAttribute("version", extension.version);
        }
        extensionsContainer.appendChild(element);
    }
}
function proxyApiCall(apiId, ...args) {
    return new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.hidden = true;
        iframe.src = browser.runtime.getURL("proxy.html");
        iframe.onload = () => {
            function callback(...results) {
                document.body.removeChild(iframe);
                resolve(results[0]);
            }
            const proxy = iframe.contentWindow.browser;
            switch (apiId) {
                case "contentSettings.cookies":
                    if ("contentSettings" in proxy) {
                        proxy.contentSettings.cookies.get(...args, callback);
                    }
                    else {
                        callback(null);
                    }
                    break;
                case "contentSettings.javascript":
                    if ("contentSettings" in proxy) {
                        proxy.contentSettings.javascript.get(...args, callback);
                    }
                    else {
                        callback(null);
                    }
                    break;
                case "management.getAll":
                    if ("getAll" in proxy.management) {
                        proxy.management.getAll(...args).then(callback);
                    }
                    else {
                        callback(null);
                    }
                    break;
            }
        };
        document.body.appendChild(iframe);
    });
}
function retrieveExtensions() {
    return proxyApiCall("management.getAll")
        .then((installed) => {
        const extensions = [];
        for (const extension of installed) {
            if (!extension.enabled || extension.type != "extension")
                continue;
            extensions.push({
                id: extension.id,
                name: extension.name,
                type: "extension",
                version: extension.version
            });
        }
        const { plugins } = navigator;
        for (const plugin of plugins) {
            extensions.push({
                id: plugin.filename,
                name: plugin.name,
                type: "plugin"
            });
        }
        return extensions;
    })
        .catch((err) => {
        console.error("Could not retrieve list of extensions");
        return [];
    });
}
function retrieveOptions() {
    if (!("contentSettings" in browser))
        return Promise.resolve({});
    let tabId;
    try {
        tabId = getOriginalTabId();
    }
    catch (ex) {
        return Promise.reject(ex);
    }
    return browser.tabs
        .get(tabId)
        .then((tab) => {
        const details = { primaryUrl: tab.url, incognito: tab.incognito };
        return Promise.all([
            proxyApiCall("contentSettings.cookies", details),
            proxyApiCall("contentSettings.javascript", details),
            tab.incognito
        ]);
    })
        .then(([cookies, javascript, incognito]) => {
        return {
            cookieBehavior: cookies.setting == "allow" || cookies.setting == "session_only",
            javascript: javascript.setting == "allow",
            privateBrowsing: incognito
        };
    })
        .catch((err) => {
        console.error("Could not retrieve configuration options");
        return {};
    });
}
function updateConfigurationInfo(isAccessible) {
    if (!isAccessible) {
        setConfigurationInfo(null);
        return Promise.resolve();
    }
    return Promise.all([retrieveExtensions(), retrieveOptions()]).then(([extensions, options]) => {
        setConfigurationInfo({ extensions, options });
    });
}
function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
}
function censorURL(url) {
    return url.replace(/([?;&/#][^?;&/#]+?=)[^?;&/#]+/g, "$1*");
}
function setReportType(event) {
    reportData.documentElement.setAttribute("type", event.target.value);
}
for (const typeElement of $$("#typeSelectorGroup input")) {
    typeElement.addEventListener("change", setReportType);
}
let commentElement = null;
$("#comment").addEventListener("input", (event) => {
    const comment = event.target.value;
    if (!comment) {
        if (commentElement) {
            commentElement.parentNode.removeChild(commentElement);
            commentElement = null;
        }
    }
    else if (commentElement) {
        commentElement.textContent = comment;
    }
    else {
        commentElement = reportData.createElement("comment");
        commentElement.textContent = comment;
        reportData.documentElement.appendChild(commentElement);
    }
});
const anonSubmissionField = $("#anonymousSubmission");
const emailField = $("#email");
emailField.addEventListener("input", validateCommentsPage);
anonSubmissionField.addEventListener("click", validateCommentsPage);
const emailElement = reportData.createElement("email");
function validateCommentsPage() {
    const sendButton = $("#send");
    $("#anonymousSubmissionWarning").setAttribute("data-invisible", !anonSubmissionField.checked);
    if (anonSubmissionField.checked) {
        emailField.value = "";
        emailField.disabled = true;
        sendButton.disabled = !isMinimumTimeMet;
        if (emailElement.parentNode)
            emailElement.parentNode.removeChild(emailElement);
    }
    else {
        emailField.disabled = false;
        const value = emailField.value.trim();
        emailElement.textContent = value;
        reportData.documentElement.appendChild(emailElement);
        sendButton.disabled =
            value == "" || !emailField.validity.valid || !isMinimumTimeMet;
    }
    $("io-steps").dispatchEvent(new CustomEvent("formvalidated", { detail: !sendButton.disabled }));
}
function collectData() {
    let tabId;
    try {
        tabId = getOriginalTabId();
    }
    catch (ex) {
        return Promise.reject(ex);
    }
    return Promise.all([
        retrieveAddonInfo(),
        retrieveApplicationInfo(),
        retrievePlatformInfo(),
        retrieveWindowInfo(tabId),
        collectRequests(tabId),
        retrieveSubscriptions()
    ]).then(() => reportData);
}

;// ../../node_modules/@ungap/weakmap/esm/index.js
var esm_self = {};
try {
    esm_self.WeakMap = WeakMap;
}
catch (WeakMap) {
    esm_self.WeakMap = (function (id, Object) {
        'use strict';
        var dP = Object.defineProperty;
        var hOP = Object.hasOwnProperty;
        var proto = WeakMap.prototype;
        proto.delete = function (key) {
            return this.has(key) && delete key[this._];
        };
        proto.get = function (key) {
            return this.has(key) ? key[this._] : void 0;
        };
        proto.has = function (key) {
            return hOP.call(key, this._);
        };
        proto.set = function (key, value) {
            dP(key, this._, { configurable: true, value: value });
            return this;
        };
        return WeakMap;
        function WeakMap(iterable) {
            dP(this, '_', { value: '_@ungap/weakmap' + id++ });
            if (iterable)
                iterable.forEach(add, this);
        }
        function add(pair) {
            this.set(pair[0], pair[1]);
        }
    }(Math.random(), Object));
}
/* harmony default export */ const esm = (esm_self.WeakMap);

;// ../../node_modules/@ungap/essential-weakset/esm/index.js
var essential_weakset_esm_self = {};
try {
    essential_weakset_esm_self.WeakSet = WeakSet;
}
catch (WeakSet) {
    (function (id, dP) {
        var proto = WeakSet.prototype;
        proto.add = function (object) {
            if (!this.has(object))
                dP(object, this._, { value: true, configurable: true });
            return this;
        };
        proto.has = function (object) {
            return this.hasOwnProperty.call(object, this._);
        };
        proto.delete = function (object) {
            return this.has(object) && delete object[this._];
        };
        essential_weakset_esm_self.WeakSet = WeakSet;
        function WeakSet() {
            'use strict';
            dP(this, '_', { value: '_@ungap/weakmap' + id++ });
        }
    }(Math.random(), Object.defineProperty));
}
/* harmony default export */ const essential_weakset_esm = (essential_weakset_esm_self.WeakSet);

;// ../../node_modules/uarray/esm/index.js
const { isArray } = Array;
const { indexOf, slice } = [];


;// ../../node_modules/domdiff/esm/utils.js

const append = (get, parent, children, start, end, before) => {
    const isSelect = 'selectedIndex' in parent;
    let noSelection = isSelect;
    while (start < end) {
        const child = get(children[start], 1);
        parent.insertBefore(child, before);
        if (isSelect && noSelection && child.selected) {
            noSelection = !noSelection;
            let { selectedIndex } = parent;
            parent.selectedIndex = selectedIndex < 0 ?
                start :
                indexOf.call(parent.querySelectorAll('option'), child);
        }
        start++;
    }
};
const eqeq = (a, b) => a == b;
const identity = O => O;
const utils_indexOf = (moreNodes, moreStart, moreEnd, lessNodes, lessStart, lessEnd, compare) => {
    const length = lessEnd - lessStart;
    if (length < 1)
        return -1;
    while ((moreEnd - moreStart) >= length) {
        let m = moreStart;
        let l = lessStart;
        while (m < moreEnd &&
            l < lessEnd &&
            compare(moreNodes[m], lessNodes[l])) {
            m++;
            l++;
        }
        if (l === lessEnd)
            return moreStart;
        moreStart = m + 1;
    }
    return -1;
};
const isReversed = (futureNodes, futureEnd, currentNodes, currentStart, currentEnd, compare) => {
    while (currentStart < currentEnd &&
        compare(currentNodes[currentStart], futureNodes[futureEnd - 1])) {
        currentStart++;
        futureEnd--;
    }
    ;
    return futureEnd === 0;
};
const next = (get, list, i, length, before) => i < length ?
    get(list[i], 0) :
    (0 < i ?
        get(list[i - 1], -0).nextSibling :
        before);
const utils_remove = (get, children, start, end) => {
    while (start < end)
        drop(get(children[start++], -1));
};
const DELETION = -1;
const INSERTION = 1;
const SKIP = 0;
const SKIP_OND = 50;
const HS = (futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges) => {
    let k = 0;
    let minLen = futureChanges < currentChanges ? futureChanges : currentChanges;
    const link = Array(minLen++);
    const tresh = Array(minLen);
    tresh[0] = -1;
    for (let i = 1; i < minLen; i++)
        tresh[i] = currentEnd;
    const nodes = currentNodes.slice(currentStart, currentEnd);
    for (let i = futureStart; i < futureEnd; i++) {
        const index = nodes.indexOf(futureNodes[i]);
        if (-1 < index) {
            const idxInOld = index + currentStart;
            k = findK(tresh, minLen, idxInOld);
            if (-1 < k) {
                tresh[k] = idxInOld;
                link[k] = {
                    newi: i,
                    oldi: idxInOld,
                    prev: link[k - 1]
                };
            }
        }
    }
    k = --minLen;
    --currentEnd;
    while (tresh[k] > currentEnd)
        --k;
    minLen = currentChanges + futureChanges - k;
    const diff = Array(minLen);
    let ptr = link[k];
    --futureEnd;
    while (ptr) {
        const { newi, oldi } = ptr;
        while (futureEnd > newi) {
            diff[--minLen] = INSERTION;
            --futureEnd;
        }
        while (currentEnd > oldi) {
            diff[--minLen] = DELETION;
            --currentEnd;
        }
        diff[--minLen] = SKIP;
        --futureEnd;
        --currentEnd;
        ptr = ptr.prev;
    }
    while (futureEnd >= futureStart) {
        diff[--minLen] = INSERTION;
        --futureEnd;
    }
    while (currentEnd >= currentStart) {
        diff[--minLen] = DELETION;
        --currentEnd;
    }
    return diff;
};
const OND = (futureNodes, futureStart, rows, currentNodes, currentStart, cols, compare) => {
    const length = rows + cols;
    const v = [];
    let d, k, r, c, pv, cv, pd;
    outer: for (d = 0; d <= length; d++) {
        if (d > SKIP_OND)
            return null;
        pd = d - 1;
        pv = d ? v[d - 1] : [0, 0];
        cv = v[d] = [];
        for (k = -d; k <= d; k += 2) {
            if (k === -d || (k !== d && pv[pd + k - 1] < pv[pd + k + 1])) {
                c = pv[pd + k + 1];
            }
            else {
                c = pv[pd + k - 1] + 1;
            }
            r = c - k;
            while (c < cols &&
                r < rows &&
                compare(currentNodes[currentStart + c], futureNodes[futureStart + r])) {
                c++;
                r++;
            }
            if (c === cols && r === rows) {
                break outer;
            }
            cv[d + k] = c;
        }
    }
    const diff = Array(d / 2 + length / 2);
    let diffIdx = diff.length - 1;
    for (d = v.length - 1; d >= 0; d--) {
        while (c > 0 &&
            r > 0 &&
            compare(currentNodes[currentStart + c - 1], futureNodes[futureStart + r - 1])) {
            diff[diffIdx--] = SKIP;
            c--;
            r--;
        }
        if (!d)
            break;
        pd = d - 1;
        pv = d ? v[d - 1] : [0, 0];
        k = c - r;
        if (k === -d || (k !== d && pv[pd + k - 1] < pv[pd + k + 1])) {
            r--;
            diff[diffIdx--] = INSERTION;
        }
        else {
            c--;
            diff[diffIdx--] = DELETION;
        }
    }
    return diff;
};
const applyDiff = (diff, get, parentNode, futureNodes, futureStart, currentNodes, currentStart, currentLength, before) => {
    const live = [];
    const length = diff.length;
    let currentIndex = currentStart;
    let i = 0;
    while (i < length) {
        switch (diff[i++]) {
            case SKIP:
                futureStart++;
                currentIndex++;
                break;
            case INSERTION:
                live.push(futureNodes[futureStart]);
                append(get, parentNode, futureNodes, futureStart++, futureStart, currentIndex < currentLength ?
                    get(currentNodes[currentIndex], 0) :
                    before);
                break;
            case DELETION:
                currentIndex++;
                break;
        }
    }
    i = 0;
    while (i < length) {
        switch (diff[i++]) {
            case SKIP:
                currentStart++;
                break;
            case DELETION:
                if (-1 < live.indexOf(currentNodes[currentStart]))
                    currentStart++;
                else
                    utils_remove(get, currentNodes, currentStart++, currentStart);
                break;
        }
    }
};
const findK = (ktr, length, j) => {
    let lo = 1;
    let hi = length;
    while (lo < hi) {
        const mid = ((lo + hi) / 2) >>> 0;
        if (j < ktr[mid])
            hi = mid;
        else
            lo = mid + 1;
    }
    return lo;
};
const smartDiff = (get, parentNode, futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges, currentLength, compare, before) => {
    applyDiff(OND(futureNodes, futureStart, futureChanges, currentNodes, currentStart, currentChanges, compare) ||
        HS(futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges), get, parentNode, futureNodes, futureStart, currentNodes, currentStart, currentLength, before);
};
const drop = node => (node.remove || dropChild).call(node);
function dropChild() {
    const { parentNode } = this;
    if (parentNode)
        parentNode.removeChild(this);
}

;// ../../node_modules/domdiff/esm/index.js
/*! (c) 2018 Andrea Giammarchi (ISC) */

const domdiff = (parentNode, currentNodes, futureNodes, options) => {
    if (!options)
        options = {};
    const compare = options.compare || eqeq;
    const get = options.node || identity;
    const before = options.before == null ? null : get(options.before, 0);
    const currentLength = currentNodes.length;
    let currentEnd = currentLength;
    let currentStart = 0;
    let futureEnd = futureNodes.length;
    let futureStart = 0;
    while (currentStart < currentEnd &&
        futureStart < futureEnd &&
        compare(currentNodes[currentStart], futureNodes[futureStart])) {
        currentStart++;
        futureStart++;
    }
    while (currentStart < currentEnd &&
        futureStart < futureEnd &&
        compare(currentNodes[currentEnd - 1], futureNodes[futureEnd - 1])) {
        currentEnd--;
        futureEnd--;
    }
    const currentSame = currentStart === currentEnd;
    const futureSame = futureStart === futureEnd;
    if (currentSame && futureSame)
        return futureNodes;
    if (currentSame && futureStart < futureEnd) {
        append(get, parentNode, futureNodes, futureStart, futureEnd, next(get, currentNodes, currentStart, currentLength, before));
        return futureNodes;
    }
    if (futureSame && currentStart < currentEnd) {
        utils_remove(get, currentNodes, currentStart, currentEnd);
        return futureNodes;
    }
    const currentChanges = currentEnd - currentStart;
    const futureChanges = futureEnd - futureStart;
    let i = -1;
    if (currentChanges < futureChanges) {
        i = utils_indexOf(futureNodes, futureStart, futureEnd, currentNodes, currentStart, currentEnd, compare);
        if (-1 < i) {
            append(get, parentNode, futureNodes, futureStart, i, get(currentNodes[currentStart], 0));
            append(get, parentNode, futureNodes, i + currentChanges, futureEnd, next(get, currentNodes, currentEnd, currentLength, before));
            return futureNodes;
        }
    }
    else if (futureChanges < currentChanges) {
        i = utils_indexOf(currentNodes, currentStart, currentEnd, futureNodes, futureStart, futureEnd, compare);
        if (-1 < i) {
            utils_remove(get, currentNodes, currentStart, i);
            utils_remove(get, currentNodes, i + futureChanges, currentEnd);
            return futureNodes;
        }
    }
    if ((currentChanges < 2 || futureChanges < 2)) {
        append(get, parentNode, futureNodes, futureStart, futureEnd, get(currentNodes[currentStart], 0));
        utils_remove(get, currentNodes, currentStart, currentEnd);
        return futureNodes;
    }
    if (currentChanges === futureChanges &&
        isReversed(futureNodes, futureEnd, currentNodes, currentStart, currentEnd, compare)) {
        append(get, parentNode, futureNodes, futureStart, futureEnd, next(get, currentNodes, currentEnd, currentLength, before));
        return futureNodes;
    }
    smartDiff(get, parentNode, futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges, currentLength, compare, before);
    return futureNodes;
};
/* harmony default export */ const domdiff_esm = (domdiff);

;// ../../node_modules/@ungap/custom-event/esm/index.js
var custom_event_esm_self = {};
custom_event_esm_self.CustomEvent = typeof CustomEvent === 'function' ?
    CustomEvent :
    (function (__p__) {
        CustomEvent[__p__] = new CustomEvent('').constructor[__p__];
        return CustomEvent;
        function CustomEvent(type, init) {
            if (!init)
                init = {};
            var e = document.createEvent('CustomEvent');
            e.initCustomEvent(type, !!init.bubbles, !!init.cancelable, init.detail);
            return e;
        }
    }('prototype'));
/* harmony default export */ const custom_event_esm = (custom_event_esm_self.CustomEvent);

;// ../../node_modules/@ungap/essential-map/esm/index.js
var essential_map_esm_self = {};
try {
    essential_map_esm_self.Map = Map;
}
catch (Map) {
    essential_map_esm_self.Map = function Map() {
        var i = 0;
        var k = [];
        var v = [];
        return {
            delete: function (key) {
                var had = contains(key);
                if (had) {
                    k.splice(i, 1);
                    v.splice(i, 1);
                }
                return had;
            },
            forEach: function forEach(callback, context) {
                k.forEach(function (key, i) {
                    callback.call(context, v[i], key, this);
                }, this);
            },
            get: function get(key) {
                return contains(key) ? v[i] : void 0;
            },
            has: function has(key) {
                return contains(key);
            },
            set: function set(key, value) {
                v[contains(key) ? i : (k.push(key) - 1)] = value;
                return this;
            }
        };
        function contains(v) {
            i = k.indexOf(v);
            return -1 < i;
        }
    };
}
/* harmony default export */ const essential_map_esm = (essential_map_esm_self.Map);

;// ../../node_modules/hyperhtml/esm/classes/Component.js



function Component() {
    return this;
}
function setup(content) {
    const children = new esm;
    const create = Object.create;
    const createEntry = (wm, id, component) => {
        wm.set(id, component);
        return component;
    };
    const get = (Class, info, context, id) => {
        const relation = info.get(Class) || relate(Class, info);
        switch (typeof id) {
            case 'object':
            case 'function':
                const wm = relation.w || (relation.w = new esm);
                return wm.get(id) || createEntry(wm, id, new Class(context));
            default:
                const sm = relation.p || (relation.p = create(null));
                return sm[id] || (sm[id] = new Class(context));
        }
    };
    const relate = (Class, info) => {
        const relation = { w: null, p: null };
        info.set(Class, relation);
        return relation;
    };
    const set = context => {
        const info = new essential_map_esm;
        children.set(context, info);
        return info;
    };
    Object.defineProperties(Component, {
        for: {
            configurable: true,
            value(context, id) {
                return get(this, children.get(context) || set(context), context, id == null ?
                    'default' : id);
            }
        }
    });
    Object.defineProperties(Component.prototype, {
        handleEvent: { value(e) {
                const ct = e.currentTarget;
                this[('getAttribute' in ct && ct.getAttribute('data-call')) ||
                    ('on' + e.type)](e);
            } },
        html: lazyGetter('html', content),
        svg: lazyGetter('svg', content),
        state: lazyGetter('state', function () { return this.defaultState; }),
        defaultState: { get() { return {}; } },
        dispatch: { value(type, detail) {
                const { _wire$ } = this;
                if (_wire$) {
                    const event = new custom_event_esm(type, {
                        bubbles: true,
                        cancelable: true,
                        detail
                    });
                    event.component = this;
                    return (_wire$.dispatchEvent ?
                        _wire$ :
                        _wire$.firstChild).dispatchEvent(event);
                }
                return false;
            } },
        setState: { value(state, render) {
                const target = this.state;
                const source = typeof state === 'function' ? state.call(this, target) : state;
                for (const key in source)
                    target[key] = source[key];
                if (render !== false)
                    this.render();
                return this;
            } }
    });
}
const lazyGetter = (type, fn) => {
    const secret = '_' + type + '$';
    return {
        get() {
            return this[secret] || setValue(this, secret, fn.call(this, type));
        },
        set(value) {
            setValue(this, secret, value);
        }
    };
};
const setValue = (self, secret, value) => Object.defineProperty(self, secret, {
    configurable: true,
    value: typeof value === 'function' ?
        function () {
            return (self._wire$ = value.apply(this, arguments));
        } :
        value
})[secret];
Object.defineProperties(Component.prototype, {
    ELEMENT_NODE: { value: 1 },
    nodeType: { value: -1 }
});

;// ../../node_modules/hyperhtml/esm/objects/Intent.js
const attributes = {};
const intents = {};
const keys = [];
const Intent_hasOwnProperty = intents.hasOwnProperty;
let Intent_length = 0;
/* harmony default export */ const Intent = ({
    attributes,
    define: (intent, callback) => {
        if (intent.indexOf('-') < 0) {
            if (!(intent in intents)) {
                Intent_length = keys.push(intent);
            }
            intents[intent] = callback;
        }
        else {
            attributes[intent] = callback;
        }
    },
    invoke: (object, callback) => {
        for (let i = 0; i < Intent_length; i++) {
            let key = keys[i];
            if (Intent_hasOwnProperty.call(object, key)) {
                return intents[key](object[key], callback);
            }
        }
    }
});

;// ../../node_modules/@ungap/is-array/esm/index.js
var esm_isArray = Array.isArray || (function (toString) {
    var $ = toString.call([]);
    return function isArray(object) {
        return toString.call(object) === $;
    };
}({}.toString));
/* harmony default export */ const is_array_esm = (esm_isArray);

;// ../../node_modules/@ungap/create-content/esm/index.js
var createContent = (function (document) {
    'use strict';
    var FRAGMENT = 'fragment';
    var TEMPLATE = 'template';
    var HAS_CONTENT = 'content' in create(TEMPLATE);
    var createHTML = HAS_CONTENT ?
        function (html) {
            var template = create(TEMPLATE);
            template.innerHTML = html;
            return template.content;
        } :
        function (html) {
            var content = create(FRAGMENT);
            var template = create(TEMPLATE);
            var childNodes = null;
            if (/^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(html)) {
                var selector = RegExp.$1;
                template.innerHTML = '<table>' + html + '</table>';
                childNodes = template.querySelectorAll(selector);
            }
            else {
                template.innerHTML = html;
                childNodes = template.childNodes;
            }
            append(content, childNodes);
            return content;
        };
    return function createContent(markup, type) {
        return (type === 'svg' ? createSVG : createHTML)(markup);
    };
    function append(root, childNodes) {
        var length = childNodes.length;
        while (length--)
            root.appendChild(childNodes[0]);
    }
    function create(element) {
        return element === FRAGMENT ?
            document.createDocumentFragment() :
            document.createElementNS('http://www.w3.org/1999/xhtml', element);
    }
    function createSVG(svg) {
        var content = create(FRAGMENT);
        var template = create('div');
        template.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>';
        append(content, template.firstChild.childNodes);
        return content;
    }
}(document));
/* harmony default export */ const create_content_esm = (createContent);

;// ../../node_modules/disconnected/esm/index.js
function disconnected(poly) {
    'use strict';
    var Event = poly.Event;
    var WeakSet = poly.WeakSet;
    var notObserving = true;
    var observer = null;
    return function observe(node) {
        if (notObserving) {
            notObserving = !notObserving;
            observer = new WeakSet;
            startObserving(node.ownerDocument);
        }
        observer.add(node);
        return node;
    };
    function startObserving(document) {
        var connected = new WeakSet;
        var disconnected = new WeakSet;
        try {
            (new MutationObserver(changes)).observe(document, { subtree: true, childList: true });
        }
        catch (o_O) {
            var timer = 0;
            var records = [];
            var reschedule = function (record) {
                records.push(record);
                clearTimeout(timer);
                timer = setTimeout(function () {
                    changes(records.splice(timer = 0, records.length));
                }, 0);
            };
            document.addEventListener('DOMNodeRemoved', function (event) {
                reschedule({ addedNodes: [], removedNodes: [event.target] });
            }, true);
            document.addEventListener('DOMNodeInserted', function (event) {
                reschedule({ addedNodes: [event.target], removedNodes: [] });
            }, true);
        }
        function changes(records) {
            for (var record, length = records.length, i = 0; i < length; i++) {
                record = records[i];
                dispatchAll(record.removedNodes, 'disconnected', disconnected, connected);
                dispatchAll(record.addedNodes, 'connected', connected, disconnected);
            }
        }
        function dispatchAll(nodes, type, wsin, wsout) {
            for (var node, event = new Event(type), length = nodes.length, i = 0; i < length; (node = nodes[i++]).nodeType === 1 &&
                dispatchTarget(node, event, type, wsin, wsout))
                ;
        }
        function dispatchTarget(node, event, type, wsin, wsout) {
            if (observer.has(node) && !wsin.has(node)) {
                wsout.delete(node);
                wsin.add(node);
                node.dispatchEvent(event);
            }
            for (var children = node.children || [], length = children.length, i = 0; i < length; dispatchTarget(children[i++], event, type, wsin, wsout))
                ;
        }
    }
}
/* harmony default export */ const disconnected_esm = (disconnected);

;// ../../node_modules/@ungap/import-node/esm/index.js
var importNode = (function (document, appendChild, cloneNode, createTextNode, importNode) {
    var native = importNode in document;
    var fragment = document.createDocumentFragment();
    fragment[appendChild](document[createTextNode]('g'));
    fragment[appendChild](document[createTextNode](''));
    var content = native ?
        document[importNode](fragment, true) :
        fragment[cloneNode](true);
    return content.childNodes.length < 2 ?
        function importNode(node, deep) {
            var clone = node[cloneNode]();
            for (var childNodes = node.childNodes || [], length = childNodes.length, i = 0; deep && i < length; i++) {
                clone[appendChild](importNode(childNodes[i], deep));
            }
            return clone;
        } :
        (native ?
            document[importNode] :
            function (node, deep) {
                return node[cloneNode](!!deep);
            });
}(document, 'appendChild', 'cloneNode', 'createTextNode', 'importNode'));
/* harmony default export */ const import_node_esm = (importNode);

;// ../../node_modules/@ungap/trim/esm/index.js
var trim = ''.trim || function () {
    return String(this).replace(/^\s+|\s+/g, '');
};
/* harmony default export */ const trim_esm = (trim);

;// ../../node_modules/domconstants/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var UID = '-' + Math.random().toFixed(6) + '%';
var UID_IE = false;
try {
    if (!(function (template, content, tabindex) {
        return content in template && ((template.innerHTML = '<p ' + tabindex + '="' + UID + '"></p>'),
            template[content].childNodes[0].getAttribute(tabindex) == UID);
    }(document.createElement('template'), 'content', 'tabindex'))) {
        UID = '_dt: ' + UID.slice(1, -1) + ';';
        UID_IE = true;
    }
}
catch (meh) { }
var UIDC = '<!--' + UID + '-->';
var COMMENT_NODE = 8;
var DOCUMENT_FRAGMENT_NODE = 11;
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var SHOULD_USE_TEXT_CONTENT = /^(?:plaintext|script|style|textarea|title|xmp)$/i;
var VOID_ELEMENTS = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;


;// ../../node_modules/domsanitizer/esm/index.js
__webpack_require__.dn(domsanitizer_esm);
/*! (c) Andrea Giammarchi - ISC */

/* harmony default export */ function domsanitizer_esm(template) {
    return template.join(UIDC)
        .replace(selfClosing, fullClosing)
        .replace(attrSeeker, attrReplacer);
}
var spaces = ' \\f\\n\\r\\t';
var almostEverything = '[^' + spaces + '\\/>"\'=]+';
var attrName = '[' + spaces + ']+' + almostEverything;
var tagName = '<([A-Za-z]+[A-Za-z0-9:._-]*)((?:';
var attrPartials = '(?:\\s*=\\s*(?:\'[^\']*?\'|"[^"]*?"|<[^>]*?>|' + almostEverything.replace('\\/', '') + '))?)';
var attrSeeker = new RegExp(tagName + attrName + attrPartials + '+)([' + spaces + ']*/?>)', 'g');
var selfClosing = new RegExp(tagName + attrName + attrPartials + '*)([' + spaces + ']*/>)', 'g');
var findAttributes = new RegExp('(' + attrName + '\\s*=\\s*)([\'"]?)' + UIDC + '\\2', 'gi');
function attrReplacer($0, $1, $2, $3) {
    return '<' + $1 + $2.replace(findAttributes, replaceAttributes) + $3;
}
function replaceAttributes($0, $1, $2) {
    return $1 + ($2 || '"') + UID + ($2 || '"');
}
function fullClosing($0, $1, $2) {
    return VOID_ELEMENTS.test($1) ? $0 : ('<' + $1 + $2 + '></' + $1 + '>');
}

;// ../../node_modules/umap/esm/index.js
/* harmony default export */ const umap_esm = (_ => ({
    get: key => _.get(key),
    set: (key, value) => (_.set(key, value), value)
}));
__webpack_require__.dn(umap_esm);

;// ../../node_modules/domtagger/esm/walker.js



var normalizeAttributes = UID_IE ?
    function (attributes, parts) {
        var html = parts.join(' ');
        return parts.slice.call(attributes, 0).sort(function (left, right) {
            return html.indexOf(left.name) <= html.indexOf(right.name) ? -1 : 1;
        });
    } :
    function (attributes, parts) {
        return parts.slice.call(attributes, 0);
    };
function find(node, path) {
    var length = path.length;
    var i = 0;
    while (i < length)
        node = node.childNodes[path[i++]];
    return node;
}
function parse(node, holes, parts, path) {
    var childNodes = node.childNodes;
    var length = childNodes.length;
    var i = 0;
    while (i < length) {
        var child = childNodes[i];
        switch (child.nodeType) {
            case ELEMENT_NODE:
                var childPath = path.concat(i);
                parseAttributes(child, holes, parts, childPath);
                parse(child, holes, parts, childPath);
                break;
            case COMMENT_NODE:
                var textContent = child.textContent;
                if (textContent === UID) {
                    parts.shift();
                    holes.push(SHOULD_USE_TEXT_CONTENT.test(node.nodeName) ?
                        Text(node, path) :
                        Any(child, path.concat(i)));
                }
                else {
                    switch (textContent.slice(0, 2)) {
                        case '/*':
                            if (textContent.slice(-2) !== '*/')
                                break;
                        case '\uD83D\uDC7B':
                            node.removeChild(child);
                            i--;
                            length--;
                    }
                }
                break;
            case TEXT_NODE:
                if (SHOULD_USE_TEXT_CONTENT.test(node.nodeName) &&
                    trim_esm.call(child.textContent) === UIDC) {
                    parts.shift();
                    holes.push(Text(node, path));
                }
                break;
        }
        i++;
    }
}
function parseAttributes(node, holes, parts, path) {
    var attributes = node.attributes;
    var cache = [];
    var remove = [];
    var array = normalizeAttributes(attributes, parts);
    var length = array.length;
    var i = 0;
    while (i < length) {
        var attribute = array[i++];
        var direct = attribute.value === UID;
        var sparse;
        if (direct || 1 < (sparse = attribute.value.split(UIDC)).length) {
            var name = attribute.name;
            if (cache.indexOf(name) < 0) {
                cache.push(name);
                var realName = parts.shift().replace(direct ?
                    /^(?:|[\S\s]*?\s)(\S+?)\s*=\s*('|")?$/ :
                    new RegExp('^(?:|[\\S\\s]*?\\s)(' + name + ')\\s*=\\s*(\'|")[\\S\\s]*', 'i'), '$1');
                var value = attributes[realName] ||
                    attributes[realName.toLowerCase()];
                if (direct)
                    holes.push(Attr(value, path, realName, null));
                else {
                    var skip = sparse.length - 2;
                    while (skip--)
                        parts.shift();
                    holes.push(Attr(value, path, realName, sparse));
                }
            }
            remove.push(attribute);
        }
    }
    length = remove.length;
    i = 0;
    var cleanValue = 0 < length && UID_IE && !('ownerSVGElement' in node);
    while (i < length) {
        var attr = remove[i++];
        if (cleanValue)
            attr.value = '';
        node.removeAttribute(attr.name);
    }
    var nodeName = node.nodeName;
    if (/^script$/i.test(nodeName)) {
        var script = document.createElement(nodeName);
        length = attributes.length;
        i = 0;
        while (i < length)
            script.setAttributeNode(attributes[i++].cloneNode(true));
        script.textContent = node.textContent;
        node.parentNode.replaceChild(script, node);
    }
}
function Any(node, path) {
    return {
        type: 'any',
        node: node,
        path: path
    };
}
function Attr(node, path, name, sparse) {
    return {
        type: 'attr',
        node: node,
        path: path,
        name: name,
        sparse: sparse
    };
}
function Text(node, path) {
    return {
        type: 'text',
        node: node,
        path: path
    };
}

;// ../../node_modules/domtagger/esm/index.js







/* harmony default export */ const domtagger_esm = (domtagger);
var parsed = umap_esm(new esm);
function createInfo(options, template) {
    var markup = (options.convert || domsanitizer_esm)(template);
    var transform = options.transform;
    if (transform)
        markup = transform(markup);
    var content = create_content_esm(markup, options.type);
    cleanContent(content);
    var holes = [];
    parse(content, holes, template.slice(0), []);
    return {
        content: content,
        updates: function (content) {
            var updates = [];
            var len = holes.length;
            var i = 0;
            var off = 0;
            while (i < len) {
                var info = holes[i++];
                var node = find(content, info.path);
                switch (info.type) {
                    case 'any':
                        updates.push({ fn: options.any(node, []), sparse: false });
                        break;
                    case 'attr':
                        var sparse = info.sparse;
                        var fn = options.attribute(node, info.name, info.node);
                        if (sparse === null)
                            updates.push({ fn: fn, sparse: false });
                        else {
                            off += sparse.length - 2;
                            updates.push({ fn: fn, sparse: true, values: sparse });
                        }
                        break;
                    case 'text':
                        updates.push({ fn: options.text(node), sparse: false });
                        node.textContent = '';
                        break;
                }
            }
            len += off;
            return function () {
                var length = arguments.length;
                if (len !== (length - 1)) {
                    throw new Error((length - 1) + ' values instead of ' + len + '\n' +
                        template.join('${value}'));
                }
                var i = 1;
                var off = 1;
                while (i < length) {
                    var update = updates[i - off];
                    if (update.sparse) {
                        var values = update.values;
                        var value = values[0];
                        var j = 1;
                        var l = values.length;
                        off += l - 2;
                        while (j < l)
                            value += arguments[i++] + values[j++];
                        update.fn(value);
                    }
                    else
                        update.fn(arguments[i++]);
                }
                return content;
            };
        }
    };
}
function createDetails(options, template) {
    var info = parsed.get(template) || parsed.set(template, createInfo(options, template));
    return info.updates(import_node_esm.call(document, info.content, true));
}
var empty = [];
function domtagger(options) {
    var previous = empty;
    var updates = cleanContent;
    return function (template) {
        if (previous !== template)
            updates = createDetails(options, (previous = template));
        return updates.apply(null, arguments);
    };
}
function cleanContent(fragment) {
    var childNodes = fragment.childNodes;
    var i = childNodes.length;
    while (i--) {
        var child = childNodes[i];
        if (child.nodeType !== 1 &&
            trim_esm.call(child.textContent).length === 0) {
            fragment.removeChild(child);
        }
    }
}

;// ../../node_modules/hyperhtml-style/esm/index.js
var hyperStyle = (function () {
    'use strict';
    var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;
    var hyphen = /([^A-Z])([A-Z]+)/g;
    return function hyperStyle(node, original) {
        return 'ownerSVGElement' in node ? svg(node, original) : update(node.style, false);
    };
    function ized($0, $1, $2) {
        return $1 + '-' + $2.toLowerCase();
    }
    function svg(node, original) {
        var style;
        if (original)
            style = original.cloneNode(true);
        else {
            node.setAttribute('style', '--hyper:style;');
            style = node.getAttributeNode('style');
        }
        style.value = '';
        node.setAttributeNode(style);
        return update(style, true);
    }
    function toStyle(object) {
        var key, css = [];
        for (key in object)
            css.push(key.replace(hyphen, ized), ':', object[key], ';');
        return css.join('');
    }
    function update(style, isSVG) {
        var oldType, oldValue;
        return function (newValue) {
            var info, key, styleValue, value;
            switch (typeof newValue) {
                case 'object':
                    if (newValue) {
                        if (oldType === 'object') {
                            if (!isSVG) {
                                if (oldValue !== newValue) {
                                    for (key in oldValue) {
                                        if (!(key in newValue)) {
                                            style[key] = '';
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            if (isSVG)
                                style.value = '';
                            else
                                style.cssText = '';
                        }
                        info = isSVG ? {} : style;
                        for (key in newValue) {
                            value = newValue[key];
                            styleValue = typeof value === 'number' &&
                                !IS_NON_DIMENSIONAL.test(key) ?
                                (value + 'px') : value;
                            if (!isSVG && /^--/.test(key))
                                info.setProperty(key, styleValue);
                            else
                                info[key] = styleValue;
                        }
                        oldType = 'object';
                        if (isSVG)
                            style.value = toStyle((oldValue = info));
                        else
                            oldValue = newValue;
                        break;
                    }
                default:
                    if (oldValue != newValue) {
                        oldType = 'string';
                        oldValue = newValue;
                        if (isSVG)
                            style.value = newValue || '';
                        else
                            style.cssText = newValue || '';
                    }
                    break;
            }
        };
    }
}());
/* harmony default export */ const hyperhtml_style_esm = (hyperStyle);

;// ../../node_modules/hyperhtml-wire/esm/index.js
var Wire = (function (slice, proto) {
    proto = Wire.prototype;
    proto.ELEMENT_NODE = 1;
    proto.nodeType = 111;
    proto.remove = function (keepFirst) {
        var childNodes = this.childNodes;
        var first = this.firstChild;
        var last = this.lastChild;
        this._ = null;
        if (keepFirst && childNodes.length === 2) {
            last.parentNode.removeChild(last);
        }
        else {
            var range = this.ownerDocument.createRange();
            range.setStartBefore(keepFirst ? childNodes[1] : first);
            range.setEndAfter(last);
            range.deleteContents();
        }
        return first;
    };
    proto.valueOf = function (forceAppend) {
        var fragment = this._;
        var noFragment = fragment == null;
        if (noFragment)
            fragment = (this._ = this.ownerDocument.createDocumentFragment());
        if (noFragment || forceAppend) {
            for (var n = this.childNodes, i = 0, l = n.length; i < l; i++)
                fragment.appendChild(n[i]);
        }
        return fragment;
    };
    return Wire;
    function Wire(childNodes) {
        var nodes = (this.childNodes = slice.call(childNodes, 0));
        this.firstChild = nodes[0];
        this.lastChild = nodes[nodes.length - 1];
        this.ownerDocument = nodes[0].ownerDocument;
        this._ = null;
    }
}([].slice));
/* harmony default export */ const hyperhtml_wire_esm = (Wire);

;// ../../node_modules/hyperhtml/esm/shared/constants.js
const constants_ELEMENT_NODE = 1;
const constants_DOCUMENT_FRAGMENT_NODE = 11;
const OWNER_SVG_ELEMENT = 'ownerSVGElement';
const CONNECTED = 'connected';
const DISCONNECTED = 'dis' + CONNECTED;

;// ../../node_modules/hyperhtml/esm/objects/Updates.js












const componentType = Component.prototype.nodeType;
const wireType = hyperhtml_wire_esm.prototype.nodeType;
const observe = disconnected_esm({ Event: custom_event_esm, WeakSet: essential_weakset_esm });

const asHTML = html => ({ html });
const asNode = (item, i) => {
    switch (item.nodeType) {
        case wireType:
            return (1 / i) < 0 ?
                (i ? item.remove(true) : item.lastChild) :
                (i ? item.valueOf(true) : item.firstChild);
        case componentType:
            return asNode(item.render(), i);
        default:
            return item;
    }
};
const canDiff = value => 'ELEMENT_NODE' in value;
const booleanSetter = (node, key, oldValue) => newValue => {
    if (oldValue !== !!newValue) {
        if ((oldValue = !!newValue))
            node.setAttribute(key, '');
        else
            node.removeAttribute(key);
    }
};
const hyperSetter = (node, name, svg) => svg ?
    value => {
        try {
            node[name] = value;
        }
        catch (nope) {
            node.setAttribute(name, value);
        }
    } :
    value => {
        node[name] = value;
    };
const invokeAtDistance = (value, callback) => {
    callback(value.placeholder);
    if ('text' in value) {
        Promise.resolve(value.text).then(String).then(callback);
    }
    else if ('any' in value) {
        Promise.resolve(value.any).then(callback);
    }
    else if ('html' in value) {
        Promise.resolve(value.html).then(asHTML).then(callback);
    }
    else {
        Promise.resolve(Intent.invoke(value, callback)).then(callback);
    }
};
const isPromise_ish = value => value != null && 'then' in value;
const readOnly = /^(?:form|list)$/i;
const Updates_slice = [].slice;
const Updates_text = (node, text) => node.ownerDocument.createTextNode(text);
function Tagger(type) {
    this.type = type;
    return domtagger_esm(this);
}
Tagger.prototype = {
    attribute(node, name, original) {
        const isSVG = OWNER_SVG_ELEMENT in node;
        let oldValue;
        if (name === 'style')
            return hyperhtml_style_esm(node, original, isSVG);
        else if (name.slice(0, 1) === '.')
            return hyperSetter(node, name.slice(1), isSVG);
        else if (name.slice(0, 1) === '?')
            return booleanSetter(node, name.slice(1));
        else if (/^on/.test(name)) {
            let type = name.slice(2);
            if (type === CONNECTED || type === DISCONNECTED) {
                observe(node);
            }
            else if (name.toLowerCase()
                in node) {
                type = type.toLowerCase();
            }
            return newValue => {
                if (oldValue !== newValue) {
                    if (oldValue)
                        node.removeEventListener(type, oldValue, false);
                    oldValue = newValue;
                    if (newValue)
                        node.addEventListener(type, newValue, false);
                }
            };
        }
        else if (name === 'data' ||
            (!isSVG && name in node && !readOnly.test(name))) {
            return newValue => {
                if (oldValue !== newValue) {
                    oldValue = newValue;
                    if (node[name] !== newValue && newValue == null) {
                        node[name] = '';
                        node.removeAttribute(name);
                    }
                    else
                        node[name] = newValue;
                }
            };
        }
        else if (name in Intent.attributes) {
            oldValue;
            return any => {
                const newValue = Intent.attributes[name](node, any);
                if (oldValue !== newValue) {
                    oldValue = newValue;
                    if (newValue == null)
                        node.removeAttribute(name);
                    else
                        node.setAttribute(name, newValue);
                }
            };
        }
        else {
            let owner = false;
            const attribute = original.cloneNode(true);
            return newValue => {
                if (oldValue !== newValue) {
                    oldValue = newValue;
                    if (attribute.value !== newValue) {
                        if (newValue == null) {
                            if (owner) {
                                owner = false;
                                node.removeAttributeNode(attribute);
                            }
                            attribute.value = newValue;
                        }
                        else {
                            attribute.value = newValue;
                            if (!owner) {
                                owner = true;
                                node.setAttributeNode(attribute);
                            }
                        }
                    }
                }
            };
        }
    },
    any(node, childNodes) {
        const diffOptions = { node: asNode, before: node };
        const nodeType = OWNER_SVG_ELEMENT in node ? 'svg' : 'html';
        let fastPath = false;
        let oldValue;
        const anyContent = value => {
            switch (typeof value) {
                case 'string':
                case 'number':
                case 'boolean':
                    if (fastPath) {
                        if (oldValue !== value) {
                            oldValue = value;
                            childNodes[0].textContent = value;
                        }
                    }
                    else {
                        fastPath = true;
                        oldValue = value;
                        childNodes = domdiff_esm(node.parentNode, childNodes, [Updates_text(node, value)], diffOptions);
                    }
                    break;
                case 'function':
                    anyContent(value(node));
                    break;
                case 'object':
                case 'undefined':
                    if (value == null) {
                        fastPath = false;
                        childNodes = domdiff_esm(node.parentNode, childNodes, [], diffOptions);
                        break;
                    }
                default:
                    fastPath = false;
                    oldValue = value;
                    if (is_array_esm(value)) {
                        if (value.length === 0) {
                            if (childNodes.length) {
                                childNodes = domdiff_esm(node.parentNode, childNodes, [], diffOptions);
                            }
                        }
                        else {
                            switch (typeof value[0]) {
                                case 'string':
                                case 'number':
                                case 'boolean':
                                    anyContent({ html: value });
                                    break;
                                case 'object':
                                    if (is_array_esm(value[0])) {
                                        value = value.concat.apply([], value);
                                    }
                                    if (isPromise_ish(value[0])) {
                                        Promise.all(value).then(anyContent);
                                        break;
                                    }
                                default:
                                    childNodes = domdiff_esm(node.parentNode, childNodes, value, diffOptions);
                                    break;
                            }
                        }
                    }
                    else if (canDiff(value)) {
                        childNodes = domdiff_esm(node.parentNode, childNodes, value.nodeType === (/* inlined export .DOCUMENT_FRAGMENT_NODE */11) ?
                            Updates_slice.call(value.childNodes) :
                            [value], diffOptions);
                    }
                    else if (isPromise_ish(value)) {
                        value.then(anyContent);
                    }
                    else if ('placeholder' in value) {
                        invokeAtDistance(value, anyContent);
                    }
                    else if ('text' in value) {
                        anyContent(String(value.text));
                    }
                    else if ('any' in value) {
                        anyContent(value.any);
                    }
                    else if ('html' in value) {
                        childNodes = domdiff_esm(node.parentNode, childNodes, Updates_slice.call(create_content_esm([].concat(value.html).join(''), nodeType).childNodes), diffOptions);
                    }
                    else if ('length' in value) {
                        anyContent(Updates_slice.call(value));
                    }
                    else {
                        anyContent(Intent.invoke(value, anyContent));
                    }
                    break;
            }
        };
        return anyContent;
    },
    text(node) {
        let oldValue;
        const textContent = value => {
            if (oldValue !== value) {
                oldValue = value;
                const type = typeof value;
                if (type === 'object' && value) {
                    if (isPromise_ish(value)) {
                        value.then(textContent);
                    }
                    else if ('placeholder' in value) {
                        invokeAtDistance(value, textContent);
                    }
                    else if ('text' in value) {
                        textContent(String(value.text));
                    }
                    else if ('any' in value) {
                        textContent(value.any);
                    }
                    else if ('html' in value) {
                        textContent([].concat(value.html).join(''));
                    }
                    else if ('length' in value) {
                        textContent(Updates_slice.call(value).join(''));
                    }
                    else {
                        textContent(Intent.invoke(value, textContent));
                    }
                }
                else if (type === 'function') {
                    textContent(value(node));
                }
                else {
                    node.textContent = value == null ? '' : value;
                }
            }
        };
        return textContent;
    }
};

;// ../../node_modules/@ungap/template-literal/esm/index.js

var isNoOp = typeof document !== 'object';
var templateLiteral = function (tl) {
    var RAW = 'raw';
    var isBroken = function (UA) {
        return /(Firefox|Safari)\/(\d+)/.test(UA) &&
            !/(Chrom[eium]+|Android)\/(\d+)/.test(UA);
    };
    var broken = isBroken((document.defaultView.navigator || {}).userAgent);
    var FTS = !(RAW in tl) ||
        tl.propertyIsEnumerable(RAW) ||
        !Object.isFrozen(tl[RAW]);
    if (broken || FTS) {
        var forever = {};
        var foreverCache = function (tl) {
            for (var key = '.', i = 0; i < tl.length; i++)
                key += tl[i].length + '.' + tl[i];
            return forever[key] || (forever[key] = tl);
        };
        if (FTS)
            templateLiteral = foreverCache;
        else {
            var wm = new esm;
            var set = function (tl, unique) {
                wm.set(tl, unique);
                return unique;
            };
            templateLiteral = function (tl) {
                return wm.get(tl) || set(tl, foreverCache(tl));
            };
        }
    }
    else {
        isNoOp = true;
    }
    return TL(tl);
};
/* harmony default export */ const template_literal_esm = (TL);
function TL(tl) {
    return isNoOp ? tl : templateLiteral(tl);
}

;// ../../node_modules/@ungap/template-tag-arguments/esm/index.js
__webpack_require__.dn(template_tag_arguments_esm);

/* harmony default export */ function template_tag_arguments_esm(template) {
    var length = arguments.length;
    var args = [template_literal_esm(template)];
    var i = 1;
    while (i < length)
        args.push(arguments[i++]);
    return args;
}
;

;// ../../node_modules/hyperhtml/esm/hyper/wire.js




const wires = new esm;
const wire = (obj, type) => obj == null ?
    content(type || 'html') :
    weakly(obj, type || 'html');
const content = type => {
    let wire, tagger, template;
    return function () {
        const args = template_tag_arguments_esm.apply(null, arguments);
        if (template !== args[0]) {
            template = args[0];
            tagger = new Tagger(type);
            wire = wireContent(tagger.apply(tagger, args));
        }
        else {
            tagger.apply(tagger, args);
        }
        return wire;
    };
};
const weakly = (obj, type) => {
    const i = type.indexOf(':');
    let wire = wires.get(obj);
    let id = type;
    if (-1 < i) {
        id = type.slice(i + 1);
        type = type.slice(0, i) || 'html';
    }
    if (!wire)
        wires.set(obj, wire = {});
    return wire[id] || (wire[id] = content(type));
};
const wireContent = node => {
    const childNodes = node.childNodes;
    const { length } = childNodes;
    return length === 1 ?
        childNodes[0] :
        (length ? new hyperhtml_wire_esm(childNodes) : node);
};

/* harmony default export */ const hyper_wire = (wire);

;// ../../node_modules/hyperhtml/esm/hyper/render.js




const bewitched = new esm;
function render() {
    const wicked = bewitched.get(this);
    const args = template_tag_arguments_esm.apply(null, arguments);
    if (wicked && wicked.template === args[0]) {
        wicked.tagger.apply(null, args);
    }
    else {
        upgrade.apply(this, args);
    }
    return this;
}
function upgrade(template) {
    const type = OWNER_SVG_ELEMENT in this ? 'svg' : 'html';
    const tagger = new Tagger(type);
    bewitched.set(this, { tagger, template: template });
    this.textContent = '';
    this.appendChild(tagger.apply(null, arguments));
}
/* harmony default export */ const hyper_render = (render);

;// ../../node_modules/hyperhtml/esm/index.js








const bind = context => hyper_render.bind(context);
const esm_define = Intent.define;
const tagger = Tagger.prototype;
hyper.Component = Component;
hyper.bind = bind;
hyper.define = esm_define;
hyper.diff = domdiff_esm;
hyper.hyper = hyper;
hyper.observe = observe;
hyper.tagger = tagger;
hyper.wire = hyper_wire;
hyper._ = {
    WeakMap: esm,
    WeakSet: essential_weakset_esm
};
setup(content);

function hyper(HTML) {
    return arguments.length < 2 ?
        (HTML == null ?
            content('html') :
            (typeof HTML === 'string' ?
                hyper.wire(null, HTML) :
                ('raw' in HTML ?
                    content('html')(HTML) :
                    ('nodeType' in HTML ?
                        hyper.bind(HTML) :
                        weakly(HTML, 'html'))))) :
        ('raw' in HTML ?
            content('html') : hyper.wire).apply(null, arguments);
}

;// ../../node_modules/hyperhtml-element/esm/index.js
/*! (C) 2017-2018 Andrea Giammarchi - ISC Style License */

const ATTRIBUTE_CHANGED_CALLBACK = 'attributeChangedCallback';
const O = Object;
const classes = [];
const defineProperty = O.defineProperty;
const getOwnPropertyDescriptor = O.getOwnPropertyDescriptor;
const getOwnPropertyNames = O.getOwnPropertyNames;
const getOwnPropertySymbols = O.getOwnPropertySymbols || (() => []);
const getPrototypeOf = O.getPrototypeOf || (o => o.__proto__);
const ownKeys = typeof Reflect === 'object' && Reflect.ownKeys ||
    (o => getOwnPropertyNames(o).concat(getOwnPropertySymbols(o)));
const setPrototypeOf = O.setPrototypeOf ||
    ((o, p) => (o.__proto__ = p, o));
const camel = name => name.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());
const { attachShadow } = HTMLElement.prototype;
const sr = new WeakMap;
class HyperHTMLElement extends HTMLElement {
    static define(name, options) {
        const Class = this;
        const proto = Class.prototype;
        const onChanged = proto[ATTRIBUTE_CHANGED_CALLBACK];
        const hasChange = !!onChanged;
        const booleanAttributes = Class.booleanAttributes || [];
        booleanAttributes.forEach(attribute => {
            const name = camel(attribute);
            if (!(name in proto))
                defineProperty(proto, name, {
                    configurable: true,
                    get() {
                        return this.hasAttribute(attribute);
                    },
                    set(value) {
                        if (!value || value === 'false')
                            this.removeAttribute(attribute);
                        else
                            this.setAttribute(attribute, '');
                    }
                });
        });
        const observedAttributes = (Class.observedAttributes || []).filter(attribute => booleanAttributes.indexOf(attribute) < 0);
        observedAttributes.forEach(attribute => {
            const name = camel(attribute);
            if (!(name in proto))
                defineProperty(proto, name, {
                    configurable: true,
                    get() {
                        return this.getAttribute(attribute);
                    },
                    set(value) {
                        if (value == null)
                            this.removeAttribute(attribute);
                        else
                            this.setAttribute(attribute, value);
                    }
                });
        });
        const attributes = booleanAttributes.concat(observedAttributes);
        if (attributes.length)
            defineProperty(Class, 'observedAttributes', {
                get() { return attributes; }
            });
        const created = proto.created || function () {
            this.render();
        };
        defineProperty(proto, '_init$', {
            configurable: true,
            writable: true,
            value: true
        });
        defineProperty(proto, ATTRIBUTE_CHANGED_CALLBACK, {
            configurable: true,
            value: function aCC(name, prev, curr) {
                if (this._init$) {
                    checkReady.call(this, created, attributes, booleanAttributes);
                    if (this._init$)
                        return this._init$$.push(aCC.bind(this, name, prev, curr));
                }
                if (hasChange && prev !== curr) {
                    onChanged.apply(this, arguments);
                }
            }
        });
        const onConnected = proto.connectedCallback;
        const hasConnect = !!onConnected;
        defineProperty(proto, 'connectedCallback', {
            configurable: true,
            value: function cC() {
                if (this._init$) {
                    checkReady.call(this, created, attributes, booleanAttributes);
                    if (this._init$)
                        return this._init$$.push(cC.bind(this));
                }
                if (hasConnect) {
                    onConnected.apply(this, arguments);
                }
            }
        });
        getOwnPropertyNames(proto).forEach(key => {
            if (/^handle[A-Z]/.test(key)) {
                const _key$ = '_' + key + '$';
                const method = proto[key];
                defineProperty(proto, key, {
                    configurable: true,
                    get() {
                        return this[_key$] ||
                            (this[_key$] = method.bind(this));
                    }
                });
            }
        });
        if (!('handleEvent' in proto)) {
            defineProperty(proto, 'handleEvent', {
                configurable: true,
                value(event) {
                    this[(event.currentTarget.dataset || {}).call ||
                        ('on' + event.type)](event);
                }
            });
        }
        if (options && options.extends) {
            const Native = document.createElement(options.extends).constructor;
            const Intermediate = class extends Native {
            };
            const ckeys = ['length', 'name', 'arguments', 'caller', 'prototype'];
            const pkeys = [];
            let Super = null;
            let BaseClass = Class;
            while (Super = getPrototypeOf(BaseClass)) {
                [
                    { target: Intermediate, base: Super, keys: ckeys },
                    { target: Intermediate.prototype, base: Super.prototype, keys: pkeys }
                ]
                    .forEach(({ target, base, keys }) => {
                    ownKeys(base)
                        .filter(key => keys.indexOf(key) < 0)
                        .forEach((key) => {
                        keys.push(key);
                        defineProperty(target, key, getOwnPropertyDescriptor(base, key));
                    });
                });
                BaseClass = Super;
                if (Super === HyperHTMLElement)
                    break;
            }
            setPrototypeOf(Class, Intermediate);
            setPrototypeOf(proto, Intermediate.prototype);
            customElements.define(name, Class, options);
        }
        else {
            customElements.define(name, Class);
        }
        classes.push(Class);
        return Class;
    }
    attachShadow() {
        const shadowRoot = attachShadow.apply(this, arguments);
        sr.set(this, shadowRoot);
        return shadowRoot;
    }
    get refs() {
        const value = {};
        if ('_html$' in this) {
            const all = (sr.get(this) || this).querySelectorAll('[ref]');
            for (let { length } = all, i = 0; i < length; i++) {
                const node = all[i];
                value[node.getAttribute('ref')] = node;
            }
            Object.defineProperty(this, 'refs', { value });
            return value;
        }
        return value;
    }
    get html() {
        return this._html$ || (this.html = bind(this.shadowRoot || this._shadowRoot || sr.get(this) || this));
    }
    set html(value) {
        defineProperty(this, '_html$', { configurable: true, value: value });
    }
    render() { }
    get defaultState() { return {}; }
    get state() {
        return this._state$ || (this.state = this.defaultState);
    }
    set state(value) {
        defineProperty(this, '_state$', { configurable: true, value: value });
    }
    setState(state, render) {
        const target = this.state;
        const source = typeof state === 'function' ? state.call(this, target) : state;
        for (const key in source)
            target[key] = source[key];
        if (render !== false)
            this.render();
        return this;
    }
}
;
HyperHTMLElement.Component = Component;
HyperHTMLElement.bind = bind;
HyperHTMLElement.intent = esm_define;
HyperHTMLElement.wire = hyper_wire;
HyperHTMLElement.hyper = hyper;
try {
    if (Symbol.hasInstance)
        classes.push(defineProperty(HyperHTMLElement, Symbol.hasInstance, {
            enumerable: false,
            configurable: true,
            value(instance) {
                return classes.some(esm_isPrototypeOf, getPrototypeOf(instance));
            }
        }));
}
catch (meh) { }
/* harmony default export */ const hyperhtml_element_esm = (HyperHTMLElement);
const dom = {
    type: 'DOMContentLoaded',
    handleEvent() {
        if (dom.ready()) {
            document.removeEventListener(dom.type, dom, false);
            dom.list.splice(0).forEach(invoke);
        }
        else
            setTimeout(dom.handleEvent);
    },
    ready() {
        return document.readyState === 'complete';
    },
    list: []
};
if (!dom.ready()) {
    document.addEventListener(dom.type, dom, false);
}
function checkReady(created, attributes, booleanAttributes) {
    if (dom.ready() || isReady.call(this, created, attributes, booleanAttributes)) {
        if (this._init$) {
            const list = this._init$$ || [];
            delete this._init$$;
            const self = defineProperty(this, '_init$', { value: false });
            booleanAttributes.forEach(name => {
                if (self.getAttribute(name) === 'false')
                    self.removeAttribute(name);
            });
            attributes.forEach(name => {
                if (self.hasOwnProperty(name)) {
                    const curr = self[name];
                    delete self[name];
                    list.unshift(() => { self[name] = curr; });
                }
            });
            created.call(self);
            list.forEach(invoke);
        }
    }
    else {
        if (!this.hasOwnProperty('_init$$'))
            defineProperty(this, '_init$$', { configurable: true, value: [] });
        dom.list.push(checkReady.bind(this, created, attributes, booleanAttributes));
    }
}
function invoke(fn) {
    fn();
}
function esm_isPrototypeOf(Class) {
    return this === Class.prototype;
}
function isReady(created, attributes, booleanAttributes) {
    let el = this;
    do {
        if (el.nextSibling)
            return true;
    } while (el = el.parentNode);
    setTimeout(checkReady.bind(this, created, attributes, booleanAttributes));
    return false;
}

;// ./js/io-element.mjs


const DOMUtils = {
    boolean: {
        attribute(node, name, setAsTrue) {
            if (DOMUtils.boolean.value(setAsTrue)) {
                node.setAttribute(name, "true");
            }
            else {
                node.removeAttribute(name);
            }
        },
        value(value) {
            if (typeof value === "string" && value.length) {
                try {
                    value = JSON.parse(value);
                }
                catch (error) {
                }
            }
            return !!value;
        }
    },
    event: {
        isLeftClick(event) {
            const re = /^(?:click|mouse|touch|pointer)/;
            return re.test(event.type) && !event.button;
        }
    }
};
let counter = 0;
class IOElement extends hyperhtml_element_esm {
    static get utils() {
        return DOMUtils;
    }
    static getID(element) {
        return element.getAttribute("id") || IOElement.setID(element);
    }
    static setID(element) {
        const id = `${element.nodeName.toLowerCase()}-${counter++}`;
        element.setAttribute("id", id);
        return id;
    }
    get id() {
        return IOElement.getID(this);
    }
    get ready() {
        return !!this.offsetParent && this.isStyled();
    }
    created() {
        this.render();
    }
    isStyled() {
        const computed = window.getComputedStyle(this, null);
        const property = "--" + this.nodeName.toLowerCase();
        return computed.getPropertyValue(property).trim() !== "";
    }
    render() { }
    get child() {
        let element = this.firstElementChild;
        if (!element) {
            this.render();
            element = this.firstElementChild;
        }
        return element;
    }
}
IOElement.intent("i18n", (idOrArgs) => {
    const fragment = document.createDocumentFragment();
    if (typeof idOrArgs === "string")
        setElementText(fragment, idOrArgs);
    else if (idOrArgs instanceof Array)
        setElementText(fragment, ...idOrArgs);
    return fragment;
});
/* harmony default export */ const io_element = (IOElement);

;// ./js/io-steps.mjs

class IOSteps extends io_element {
    static get observedAttributes() {
        return ["i18n-labels"];
    }
    created() {
        io_steps_reset.call(this);
    }
    attributeChangedCallback() {
        io_steps_reset.call(this);
        for (const label of this.i18nLabels.split(/[\n ]+/)) {
            const trimmed = label.trim();
            if (trimmed.length) {
                this.labels.push(browser.i18n.getMessage(trimmed));
            }
        }
        this.render();
    }
    get enabled() {
        return this._enabled;
    }
    getCompleted(index) {
        return index < this._enabled;
    }
    setCompleted(index, completed = true) {
        if (index < 0)
            index = this.children.length + index;
        this.children[index].classList.toggle("completed", completed);
        if (completed && index < this.labels.length && this._enabled <= index) {
            this._enabled = index + 1;
            this.render();
        }
    }
    onclick(event) {
        event.preventDefault();
        event.stopPropagation();
        const indexOf = Array.prototype.indexOf;
        this.dispatchEvent(new CustomEvent("step:click", {
            bubbles: true,
            detail: indexOf.call(this.children, event.currentTarget)
        }));
    }
    render() {
        this.html `${this.labels.map(getButton, this)}`;
    }
}
const { wire: io_steps_wire } = io_element;
function getButton(label, index) {
    return io_steps_wire(this, `:${index}`) `
    <button
      onclick="${this}"
      disabled="${index > this._enabled}"
      data-value="${index + 1}"
    >${label}</button>`;
}
function io_steps_reset() {
    this._enabled = 0;
    this.labels = [];
}
IOSteps.define("io-steps");

;// ./js/drawing-handler.mjs


const requestIdleCb = window.requestIdleCallback || setTimeout;
class DrawingHandler {
    constructor(canvas, maxSize) {
        this.paths = new Set();
        this.canvas = canvas;
        this.maxSize = maxSize;
        const canvasRect = canvas.getBoundingClientRect();
        canvas.width = canvasRect.width;
        canvas.height = canvasRect.height;
        this.ratio = (maxSize / canvas.width) * (window.devicePixelRatio || 1);
        if ("onpointerup" in canvas) {
            canvas.addEventListener("pointerdown", this, { passive: false });
            canvas.addEventListener("pointermove", this, { passive: false });
            canvas.addEventListener("pointerup", this, { passive: false });
            document.addEventListener("pointerup", this, { passive: false });
        }
        else {
            this.onmousedown = this.onpointerdown;
            this.onmousemove = this.onpointermove;
            this.onmouseup = this.onpointerup;
            canvas.addEventListener("mousedown", this, { passive: false });
            canvas.addEventListener("mousemove", this, { passive: false });
            canvas.addEventListener("mouseup", this, { passive: false });
            document.addEventListener("mouseup", this, { passive: false });
        }
    }
    changeColorDepth(image) {
        this.clear();
        const { naturalWidth, naturalHeight } = image;
        const canvasWidth = this.canvas.width * this.ratio;
        const canvasHeight = (canvasWidth * naturalHeight) / naturalWidth;
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.width = Math.round(canvasWidth / this.ratio) + "px";
        this.canvas.style.height = Math.round(canvasHeight / this.ratio) + "px";
        this.ctx.drawImage(image, 0, 0, naturalWidth, naturalHeight, 0, 0, canvasWidth, canvasHeight);
        this.imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = this.imageData.data;
        const length = data.length;
        const mapping = [0x00, 0x55, 0xaa, 0xff];
        const avoidBlocking = Math.round(5000 * this.ratio);
        return new Promise((resolve) => {
            const remap = (i) => {
                for (; i < length; i++) {
                    data[i] = mapping[data[i] >> 6];
                    if (i > 0 && i % avoidBlocking == 0) {
                        notifyColorDepthChanges.call(this, i, length);
                        return requestIdleCb(() => {
                            this.draw();
                            requestIdleCb(() => remap(i + 1));
                        });
                    }
                }
                notifyColorDepthChanges.call(this, i, length);
                resolve();
            };
            remap(0);
        });
    }
    clear() {
        if (!this.ctx) {
            this.ctx = this.canvas.getContext("2d");
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineJoin = "round";
        this.ctx.strokeStyle = "#ED1E45";
        this.ctx.fillStyle = "#000";
        this.ctx.lineWidth = 4 * this.ratio;
    }
    draw() {
        this.clear();
        if (this.imageData) {
            this.ctx.putImageData(this.imageData, 0, 0);
        }
        for (const rect of this.paths) {
            const method = `${rect.type}Rect`;
            this.ctx[method](rect.x * this.ratio, rect.y * this.ratio, rect.width * this.ratio, rect.height * this.ratio);
        }
    }
    handleEvent(event) {
        this[`on${event.type}`](event);
    }
    onpointerdown(event) {
        if (this.drawing || !io_element.utils.event.isLeftClick(event))
            return;
        stopEvent(event);
        this.drawing = true;
        const start = relativeCoordinates(event);
        this.rect = {
            type: this.mode,
            x: start.x,
            y: start.y,
            width: 0,
            height: 0
        };
        this.paths.add(this.rect);
    }
    onpointermove(event) {
        if (!this.drawing)
            return;
        stopEvent(event);
        this.updateRect(event);
        this.draw();
    }
    onpointerup(event) {
        if (!this.drawing)
            return;
        stopEvent(event);
        if (event.currentTarget === this.canvas) {
            this.updateRect(event);
        }
        this.draw();
        this.drawing = false;
        if (!this.rect.width && !this.rect.height) {
            this.paths.delete(this.rect);
            return;
        }
        const rect = this.rect;
        const parent = this.canvas.parentNode;
        const closeCoords = getRelativeCoordinates(this.canvas, rect, {
            x: rect.x + rect.width,
            y: rect.y + rect.height
        });
        parent.appendChild(io_element.wire() `
      <span
        class="closer"
        onclick="${(evt) => {
            if (!io_element.utils.event.isLeftClick(evt))
                return;
            stopEvent(evt);
            parent.removeChild(evt.currentTarget);
            this.paths.delete(rect);
            this.draw();
        }}"
        style="${{
            top: closeCoords.y + "px",
            left: closeCoords.x + "px"
        }}"
      >
        <img src="/skin/icons/close.svg" />
      </span>`);
    }
    updateRect(event) {
        const coords = relativeCoordinates(event);
        this.rect.width = coords.x - this.rect.x;
        this.rect.height = coords.y - this.rect.y;
    }
}
function notifyColorDepthChanges(value, max) {
    const info = { detail: { value, max } };
    const ioHighlighter = this.canvas.closest("io-highlighter");
    ioHighlighter.dispatchEvent(new CustomEvent("changecolordepth", info));
}
function getRelativeCoordinates(canvas, start, end) {
    const x = Math.max(start.x, end.x) + canvas.offsetLeft;
    const y = Math.min(start.y, end.y) + canvas.offsetTop;
    return { x: Math.round(x), y: Math.round(y) };
}
function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}
/* harmony default export */ const drawing_handler = (DrawingHandler);

;// ./js/io-highlighter.mjs



class IOHighlighter extends io_element {
    get defaultState() {
        return { drawing: "", changeDepth: null };
    }
    get changeDepth() {
        return this.state.changeDepth;
    }
    get edited() {
        return this.drawingHandler ? this.drawingHandler.paths.size > 0 : false;
    }
    edit(source) {
        return this.setState({
            changeDepth: new Promise((res, rej) => {
                const changeDepth = (image) => {
                    this.drawingHandler.changeColorDepth(image).then(res, rej);
                };
                if (typeof source === "string") {
                    const img = this.ownerDocument.createElement("img");
                    img.onload = () => changeDepth(img);
                    img.onerror = rej;
                    img.src = source;
                }
                else {
                    changeDepth(source);
                }
            })
        });
    }
    render() {
        if (this.state.drawing)
            this.setAttribute("drawing", this.state.drawing);
        else
            this.removeAttribute("drawing");
        this.html `
    <div class="split">
      <div class="options">
        <button
          tabindex="-1"
          class="highlight"
          onclick="${(event) => {
            if (io_element.utils.event.isLeftClick(event))
                changeMode(this, "highlight");
        }}"
        >
          Highlight
        </button>
        <button
          tabindex="-1"
          class="hide"
          onclick="${(event) => {
            if (io_element.utils.event.isLeftClick(event))
                changeMode(this, "hide");
        }}"
        >
          Hide
        </button>
      </div>
      <canvas />
    </div>`;
        if (!this.drawingHandler)
            this.drawingHandler = new drawing_handler($("canvas", this), parseInt(this.dataset.maxSize, 10) || 800);
    }
    toDataURL() {
        return $("canvas", this).toDataURL();
    }
}
IOHighlighter.define("io-highlighter");
const changeMode = (self, mode) => {
    const drawing = self.state.drawing === mode ? "" : mode;
    self.drawingHandler.mode = mode === "hide" ? "fill" : "stroke";
    self.setState({ drawing });
};

;// ./js/pages/issue-reporter/steps-manager.mjs



const managers = [
    ({ ioSteps, page, index }) => {
        page.addEventListener("change", (event) => {
            ioSteps.setCompleted(index, true);
            enableContinue();
        });
    },
    ({ ioSteps, page, index, screenshot }) => {
        ioSteps.addEventListener("step:click", function once(event) {
            if (event.detail !== index)
                return;
            ioSteps.removeEventListener(event.type, once);
            const ioHighlighter = document.createElement("io-highlighter");
            page.appendChild(ioHighlighter);
            ioHighlighter.edit(screenshot);
            ioSteps.setCompleted(index, true);
            enableContinue();
        });
    },
    ({ ioSteps, page, index }) => {
        Promise.all([
            new Promise((resolve) => {
                ioSteps.addEventListener("requestcollected", resolve);
            }),
            new Promise((resolve) => {
                ioSteps.addEventListener("formvalidated", (event) => {
                    ioSteps.setCompleted(index, event.detail);
                    $("button:last-child", ioSteps).disabled = true;
                    if (event.detail)
                        resolve();
                });
            })
        ]).then(() => {
            $("#continue").hidden = true;
            $("#send").hidden = false;
        });
    },
    ({ ioSteps, page, index, resolve }) => {
        ioSteps.addEventListener("step:click", function once(event) {
            ioSteps.removeEventListener(event.type, once);
            const ioHighlighter = $("io-highlighter");
            ioHighlighter.changeDepth.then(() => {
                resolve({
                    screenshot: {
                        get edited() {
                            return ioHighlighter.edited;
                        },
                        get data() {
                            return ioHighlighter.toDataURL();
                        }
                    }
                });
            });
        });
    }
];
const stepManager = ({ screenshot }) => new Promise((resolve) => {
    const ioSteps = $("io-steps");
    const pages = $$("main > .page");
    const btnContinue = $("#continue");
    let currentPage = pages[0];
    let index = 0;
    ioSteps.addEventListener("step:click", (event) => {
        index = event.detail;
        const nextPage = pages[index];
        if (nextPage === currentPage)
            return;
        currentPage.hidden = true;
        currentPage = nextPage;
        currentPage.hidden = false;
        btnContinue.disabled = !ioSteps.getCompleted(index);
    });
    btnContinue.addEventListener("click", (event) => {
        ioSteps.dispatchEvent(new CustomEvent("step:click", { detail: index + 1 }));
    });
    managers.forEach((setup, i) => {
        setup({ ioSteps, page: pages[i], index: i, resolve, screenshot });
    });
});
function enableContinue() {
    $("#continue").disabled = false;
}
/* harmony default export */ const steps_manager = (stepManager);

;// ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js
var injectStylesIntoStyleTag_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


var stylesInDOM = [];
function getIndexByIdentifier(identifier) {
  var result = -1;
  for (var i = 0; i < stylesInDOM.length; i++) {
    if (stylesInDOM[i].identifier === identifier) {
      result = i;
      break;
    }
  }
  return result;
}
function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var indexByIdentifier = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
      supports: item[4],
      layer: item[5]
    };
    if (indexByIdentifier !== -1) {
      stylesInDOM[indexByIdentifier].references++;
      stylesInDOM[indexByIdentifier].updater(obj);
    } else {
      var updater = addElementStyle(obj, options);
      options.byIndex = i;
      stylesInDOM.splice(i, 0, {
        identifier: identifier,
        updater: updater,
        references: 1
      });
    }
    identifiers.push(identifier);
  }
  return identifiers;
}
function addElementStyle(obj, options) {
  var api = options.domAPI(options);
  api.update(obj);
  var updater = function updater(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {
        return;
      }
      api.update(obj = newObj);
    } else {
      api.remove();
    }
  };
  return updater;
}
module.exports = function (list, options) {
  options = options || {};
  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];
    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDOM[index].references--;
    }
    var newLastIdentifiers = modulesToDom(newList, options);
    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];
      var _index = getIndexByIdentifier(_identifier);
      if (stylesInDOM[_index].references === 0) {
        stylesInDOM[_index].updater();
        stylesInDOM.splice(_index, 1);
      }
    }
    lastIdentifiers = newLastIdentifiers;
  };
};
});

var injectStylesIntoStyleTag_default = /*#__PURE__*/__webpack_require__.n(injectStylesIntoStyleTag_namespaceObject);
;// ../../node_modules/style-loader/dist/runtime/styleDomAPI.js
var styleDomAPI_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


/* istanbul ignore next  */
function apply(styleElement, options, obj) {
  var css = "";
  if (obj.supports) {
    css += "@supports (".concat(obj.supports, ") {");
  }
  if (obj.media) {
    css += "@media ".concat(obj.media, " {");
  }
  var needLayer = typeof obj.layer !== "undefined";
  if (needLayer) {
    css += "@layer".concat(obj.layer.length > 0 ? " ".concat(obj.layer) : "", " {");
  }
  css += obj.css;
  if (needLayer) {
    css += "}";
  }
  if (obj.media) {
    css += "}";
  }
  if (obj.supports) {
    css += "}";
  }
  var sourceMap = obj.sourceMap;
  if (sourceMap && typeof btoa !== "undefined") {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  }

  // For old IE
  /* istanbul ignore if  */
  options.styleTagTransform(css, styleElement, options.options);
}
function removeStyleElement(styleElement) {
  // istanbul ignore if
  if (styleElement.parentNode === null) {
    return false;
  }
  styleElement.parentNode.removeChild(styleElement);
}

/* istanbul ignore next  */
function domAPI(options) {
  if (typeof document === "undefined") {
    return {
      update: function update() {},
      remove: function remove() {}
    };
  }
  var styleElement = options.insertStyleElement(options);
  return {
    update: function update(obj) {
      apply(styleElement, options, obj);
    },
    remove: function remove() {
      removeStyleElement(styleElement);
    }
  };
}
module.exports = domAPI;
});

var styleDomAPI_default = /*#__PURE__*/__webpack_require__.n(styleDomAPI_namespaceObject);
;// ../../node_modules/style-loader/dist/runtime/insertBySelector.js
var insertBySelector_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


var memo = {};

/* istanbul ignore next  */
function getTarget(target) {
  if (typeof memo[target] === "undefined") {
    var styleTarget = document.querySelector(target);

    // Special case to return head of iframe instead of iframe itself
    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
      try {
        // This will throw an exception if access to iframe is blocked
        // due to cross-origin restrictions
        styleTarget = styleTarget.contentDocument.head;
      } catch (e) {
        // istanbul ignore next
        styleTarget = null;
      }
    }
    memo[target] = styleTarget;
  }
  return memo[target];
}

/* istanbul ignore next  */
function insertBySelector(insert, style) {
  var target = getTarget(insert);
  if (!target) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
  }
  target.appendChild(style);
}
module.exports = insertBySelector;
});

var insertBySelector_default = /*#__PURE__*/__webpack_require__.n(insertBySelector_namespaceObject);
;// ../../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js
var setAttributesWithoutAttributes_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


/* istanbul ignore next  */
function setAttributesWithoutAttributes(styleElement) {
  var nonce =  true ? __webpack_require__.nc : 0;
  if (nonce) {
    styleElement.setAttribute("nonce", nonce);
  }
}
module.exports = setAttributesWithoutAttributes;
});

var setAttributesWithoutAttributes_default = /*#__PURE__*/__webpack_require__.n(setAttributesWithoutAttributes_namespaceObject);
;// ../../node_modules/style-loader/dist/runtime/insertStyleElement.js
var insertStyleElement_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


/* istanbul ignore next  */
function insertStyleElement(options) {
  var element = document.createElement("style");
  options.setAttributes(element, options.attributes);
  options.insert(element, options.options);
  return element;
}
module.exports = insertStyleElement;
});

var insertStyleElement_default = /*#__PURE__*/__webpack_require__.n(insertStyleElement_namespaceObject);
;// ../../node_modules/style-loader/dist/runtime/styleTagTransform.js
var styleTagTransform_namespaceObject = /*#__PURE__*/__webpack_require__.cjs(function(module, exports) {


/* istanbul ignore next  */
function styleTagTransform(css, styleElement) {
  if (styleElement.styleSheet) {
    styleElement.styleSheet.cssText = css;
  } else {
    while (styleElement.firstChild) {
      styleElement.removeChild(styleElement.firstChild);
    }
    styleElement.appendChild(document.createTextNode(css));
  }
}
module.exports = styleTagTransform;
});

var styleTagTransform_default = /*#__PURE__*/__webpack_require__.n(styleTagTransform_namespaceObject);
// EXTERNAL MODULE: ./node_modules/css-loader/dist/cjs.js??ruleSet[1].rules[1].use[1]!../../node_modules/postcss-loader/dist/cjs.js!./src/issue-reporter/ui/issue-reporter.css
var issue_reporter = __webpack_require__(3230);
;// ./src/issue-reporter/ui/issue-reporter.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());

      options.insert = insertBySelector_default().bind(null, "head");
    
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(issue_reporter/* default */.A, options);




       /* harmony default export */ const ui_issue_reporter = (issue_reporter/* default */.A && issue_reporter/* default */.A.locals ? issue_reporter/* default */.A.locals : undefined);

;// ./js/pages/issue-reporter/index.mjs








const serverLogger = new ewe_ui_namespaceObject.telemetry.ServerLogger("adblockplus_ui");
const optionalPermissions = {
    permissions: ["contentSettings", "management"]
};
convertDoclinks();
initI18n();
function containsPermissions() {
    try {
        return browser.permissions.contains(optionalPermissions);
    }
    catch (ex) {
        return Promise.reject(ex);
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    const supportEmail = "support@adblockplus.org";
    setElementLinks("sr-warning", `mailto:${supportEmail}`);
    setElementLinks("other-issues", `mailto:${supportEmail}?subject=${encodeURIComponent("[Issue Reporter]")}`);
    const cancelButton = $("#cancel");
    cancelButton.addEventListener("click", closeMe);
    $("#hide-notification").addEventListener("click", () => {
        $("#notification").setAttribute("aria-hidden", true);
    });
    const screenshot = await browser.tabs.captureVisibleTab(null, {
        format: "png"
    });
    const tab = await browser.tabs.getCurrent();
    await browser.tabs.update(tab.id, { active: true });
    const manageSteps = steps_manager({ screenshot });
    const collectedData = collectData().catch((e) => {
        console.error(e);
        alert(e);
        closeMe();
    });
    $("#send").addEventListener("click", function sendAll(event) {
        const sendButton = event.currentTarget;
        const lastStep = $("io-steps button:last-child");
        sendButton.removeEventListener("click", sendAll);
        sendButton.disabled = true;
        lastStep.disabled = false;
        lastStep.click();
        $("io-highlighter").addEventListener("changecolordepth", (evt) => {
            const progress = $("#sendingProgress");
            const { max, value } = evt.detail;
            progress.max = max * 2;
            progress.value = value;
        });
        Promise.all([collectedData, manageSteps]).then((results) => {
            window.removeEventListener("beforeunload", closeMe);
            cancelButton.disabled = true;
            cancelButton.hidden = true;
            sendReport(reportWithScreenshot(...results));
            serverLogger.behavior("issue_report_submitted");
            sendButton.textContent = browser.i18n.getMessage("issueReporter_closeButton_label");
            $("io-steps").setCompleted(-1, true);
        });
    });
    containsPermissions()
        .then(() => {
        const includeConfig = $("#includeConfig");
        includeConfig.addEventListener("change", (event) => {
            if (!includeConfig.checked) {
                updateConfigurationInfo(false);
                return;
            }
            event.preventDefault();
            browser.permissions
                .request(optionalPermissions)
                .then((granted) => {
                return updateConfigurationInfo(granted).then(() => {
                    includeConfig.checked = granted;
                });
            })
                .catch(console.error)
                .then(() => browser.permissions.remove(optionalPermissions))
                .then((success) => {
                if (!success)
                    throw new Error("Failed to remove permissions");
            })
                .catch(console.error);
        });
    })
        .catch((err) => {
        const includeConfig = $("#includeConfigContainer");
        includeConfig.hidden = true;
    });
    const showDataOverlay = $("#showDataOverlay");
    $("#showData").addEventListener("click", (event) => {
        event.preventDefault();
        collectedData.then((xmlReport) => {
            closeRequestsCollectingTab().then(() => {
                showDataOverlay.hidden = false;
                reportWithScreenshot(xmlReport, { screenshot: $("io-highlighter") });
                const element = $("#showDataValue");
                element.textContent = asIndentedString(xmlReport);
                element.focus();
            });
        });
    });
    $("#showDataClose").addEventListener("click", (event) => {
        showDataOverlay.hidden = true;
        $("#showData").focus();
    });
});
let notifyClosing = true;
window.addEventListener("beforeunload", closeMe);
function closeMe() {
    if (notifyClosing) {
        notifyClosing = false;
        browser.runtime
            .sendMessage({
            type: "app.get",
            what: "senderId"
        })
            .then((tabId) => browser.tabs.remove(tabId));
    }
}
function reportWithScreenshot(xmlReport, stepsData) {
    const { edited, data } = stepsData.screenshot;
    const element = $("screenshot", xmlReport.documentElement) ||
        xmlReport.createElement("screenshot");
    element.setAttribute("edited", edited);
    const proc = browser.i18n.getMessage("issueReporter_processing_screenshot");
    element.textContent = data || `data:image/png;base64,...${proc}...`;
    xmlReport.documentElement.appendChild(element);
    return xmlReport;
}
function sendReport(reportData) {
    const params = new URLSearchParams();
    for (const [param, value] of [
        ["version", 1],
        ["guid", getUUID()],
        ["lang", $("adblock-plus", reportData).getAttribute("locale")]
    ]) {
        params.append(param, value);
    }
    const url = "https://reports.adblockplus.org/submitReport?" + params;
    const reportSent = (event) => {
        let success = false;
        let errorMessage = browser.i18n.getMessage("filters_subscription_lastDownload_connectionError");
        try {
            success = request.status == 200;
            if (request.status != 0)
                errorMessage = request.status + " " + request.statusText;
        }
        catch (e) {
        }
        let result;
        try {
            result = request.responseText;
        }
        catch (e) {
            result = "";
        }
        if (!success) {
            const errorElement = document.getElementById("error");
            const template = browser.i18n
                .getMessage("issueReporter_errorMessage")
                .replace(/[\r\n\s]+/g, " ");
            const [, before, linkText, after] = /(.*)\[link\](.*)\[\/link\](.*)/.exec(template) || [null, "", template, ""];
            const beforeLink = before.replace(/\?1\?/g, errorMessage);
            const afterLink = after.replace(/\?1\?/g, errorMessage);
            while (errorElement.firstChild)
                errorElement.removeChild(errorElement.firstChild);
            const link = document.createElement("a");
            link.textContent = linkText;
            browser.runtime
                .sendMessage({
                type: "app.get",
                what: "doclink",
                link: "reporter_connect_issue"
            })
                .then((supportUrl) => {
                link.href = supportUrl;
            });
            errorElement.appendChild(document.createTextNode(beforeLink));
            errorElement.appendChild(link);
            errorElement.appendChild(document.createTextNode(afterLink));
            errorElement.hidden = false;
        }
        result = result.replace(/%CONFIRMATION%/g, encodeHTML(browser.i18n.getMessage("issueReporter_confirmationMessage")));
        result = result.replace(/%KNOWNISSUE%/g, encodeHTML(browser.i18n.getMessage("issueReporter_knownIssueMessage")));
        const { direction } = window.getComputedStyle(document.documentElement, "");
        result = result.replace(/(<html)\b/, `$1 dir="${encodeHTML(direction)}"`);
        document.getElementById("sendReportMessage").hidden = true;
        document.getElementById("sendingProgressContainer").hidden = true;
        const resultFrame = document.getElementById("result");
        resultFrame.setAttribute("src", "data:text/html;charset=utf-8," + encodeURIComponent(result));
        resultFrame.hidden = false;
        document.getElementById("continue").disabled = false;
        if (success) {
            $("#send").disabled = false;
            $("#send").addEventListener("click", closeMe);
        }
    };
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "text/xml");
    request.setRequestHeader("X-Adblock-Plus", "1");
    request.addEventListener("load", reportSent);
    request.addEventListener("error", reportSent);
    const progress = document.getElementById("sendingProgress");
    request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable)
            return;
        if (event.loaded > 0) {
            progress.max = 100;
            progress.value = 50 + (50 * event.loaded) / event.total;
        }
    });
    request.send(asIndentedString(reportData));
}
function encodeHTML(str) {
    return str.replace(/[&<>"]/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    })[c]);
}
document.body.hidden = false;


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
/******/ 			id: moduleId,
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
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			const getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.hasOwn(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/set anonymous default export name */
/******/ 	(() => {
/******/ 		// set .name for anonymous default exports per ES spec
/******/ 		// skipped when the property is non-configurable (pre-ES2015 engines),
/******/ 		// where Object.defineProperty would throw
/******/ 		__webpack_require__.dn = (x) => {
/******/ 			var descriptor = Object.getOwnPropertyDescriptor(x, "name");
/******/ 			if (!descriptor || (!descriptor.writable && descriptor.configurable)) Object.defineProperty(x, "name", { value: "default", configurable: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/wrap commonjs module */
/******/ 	(() => {
/******/ 		// execute a CommonJS module body with real module/exports objects, returning the final exports
/******/ 		__webpack_require__.cjs = (body) => {
/******/ 			const mod = { exports: {} };
/******/ 			body.call(mod.exports, mod, mod.exports);
/******/ 			return mod.exports;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	(() => {
/******/ 		__webpack_require__.nc = undefined;
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module used 'module' so it can't be inlined
/******/ 	let __webpack_exports__ = __webpack_require__(8848);
/******/ 	
/******/ })()
;
//# sourceMappingURL=issue-reporter.js.map