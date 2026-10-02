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

/***/ 1918
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6054);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_landing_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(9852);
// Imports




var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_landing_css__WEBPACK_IMPORTED_MODULE_3__/* ["default"] */ .A);
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

/*******************************************************************************
 * Header
 ******************************************************************************/

header {
  margin-bottom: 20px;
}

#title {
  flex: 1;
}

#version {
  padding: 0.3em 0.5em;
  border-radius: var(--border-radius);
  font-weight: 600;
  color: rgb(89, 164, 6);
  background-color: rgba(89, 164, 6, 0.25);
}

h1 {
  margin: 10px 0 14px;
}

#title p {
  margin: 0;
}

/*******************************************************************************
 * Updates
 ******************************************************************************/

#improvements h2::before {
  background-image: url(/skin/icons/improvements.svg);
}

#fixes h2::before {
  background-image: url(/skin/icons/fixes.svg);
}

.updates {
  padding: 0;
  line-height: 22px;
}

.updates > li {
  padding: 20px 50px;
  margin-bottom: 20px;
  border: 1px solid #ebebeb;
  border-radius: var(--border-radius);
  background-color: #fff;
  list-style: none;
}

html[dir="ltr"] .updates > li {
  padding-right: 100px;
}

html[dir="rtl"] .updates > li {
  padding-left: 100px;
}

.updates h3 {
  position: relative;
  margin-top: 0;
  font-size: 1rem;
  color: #5a5a5a;
}

.updates h3::before {
  position: absolute;
  width: 20px;
  height: 20px;
  background-image: url(/skin/icons/update.svg);
  background-size: 100%;
  content: "";
}

html[dir="ltr"] .updates h3::before {
  left: -35px;
}

html[dir="rtl"] .updates h3::before {
  right: -35px;
}

.updates p {
  font-size: 0.9em;
  color: #757575;
}

.updates p:last-child {
  margin-bottom: 0;
}

.updates a {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-link);
  text-decoration: none;
}

.updates a:hover {
  text-decoration: underline;
}

.updates img,
.updates video {
  border: 1px solid #dcdcdc;
}

.updates video,
.updates img,
.updates .fallback {
  position: relative;
  max-width: 500px;
  width: 100%;
  background-color: #f8f8f8;
}

.updates .fallback {
  text-align: center;
}

/*******************************************************************************
 * Contribute
 ******************************************************************************/

#contribute p {
  color: #5a5a5a;
}

#contribute h3 {
  margin: 0;
  line-height: 45px;
  font-size: 1.5em;
}

#contribute > header {
  text-align: center;
}

#contribute > .columns {
  display: flex;
}

#contribute > .columns > section {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: flex-start;
  max-width: 460px;
  margin: auto;
  padding: 20px 60px 20px 24px;
  border: 1px solid #ebebeb;
  border-radius: var(--border-radius);
  background-color: #fff;
}

html[dir="ltr"] #contribute > .columns > section:not(:last-child) {
  margin-right: 20px;
}

html[dir="rtl"] #contribute > .columns > section:not(:last-child) {
  margin-right: 20px;
}

#contribute .block-icon {
  --icon-width: 38px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
}

#contribute .block-icon::before {
  top: 0.25em;
}

#contribute .block-icon p {
  flex: 1;
  margin-top: 0.75em;
  margin-bottom: 1.5em;
}

body[data-store="edge"] #contribute-rate {
  display: none;
}

#contribute-rate > .block-icon::before {
  background-image: url(/skin/icons/waving.svg);
}

#contribute-donate > .block-icon::before {
  background-image: url(/skin/icons/donate.svg);
}
`, "",{"version":3,"sources":["webpack://./src/updates/ui/updates.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAKF;;+EAE+E;;AAE/E;EACE,mBAAmB;AACrB;;AAEA;EACE,OAAO;AACT;;AAEA;EACE,oBAAoB;EACpB,mCAAmC;EACnC,gBAAgB;EAChB,sBAAsB;EACtB,wCAAwC;AAC1C;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,SAAS;AACX;;AAEA;;+EAE+E;;AAE/E;EACE,mDAAmD;AACrD;;AAEA;EACE,4CAA4C;AAC9C;;AAEA;EACE,UAAU;EACV,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;EAClB,mBAAmB;EACnB,yBAAyB;EACzB,mCAAmC;EACnC,sBAAsB;EACtB,gBAAgB;AAClB;;AAEA;EACE,oBAAoB;AACtB;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,kBAAkB;EAClB,aAAa;EACb,eAAe;EACf,cAAc;AAChB;;AAEA;EACE,kBAAkB;EAClB,WAAW;EACX,YAAY;EACZ,6CAA6C;EAC7C,qBAAqB;EACrB,WAAW;AACb;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,YAAY;AACd;;AAEA;EACE,gBAAgB;EAChB,cAAc;AAChB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,eAAe;EACf,gBAAgB;EAChB,wBAAwB;EACxB,qBAAqB;AACvB;;AAEA;EACE,0BAA0B;AAC5B;;AAEA;;EAEE,yBAAyB;AAC3B;;AAEA;;;EAGE,kBAAkB;EAClB,gBAAgB;EAChB,WAAW;EACX,yBAAyB;AAC3B;;AAEA;EACE,kBAAkB;AACpB;;AAEA;;+EAE+E;;AAE/E;EACE,cAAc;AAChB;;AAEA;EACE,SAAS;EACT,iBAAiB;EACjB,gBAAgB;AAClB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,aAAa;AACf;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,OAAO;EACP,uBAAuB;EACvB,gBAAgB;EAChB,YAAY;EACZ,4BAA4B;EAC5B,yBAAyB;EACzB,mCAAmC;EACnC,sBAAsB;AACxB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,kBAAkB;EAClB,aAAa;EACb,sBAAsB;EACtB,uBAAuB;EACvB,YAAY;AACd;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,OAAO;EACP,kBAAkB;EAClB,oBAAoB;AACtB;;AAEA;EACE,aAAa;AACf;;AAEA;EACE,6CAA6C;AAC/C;;AAEA;EACE,6CAA6C;AAC/C","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n@import \"../../theme/ui/font.css\";\n@import \"../../theme/ui/landing.css\";\n\n/*******************************************************************************\n * Header\n ******************************************************************************/\n\nheader {\n  margin-bottom: 20px;\n}\n\n#title {\n  flex: 1;\n}\n\n#version {\n  padding: 0.3em 0.5em;\n  border-radius: var(--border-radius);\n  font-weight: 600;\n  color: rgb(89, 164, 6);\n  background-color: rgba(89, 164, 6, 0.25);\n}\n\nh1 {\n  margin: 10px 0 14px;\n}\n\n#title p {\n  margin: 0;\n}\n\n/*******************************************************************************\n * Updates\n ******************************************************************************/\n\n#improvements h2::before {\n  background-image: url(/skin/icons/improvements.svg);\n}\n\n#fixes h2::before {\n  background-image: url(/skin/icons/fixes.svg);\n}\n\n.updates {\n  padding: 0;\n  line-height: 22px;\n}\n\n.updates > li {\n  padding: 20px 50px;\n  margin-bottom: 20px;\n  border: 1px solid #ebebeb;\n  border-radius: var(--border-radius);\n  background-color: #fff;\n  list-style: none;\n}\n\nhtml[dir=\"ltr\"] .updates > li {\n  padding-right: 100px;\n}\n\nhtml[dir=\"rtl\"] .updates > li {\n  padding-left: 100px;\n}\n\n.updates h3 {\n  position: relative;\n  margin-top: 0;\n  font-size: 1rem;\n  color: #5a5a5a;\n}\n\n.updates h3::before {\n  position: absolute;\n  width: 20px;\n  height: 20px;\n  background-image: url(/skin/icons/update.svg);\n  background-size: 100%;\n  content: \"\";\n}\n\nhtml[dir=\"ltr\"] .updates h3::before {\n  left: -35px;\n}\n\nhtml[dir=\"rtl\"] .updates h3::before {\n  right: -35px;\n}\n\n.updates p {\n  font-size: 0.9em;\n  color: #757575;\n}\n\n.updates p:last-child {\n  margin-bottom: 0;\n}\n\n.updates a {\n  font-size: 1rem;\n  font-weight: 600;\n  color: var(--color-link);\n  text-decoration: none;\n}\n\n.updates a:hover {\n  text-decoration: underline;\n}\n\n.updates img,\n.updates video {\n  border: 1px solid #dcdcdc;\n}\n\n.updates video,\n.updates img,\n.updates .fallback {\n  position: relative;\n  max-width: 500px;\n  width: 100%;\n  background-color: #f8f8f8;\n}\n\n.updates .fallback {\n  text-align: center;\n}\n\n/*******************************************************************************\n * Contribute\n ******************************************************************************/\n\n#contribute p {\n  color: #5a5a5a;\n}\n\n#contribute h3 {\n  margin: 0;\n  line-height: 45px;\n  font-size: 1.5em;\n}\n\n#contribute > header {\n  text-align: center;\n}\n\n#contribute > .columns {\n  display: flex;\n}\n\n#contribute > .columns > section {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  align-items: flex-start;\n  max-width: 460px;\n  margin: auto;\n  padding: 20px 60px 20px 24px;\n  border: 1px solid #ebebeb;\n  border-radius: var(--border-radius);\n  background-color: #fff;\n}\n\nhtml[dir=\"ltr\"] #contribute > .columns > section:not(:last-child) {\n  margin-right: 20px;\n}\n\nhtml[dir=\"rtl\"] #contribute > .columns > section:not(:last-child) {\n  margin-right: 20px;\n}\n\n#contribute .block-icon {\n  --icon-width: 38px;\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  height: 100%;\n}\n\n#contribute .block-icon::before {\n  top: 0.25em;\n}\n\n#contribute .block-icon p {\n  flex: 1;\n  margin-top: 0.75em;\n  margin-bottom: 1.5em;\n}\n\nbody[data-store=\"edge\"] #contribute-rate {\n  display: none;\n}\n\n#contribute-rate > .block-icon::before {\n  background-image: url(/skin/icons/waving.svg);\n}\n\n#contribute-donate > .block-icon::before {\n  background-image: url(/skin/icons/donate.svg);\n}\n"],"sourceRoot":""}]);
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

/***/ 9852
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2929);
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1287);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_light_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4341);
// Imports



var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_light_css__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .A);
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

/*******************************************************************************
 * General
 ******************************************************************************/

:root {
  --color-content: #fff;
  --color-footer: #000;
  --color-highlight: var(--color-brand-primary);
  --color-primary: #0797e1;
  --color-primary-hover: #0789ca;
  --color-secondary: #fafafa;
  --margin: 60px;
  font-size: 16px;
}

body {
  margin: 0;
}

a {
  color: var(--color-link);
}

a.button {
  display: inline-block;
  padding: 1em 2.5em;
  border: 3px solid var(--color-content);
  border-radius: 0.5em;
  font-weight: 600;
  color: var(--color-content);
  background-color: var(--color-primary);
  text-transform: uppercase;
  text-decoration: none;
  transition: all 200ms;
}

a.button:hover {
  background-color: var(--color-primary-hover);
}

a.button.secondary {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-content);
}

a.button.secondary:hover {
  border-color: var(--color-primary-hover);
  color: var(--color-content);
  background-color: var(--color-primary-hover);
}

h1,
h2 {
  margin: 0 0 1rem;
}

h1 {
  font-size: 60px;
  line-height: 70px;
}

h2 {
  font-size: 30px;
  line-height: 40px;
}

h2.icon::before {
  display: inline-block;
  width: 23px;
  height: 23px;
  vertical-align: middle;
  background-size: 100%;
  content: "";
}

html[dir="ltr"] h2.icon::before {
  margin-right: 10px;
}

html[dir="rtl"] h2.icon::before {
  margin-left: 10px;
}

.block-icon {
  --icon-width: 40px;
  position: relative;
}

html[dir="ltr"] .block-icon {
  padding-left: calc(var(--icon-width) + 20px);
}

html[dir="rtl"] .block-icon {
  padding-right: calc(var(--icon-width) + 20px);
}

.block-icon::before {
  position: absolute;
  width: var(--icon-width);
  height: var(--icon-width);
  background-size: 100%;
  background-repeat: no-repeat;
  content: "";
}

html[dir="ltr"] .block-icon::before {
  left: 0;
}

html[dir="rtl"] .block-icon::before {
  right: 0;
}

/*******************************************************************************
 * Header
 ******************************************************************************/

header p {
  margin: 1.5em 0;
  color: #5a5a5a;
}

header .block-icon {
  --icon-width: 50px;
}

header a.logo {
  display: inline-block;
  margin-bottom: 70px;
}

header a.logo img {
  width: 200px;
}

#hero {
  flex: 0;
}

html[dir="ltr"] #hero {
  margin-left: 40px;
}

html[dir="rtl"] #hero {
  margin-right: 40px;
}

/*******************************************************************************
 * Footer
 ******************************************************************************/

footer {
  padding: 30px;
  font-size: 0.8rem;
  text-align: center;
  color: var(--color-content);
  background-color: var(--color-footer);
}

#copyright-notice a {
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}

#copyright-notice a:hover {
  text-decoration: underline;
}

/*******************************************************************************
 * Content
 ******************************************************************************/

.content {
  position: relative;
  box-sizing: border-box;
  max-width: 940px;
  margin: auto;
  padding: var(--margin) 0 50px;
}

.content:not(:first-child) {
  padding-top: 0;
}

.content.columns {
  display: flex;
}

.content p {
  margin-top: 0;
  line-height: 26px;
}

.content.columns > div {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
}

.content.columns > div:last-child {
  align-items: flex-end;
}

@media (max-width: 960px) {
  .content.columns {
    flex-direction: column;
  }

  .content.columns > div:last-child {
    margin-top: 1em;
    align-items: flex-start;
  }
}

/*******************************************************************************
 * Sections
 ******************************************************************************/

article {
  position: relative;
}

article.primary,
article:last-child {
  margin-bottom: var(--margin);
}

article.primary::after,
article.secondary::before,
article:last-child::after {
  position: absolute;
  width: 100%;
  height: var(--margin);
  content: "";
}

article.primary::after,
article:last-child::after {
  top: 100%;
}

article.secondary::before {
  top: calc(var(--margin) * -1);
}

:not(.columns) > section:not(:first-of-type) {
  margin-top: 75px;
}

article.primary {
  margin-top: calc(100px + var(--margin));
  color: var(--color-content);
  background-color: var(--color-primary);
}

article.primary::after {
  background-image: linear-gradient(
    to bottom right,
    var(--color-primary) 49%,
    var(--color-content) 50%
  );
}

article.secondary {
  background-color: var(--color-secondary);
}

article.secondary::before {
  background-image: linear-gradient(
    to bottom right,
    var(--color-content) 49%,
    var(--color-secondary) 50%
  );
}

article:last-child::after {
  background-image: linear-gradient(
    to bottom right,
    var(--color-content) 49%,
    var(--color-footer) 50%
  );
}

/*******************************************************************************
 * Social
 ******************************************************************************/

#social .content {
  max-width: 230px;
  text-align: center;
}

#social p {
  color: #5a5a5a;
}

#social a {
  display: inline-block;
  width: 3em;
  height: 3em;
  margin: 1em 10px 0;
  border-radius: 1.5em;
  background-color: #000;
  background-position: center;
  background-repeat: no-repeat;
}

#social a.email {
  background-image: url(/skin/icons/email-white.svg);
}

#social a.facebook {
  background-image: url(/skin/icons/facebook-white.svg);
}

#social a.twitter {
  background-image: url(/skin/icons/twitter-white.svg);
}
`, "",{"version":3,"sources":["webpack://./src/theme/ui/landing.css"],"names":[],"mappings":"AAAA;;;;;;;;;;;;;;;EAeE;;AAIF;;+EAE+E;;AAE/E;EACE,qBAAqB;EACrB,oBAAoB;EACpB,6CAA6C;EAC7C,wBAAwB;EACxB,8BAA8B;EAC9B,0BAA0B;EAC1B,cAAc;EACd,eAAe;AACjB;;AAEA;EACE,SAAS;AACX;;AAEA;EACE,wBAAwB;AAC1B;;AAEA;EACE,qBAAqB;EACrB,kBAAkB;EAClB,sCAAsC;EACtC,oBAAoB;EACpB,gBAAgB;EAChB,2BAA2B;EAC3B,sCAAsC;EACtC,yBAAyB;EACzB,qBAAqB;EACrB,qBAAqB;AACvB;;AAEA;EACE,4CAA4C;AAC9C;;AAEA;EACE,kCAAkC;EAClC,2BAA2B;EAC3B,sCAAsC;AACxC;;AAEA;EACE,wCAAwC;EACxC,2BAA2B;EAC3B,4CAA4C;AAC9C;;AAEA;;EAEE,gBAAgB;AAClB;;AAEA;EACE,eAAe;EACf,iBAAiB;AACnB;;AAEA;EACE,eAAe;EACf,iBAAiB;AACnB;;AAEA;EACE,qBAAqB;EACrB,WAAW;EACX,YAAY;EACZ,sBAAsB;EACtB,qBAAqB;EACrB,WAAW;AACb;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;EAClB,kBAAkB;AACpB;;AAEA;EACE,4CAA4C;AAC9C;;AAEA;EACE,6CAA6C;AAC/C;;AAEA;EACE,kBAAkB;EAClB,wBAAwB;EACxB,yBAAyB;EACzB,qBAAqB;EACrB,4BAA4B;EAC5B,WAAW;AACb;;AAEA;EACE,OAAO;AACT;;AAEA;EACE,QAAQ;AACV;;AAEA;;+EAE+E;;AAE/E;EACE,eAAe;EACf,cAAc;AAChB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,qBAAqB;EACrB,mBAAmB;AACrB;;AAEA;EACE,YAAY;AACd;;AAEA;EACE,OAAO;AACT;;AAEA;EACE,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;;+EAE+E;;AAE/E;EACE,aAAa;EACb,iBAAiB;EACjB,kBAAkB;EAClB,2BAA2B;EAC3B,qCAAqC;AACvC;;AAEA;EACE,gBAAgB;EAChB,qBAAqB;EACrB,cAAc;AAChB;;AAEA;EACE,0BAA0B;AAC5B;;AAEA;;+EAE+E;;AAE/E;EACE,kBAAkB;EAClB,sBAAsB;EACtB,gBAAgB;EAChB,YAAY;EACZ,6BAA6B;AAC/B;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,aAAa;AACf;;AAEA;EACE,aAAa;EACb,iBAAiB;AACnB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,OAAO;EACP,uBAAuB;EACvB,uBAAuB;AACzB;;AAEA;EACE,qBAAqB;AACvB;;AAEA;EACE;IACE,sBAAsB;EACxB;;EAEA;IACE,eAAe;IACf,uBAAuB;EACzB;AACF;;AAEA;;+EAE+E;;AAE/E;EACE,kBAAkB;AACpB;;AAEA;;EAEE,4BAA4B;AAC9B;;AAEA;;;EAGE,kBAAkB;EAClB,WAAW;EACX,qBAAqB;EACrB,WAAW;AACb;;AAEA;;EAEE,SAAS;AACX;;AAEA;EACE,6BAA6B;AAC/B;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,uCAAuC;EACvC,2BAA2B;EAC3B,sCAAsC;AACxC;;AAEA;EACE;;;;GAIC;AACH;;AAEA;EACE,wCAAwC;AAC1C;;AAEA;EACE;;;;GAIC;AACH;;AAEA;EACE;;;;GAIC;AACH;;AAEA;;+EAE+E;;AAE/E;EACE,gBAAgB;EAChB,kBAAkB;AACpB;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,qBAAqB;EACrB,UAAU;EACV,WAAW;EACX,kBAAkB;EAClB,oBAAoB;EACpB,sBAAsB;EACtB,2BAA2B;EAC3B,4BAA4B;AAC9B;;AAEA;EACE,kDAAkD;AACpD;;AAEA;EACE,qDAAqD;AACvD;;AAEA;EACE,oDAAoD;AACtD","sourcesContent":["/*\n * This file is part of Adblock Plus <https://adblockplus.org/>,\n * Copyright (C) 2006-present eyeo GmbH\n *\n * Adblock Plus is free software: you can redistribute it and/or modify\n * it under the terms of the GNU General Public License version 3 as\n * published by the Free Software Foundation.\n *\n * Adblock Plus is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License\n * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.\n */\n\n@import \"./light.css\";\n\n/*******************************************************************************\n * General\n ******************************************************************************/\n\n:root {\n  --color-content: #fff;\n  --color-footer: #000;\n  --color-highlight: var(--color-brand-primary);\n  --color-primary: #0797e1;\n  --color-primary-hover: #0789ca;\n  --color-secondary: #fafafa;\n  --margin: 60px;\n  font-size: 16px;\n}\n\nbody {\n  margin: 0;\n}\n\na {\n  color: var(--color-link);\n}\n\na.button {\n  display: inline-block;\n  padding: 1em 2.5em;\n  border: 3px solid var(--color-content);\n  border-radius: 0.5em;\n  font-weight: 600;\n  color: var(--color-content);\n  background-color: var(--color-primary);\n  text-transform: uppercase;\n  text-decoration: none;\n  transition: all 200ms;\n}\n\na.button:hover {\n  background-color: var(--color-primary-hover);\n}\n\na.button.secondary {\n  border-color: var(--color-primary);\n  color: var(--color-primary);\n  background-color: var(--color-content);\n}\n\na.button.secondary:hover {\n  border-color: var(--color-primary-hover);\n  color: var(--color-content);\n  background-color: var(--color-primary-hover);\n}\n\nh1,\nh2 {\n  margin: 0 0 1rem;\n}\n\nh1 {\n  font-size: 60px;\n  line-height: 70px;\n}\n\nh2 {\n  font-size: 30px;\n  line-height: 40px;\n}\n\nh2.icon::before {\n  display: inline-block;\n  width: 23px;\n  height: 23px;\n  vertical-align: middle;\n  background-size: 100%;\n  content: \"\";\n}\n\nhtml[dir=\"ltr\"] h2.icon::before {\n  margin-right: 10px;\n}\n\nhtml[dir=\"rtl\"] h2.icon::before {\n  margin-left: 10px;\n}\n\n.block-icon {\n  --icon-width: 40px;\n  position: relative;\n}\n\nhtml[dir=\"ltr\"] .block-icon {\n  padding-left: calc(var(--icon-width) + 20px);\n}\n\nhtml[dir=\"rtl\"] .block-icon {\n  padding-right: calc(var(--icon-width) + 20px);\n}\n\n.block-icon::before {\n  position: absolute;\n  width: var(--icon-width);\n  height: var(--icon-width);\n  background-size: 100%;\n  background-repeat: no-repeat;\n  content: \"\";\n}\n\nhtml[dir=\"ltr\"] .block-icon::before {\n  left: 0;\n}\n\nhtml[dir=\"rtl\"] .block-icon::before {\n  right: 0;\n}\n\n/*******************************************************************************\n * Header\n ******************************************************************************/\n\nheader p {\n  margin: 1.5em 0;\n  color: #5a5a5a;\n}\n\nheader .block-icon {\n  --icon-width: 50px;\n}\n\nheader a.logo {\n  display: inline-block;\n  margin-bottom: 70px;\n}\n\nheader a.logo img {\n  width: 200px;\n}\n\n#hero {\n  flex: 0;\n}\n\nhtml[dir=\"ltr\"] #hero {\n  margin-left: 40px;\n}\n\nhtml[dir=\"rtl\"] #hero {\n  margin-right: 40px;\n}\n\n/*******************************************************************************\n * Footer\n ******************************************************************************/\n\nfooter {\n  padding: 30px;\n  font-size: 0.8rem;\n  text-align: center;\n  color: var(--color-content);\n  background-color: var(--color-footer);\n}\n\n#copyright-notice a {\n  font-weight: 600;\n  text-decoration: none;\n  color: inherit;\n}\n\n#copyright-notice a:hover {\n  text-decoration: underline;\n}\n\n/*******************************************************************************\n * Content\n ******************************************************************************/\n\n.content {\n  position: relative;\n  box-sizing: border-box;\n  max-width: 940px;\n  margin: auto;\n  padding: var(--margin) 0 50px;\n}\n\n.content:not(:first-child) {\n  padding-top: 0;\n}\n\n.content.columns {\n  display: flex;\n}\n\n.content p {\n  margin-top: 0;\n  line-height: 26px;\n}\n\n.content.columns > div {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  align-items: flex-start;\n  justify-content: center;\n}\n\n.content.columns > div:last-child {\n  align-items: flex-end;\n}\n\n@media (max-width: 960px) {\n  .content.columns {\n    flex-direction: column;\n  }\n\n  .content.columns > div:last-child {\n    margin-top: 1em;\n    align-items: flex-start;\n  }\n}\n\n/*******************************************************************************\n * Sections\n ******************************************************************************/\n\narticle {\n  position: relative;\n}\n\narticle.primary,\narticle:last-child {\n  margin-bottom: var(--margin);\n}\n\narticle.primary::after,\narticle.secondary::before,\narticle:last-child::after {\n  position: absolute;\n  width: 100%;\n  height: var(--margin);\n  content: \"\";\n}\n\narticle.primary::after,\narticle:last-child::after {\n  top: 100%;\n}\n\narticle.secondary::before {\n  top: calc(var(--margin) * -1);\n}\n\n:not(.columns) > section:not(:first-of-type) {\n  margin-top: 75px;\n}\n\narticle.primary {\n  margin-top: calc(100px + var(--margin));\n  color: var(--color-content);\n  background-color: var(--color-primary);\n}\n\narticle.primary::after {\n  background-image: linear-gradient(\n    to bottom right,\n    var(--color-primary) 49%,\n    var(--color-content) 50%\n  );\n}\n\narticle.secondary {\n  background-color: var(--color-secondary);\n}\n\narticle.secondary::before {\n  background-image: linear-gradient(\n    to bottom right,\n    var(--color-content) 49%,\n    var(--color-secondary) 50%\n  );\n}\n\narticle:last-child::after {\n  background-image: linear-gradient(\n    to bottom right,\n    var(--color-content) 49%,\n    var(--color-footer) 50%\n  );\n}\n\n/*******************************************************************************\n * Social\n ******************************************************************************/\n\n#social .content {\n  max-width: 230px;\n  text-align: center;\n}\n\n#social p {\n  color: #5a5a5a;\n}\n\n#social a {\n  display: inline-block;\n  width: 3em;\n  height: 3em;\n  margin: 1em 10px 0;\n  border-radius: 1.5em;\n  background-color: #000;\n  background-position: center;\n  background-repeat: no-repeat;\n}\n\n#social a.email {\n  background-image: url(/skin/icons/email-white.svg);\n}\n\n#social a.facebook {\n  background-image: url(/skin/icons/facebook-white.svg);\n}\n\n#social a.twitter {\n  background-image: url(/skin/icons/twitter-white.svg);\n}\n"],"sourceRoot":""}]);
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

/***/ 1735
(__webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {


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
const remove = (get, children, start, end) => {
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
                    remove(get, currentNodes, currentStart++, currentStart);
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
        remove(get, currentNodes, currentStart, currentEnd);
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
            remove(get, currentNodes, currentStart, i);
            remove(get, currentNodes, i + futureChanges, currentEnd);
            return futureNodes;
        }
    }
    if ((currentChanges < 2 || futureChanges < 2)) {
        append(get, parentNode, futureNodes, futureStart, futureEnd, get(currentNodes[currentStart], 0));
        remove(get, currentNodes, currentStart, currentEnd);
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

;// ./src/core/messaging/front/utils.ts
async function send(sendType, options = {}) {
    const args = {
        ...options,
        type: sendType
    };
    return await browser.runtime.sendMessage(args);
}

;// ./src/core/messaging/front/category-app.ts


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
    listen({ type: "app", filter });
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

;// ./src/core/messaging/front/category-doclinks.ts

async function category_doclinks_get(link) {
    const options = { what: "doclink", link };
    return await send("app.get", options);
}

;// ./src/core/messaging/front/category-filters.ts
/* unused harmony import specifier */ var messaging;
/* unused harmony import specifier */ var category_filters_send;


async function category_filters_get() {
    return await category_filters_send("filters.get");
}
function category_filters_listen(filter) {
    messaging.listen({ type: "filters", filter });
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
async function category_premium_remove(subscriptionType) {
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
// EXTERNAL MODULE: ./node_modules/css-loader/dist/cjs.js??ruleSet[1].rules[1].use[1]!../../node_modules/postcss-loader/dist/cjs.js!./src/updates/ui/updates.css
var updates = __webpack_require__(1918);
;// ./src/updates/ui/updates.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());

      options.insert = insertBySelector_default().bind(null, "head");
    
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(updates/* default */.A, options);




       /* harmony default export */ const ui_updates = (updates/* default */.A && updates/* default */.A.locals ? updates/* default */.A.locals : undefined);

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
/* harmony default export */ const io_element = ((/* unused pure expression or super */ null && (IOElement)));

;// ./js/landing.mjs


function initCopyrightNotice() {
    category_doclinks_get("eyeo").then((url) => {
        const year = new Date().getFullYear().toString();
        const notice = document.getElementById("copyright-notice");
        setElementText(notice, "common_copyright", year);
        setElementLinks("copyright-notice", url);
    });
}
initCopyrightNotice();

;// ./js/pages/updates.mjs








const localeInfo = get("localeInfo");
async function addUpdates(container, updates) {
    const [appLanguage, appRegion] = (await localeInfo).locale.split("-");
    updates = updates.filter(({ exceptions }) => {
        if (!exceptions)
            return true;
        const { locales } = exceptions;
        if (locales) {
            for (const locale of locales) {
                const [language, region] = locale.split("-");
                if (language === appLanguage && (!region || region === appRegion))
                    return false;
            }
        }
        return true;
    });
    if (!updates.length) {
        container.hidden = true;
        return;
    }
    const items = updates.map((update) => {
        let link = null;
        if (update.doclink) {
            link = hyper_wire() `<p>
        <a href="#" target="_blank">
          ${{ i18n: "updates_link" }}
        </a>
      </p>`;
            category_doclinks_get(update.doclink).then((url) => {
                $("a", link).href = url;
            });
        }
        let media = null;
        if (update.image) {
            media = hyper_wire() `<img
        src="${update.image.url}"
        alt="${browser.i18n.getMessage(`updates_update_${update.id}_image`)}">`;
        }
        else if (update.video) {
            const videoDescription = `updates_update_${update.id}_video`;
            media = hyper_wire() `<video
        autoplay loop muted
        aria-label="${browser.i18n.getMessage(videoDescription)}">
        <source src="${update.video.url}" type="${update.video.type}">
        </source>
      </video>`;
            media.muted = true;
            const fallback = hyper_wire() `<div class="fallback">
        ${{ i18n: videoDescription }}
      </div>`;
            media.addEventListener("error", () => {
                media.parentElement.replaceChild(fallback, media);
            }, true);
        }
        return hyper_wire() `<li>
      <h3>${{ i18n: `updates_update_${update.id}_title` }}</h3>
      <p>${{ i18n: `updates_update_${update.id}_description` }}</p>
      ${link}
      ${media}
    </li>`;
    });
    const list = $(".updates", container);
    bind(list) `${items}`;
}
function initUpdates() {
    fetch("data/updates.json")
        .then((resp) => resp.json())
        .then((updates) => {
        $("#hero > img").src = updates.title.image;
        addUpdates($("#improvements"), updates.improvements);
        addUpdates($("#fixes"), updates.fixes);
    });
}
function initVersion() {
    get("addonVersion").then((addonVersion) => {
        $("#version").textContent = `v${addonVersion}`;
    });
}
function initContribute() {
    getInfo().then(({ store }) => {
        document.body.dataset.store = store;
        let contributeSubtitleId = "updates_contribute_subtitle";
        if (store === "edge")
            contributeSubtitleId = "updates_contribute_subtitle_generic";
        const contributeSubtitle = browser.i18n.getMessage(contributeSubtitleId);
        $("#contribute-subtitle").textContent = contributeSubtitle;
        category_doclinks_get(`${store}_review`).then((url) => {
            $("#contribute-rate a").href = url;
        });
    });
}
function load() {
    convertDoclinks();
    initI18n();
    initContribute();
    initUpdates();
    initVersion();
}
load();
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
/******/ 	let __webpack_exports__ = __webpack_require__(1735);
/******/ 	
/******/ })()
;
//# sourceMappingURL=updates.js.map