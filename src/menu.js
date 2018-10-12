/*
 *  Cookie Quick Manager: An addon to manage (view, search, create, edit,
 *  remove, backup, restore) cookies on Firefox.
 *  Copyright (C) 2017-2018 Ysard
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Home: https://github.com/ysard/cookie-quick-manager
 */
// IIFE - Immediately Invoked Function Expression
(function(mycode) {

    // The global arguments are passed as parameters
    mycode(window.vAPI, window, document);

}(function(vAPI, window, document) {

    // The arguments are now locally scoped
    document.addEventListener("DOMContentLoaded", function(event) {

        /*********** Events attached to UI elements ***********/

        document.addEventListener("click", (e) => {
            let id = e.target.id;

            if (id === "search_cookie_manager") {
                // Search cookies for a domain: Send current url
                let createData = {
                    type: "panel",
                    url: "cookies.html?parent_url=" + encodeURIComponent(current_tab.url),
                };
                createWindow(createData);
            }

            else if (id === "simple_cookie_manager") {
                // Just launch the addon: Send empty url
                let createData = {
                    type: "panel",
                    url: "cookies.html?parent_url=",
                };
                createWindow(createData);
            }

            else if (id === "delete_current_cookies") {
                // Delete all cookies for the current domain & store
                browser.runtime.getBrowserInfo().then((browser_info) => {
                    // TODO: reuse params from initialization: avoid getBrowserInfo() call
                    let params = {
                        url: current_tab.url,
                        storeId: current_tab.cookieStoreId,
                    }

                    // Detect Firefox version:
                    // -> firstPartyDomain argument is available on Firefox 59+=
                    // {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
                    let version = browser_info.version.split('.')[0];
                    if (parseInt(version) >= 59)
                        params['firstPartyDomain'] = null;

                    return vAPI.delete_cookies(browser.cookies.getAll(params));
                })
                .then((ret) => {
                    // Force the closing of the window
                    window.close();
                });
            }

            else if (id === "delete_current_localstorage") {
                // Purge LocalStore for the current domain
                // NOTE: subdomains will not be taken into account
                let prom = browser.browsingData.removeLocalStorage({hostnames: [(new URL(current_tab.url)).hostname, ]});
                prom.then((ret) => {
                    // Force the closing of the window
                    window.close();
                });
            }

            else if (id === "options") {
                // Open Options Page
                browser.runtime.openOptionsPage();
                // Force the closing of the window
                window.close();
            }

            e.preventDefault();
        });

        /*********** Initializations ***********/

        init_ui();

    }, false);

    /*********** Utils ***********/

    function getActiveTab() {
        //get active tab to run an callback function.
        //it sends to our callback an array of tab objects
        return browser.tabs.query({currentWindow: true, active: true});
    }

    function createWindow(createData) {
        // Get settings
        let get_settings = browser.storage.local.get(["addonSize", "open_in_new_tab"]);
        get_settings.then((items) => {

            // Open new tab
            if (items.open_in_new_tab !== undefined && items.open_in_new_tab === true) {
                let new_tab = browser.tabs.create({url: createData.url});
                new_tab.then(() => {
                    console.log("The tab has been created");
                });
                window.close();
                return;
            }

            // Open new window
            let height = vAPI.optimal_window_height;
            let width = vAPI.optimal_window_width;

            // If addonSize item is in storage and if previous sizes are too small
            // => force default values
            // 768 is the smallest width to avoid the break of the ui
            if (items.addonSize !== undefined && items.addonSize.width >= 768 && items.addonSize.height >= height) {
            height = items.addonSize.height;
            width = items.addonSize.width;
            }
            //console.log({h:height, w:width});
            //console.log({h:items.addonSize.height, w:items.addonSize.width});
            // TODO: why it is not ok on some computers with small resolution ?
            createData.width = width;
            createData.height = height;

            // Create window
            createData.url += "&type=window";
            let new_window = browser.windows.create(createData);
            new_window.then(() => {
                console.log("The panel has been created");
            });
        });
    }

    function set_translations() {
        // Set translations after the insertion of favicons and numbers of cookies/items
        // set_translations replace specific childNodes in a predefined position

        // Workaround used to speed-up the load of UI for non supported locales
        let supported_locales = ['fr', 'de'];
        if (supported_locales.includes(browser.i18n.getUILanguage())) {

            let i18nElements = document.querySelectorAll('[data-i18n-content]');

            i18nElements.forEach(function (i18nElement) {

                let i18nMessageName = i18nElement.getAttribute('data-i18n-content');
                i18nElement.childNodes[1].textContent = browser.i18n.getMessage(i18nMessageName);
            });
        }
    }

    function init_ui() {

        // Set the searched domain and its icon
        // Display the option to delete LocalStorage
        // Display the number of cookies and items in LocalStorage

        getActiveTab().then((tabs) => {
            // Set the global var with current tab
            current_tab = tabs[0];

            // Display a shortcut to search cookies for the current domain
            let a = document.querySelector('#search_cookie_manager');
            // Workaround for domains without favicon
            // no alt text to avoid the break of the ui
            let favIconUrl = (current_tab.favIconUrl === undefined) ? "icons/icon48.png" : current_tab.favIconUrl;
            let img = document.createElement("img");
            img.src = favIconUrl;
            img.className = 'favicon';
            let content = document.createTextNode((new URL(current_tab.url)).hostname);
            a.prepend(img);
            a.appendChild(content);

            // Display a shortcut to delete all cookies for the current domain & store
            // Display a shortcut to delete LocalStorage
            browser.runtime.getBrowserInfo().then((browser_info) => {
                let params = {
                    url: current_tab.url,
                    storeId: current_tab.cookieStoreId,
                }

                // Detect Firefox version:
                // {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
                let version = browser_info.version.split('.')[0];

                // -> firstPartyDomain argument is available on Firefox 59+=
                if (parseInt(version) >= 59)
                    params['firstPartyDomain'] = null;

                // -> LocalStorage is not available on Firefox 56
                if (parseInt(version) >= 57) {
                    // Display the shortcut
                    let a = document.querySelector('#delete_current_localstorage');
                    a.style['display'] = 'inline-block';

                    // Get the number of localstorage items
                    browser.tabs.executeScript({
                        code: "(function (){return localStorage.length;})();"
                    }).then((ret) => {
                        // Display the number of items
                        let content = document.createTextNode(" (" + ret[0] + ")");
                        a.appendChild(content);
                    }, (err) => {
                        console.log('init_ui: content script:', err);
                    });
                }

                return browser.cookies.getAll(params);
            })
            .then((cookies) => {
                // Display the number of cookies
                let a = document.querySelector('#delete_current_cookies');
                // text content is a child node, at the 4rd pos
                let content = document.createTextNode(" (" + cookies.length + ")");
                a.appendChild(content);
            })
            .then((ret) => {
                // Set translations after the insertion of favicons and numbers of cookies/items
                // set_translations replace specific childNodes in a predefined position
                set_translations();
            });
        });

    }

    /*********** Global variables ***********/

    var current_tab;

}));