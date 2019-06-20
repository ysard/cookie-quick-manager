/*
 *  Cookie Quick Manager: An addon to manage (view, search, create, edit,
 *  remove, backup, restore) cookies on Firefox.
 *  Copyright (C) 2017-2019 Ysard
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
'use strict';

(function(self) {

if ( self.vAPI === undefined ) {
    self.vAPI = {};
}

var vAPI = self.vAPI;

vAPI.onError = function(error) {
    // Function called when a save/remove function has failed by throwing an exception.
    console.log({"Error removing/saving cookie:": error});
}

vAPI.onSet = function(result) {
    if (result) {
        console.log("option set success");
    } else {
        console.log("option set failure");
    }
}

vAPI.getHostUrl = function(cookie) {
    // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
    // modify or delete it.
    var host_protocol = (cookie.secure) ? 'https://' : 'http://';
    return host_protocol + cookie.domain + cookie.path;
}

vAPI.getHostUrl_from_UI = function() {
    // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
    // modify or delete it.
    var host_protocol = ($('#issecure').is(':checked')) ? 'https://' : 'http://';
    return host_protocol + $('#domain').val() + $('#path').val();
}

vAPI.parse_search_query = function(search_query) {
    /* Parse search queries like:
     * 'domain1.com domain2.com :value:"value1" :name:"name1" :name:"name2" :value:"value2"'
     * Set these 3 values in VAPI:
     *      vAPI.query_domain = "domain1.com";
     *      vAPI.query_names = ["name1", "name2];
     *      vAPI.query_values = ["value1", "value2"];
     * PS: A space separator is not mandatory between expressions
     * PS: If multiple domains are present, for the moment we keep only the first one
     */

    function extract_terms(patterns) {
        // Return a list of clean terms entered by the user: ["name1",] or ["value1",]
        // Argument patterns is a list of matches: [":name:\"name1\"",] or [":value:\"value1\"",]
        if (!patterns)
            return [];
        let re = /"(.*)"/;
        let terms = [];
        for (let pattern of patterns)
            terms.push(pattern.match(re)[1]);
        // Remove empty strings from the list of terms
        return terms.filter(n => n);
    }

    function get_domains(name_patterns, value_patterns) {
        // Remove patterns from the query and return remaining domains
        if (name_patterns)
            for (let pattern of name_patterns)
                search_query = search_query.replace(pattern, '');

        if (value_patterns)
            for (let pattern of value_patterns)
                search_query = search_query.replace(pattern, '');

        // Remove empty strings from the residual query
        let domains = search_query.split(' ').filter(n => n);
        return (!domains.length) ? [''] : domains;
    }

    let name_patterns = search_query.match(/:name:"([^"]|\\")*"/g);
    //console.log("parse_search_query: name_patterns:", name_patterns);
    let names = extract_terms(name_patterns);
    //console.log("parse_search_query: names:", names);

    let value_patterns = search_query.match(/:value:"([^"]|\\")*"/g);
    //console.log("parse_search_query: value_patterns:", value_patterns);
    let values = extract_terms(value_patterns);
    //console.log("parse_search_query: values:", values);

    // Remove patterns from the query and get simple domains
    let domains = get_domains(name_patterns, value_patterns);
    //console.log("parse_search_query: domain: ", domains[0]);

    // Keep only the first domain for now
    vAPI.query_domain = domains[0];
    vAPI.query_names = names;
    vAPI.query_values = values;
}

vAPI.filter_cookies = function(promise) {
    /* Promise to filter cookies on their names and values
     * Return a cookie list satisfying the search conditions
     *
     * This promise is used with get_all_cookies()
     * and getCookiesFromSelectedDomain()
     *
     * This promise uses vAPI.query_names and vAPI.query_values set by vAPI.parse_search_query
     *
     * Multiple name filters are linked by OR operator.
     * Multiple value filters are linked by OR operator.
     * Groups of name filters are linked with groups of value filters by a AND operator.
     *
     * Ex: ("name1" OR "name2") AND ("value1", "value2")
     */

    // No filter => return the list of cookies unchanged
    if (!vAPI.query_names.length && !vAPI.query_values.length)
        return promise;

    return new Promise((resolve, reject) => {
        promise.then((cookies) => {

            //console.log("filter_cookies: cookie to filter", cookies.length);

            let filtered_cookies = [];
            let name_found = false;
            let value_found = false;
            for (let cookie of cookies) {

                for (let name of vAPI.query_names)
                    if (cookie.name.indexOf(name) !== -1)
                        // name is found => keep the cookie
                        name_found = true;

                for (let value of vAPI.query_values)
                    if (cookie.value.indexOf(value) !== -1)
                        // value is found => keep the cookie
                        value_found = true;

                if ((value_found && name_found) || (                 // value and name found in the same cookie
                        (value_found && !vAPI.query_names.length) || // value found with no queried name
                        (name_found && !vAPI.query_values.length)    // name found with no queried value
                    )
                ) {
                    //console.log("filter_cookies: kept:", cookie.domain, cookie.name, cookie.value);
                    filtered_cookies.push(cookie);
                }

                name_found = false;
                value_found = false;
            }
            resolve(filtered_cookies);
        })
        .catch(err => console.error(err));
    });
}

vAPI.get_all_cookies = function(storeIds) {
    // Return a Promise with all cookies in all stores
    // Handle multiple stores:
    // - by default ALL previously queried stores are used,
    // (if no store has been queried use only default & private stores);
    // - otherwise uses storeIds argument.
    // Used by export.js on #clipboard_domain_export click event

    return new Promise((resolve, reject) => {
        if ((storeIds === undefined) || (storeIds[0] === 'all'))
            storeIds = vAPI.storeIds;

        browser.runtime.getBrowserInfo().then(function(browser_info) {
            // Get 1 promise for each cookie store for each domain
            // Each promise stores all associated cookies

            // Detect Firefox version:
            // -> firstPartyDomain argument is available on Firefox 59+=
            // {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
            let version = browser_info.version.split('.')[0];

            let promises = [];
            if (parseInt(version, 10) >= 59) {
                // Add firstPartyDomain argument to getAll() function
                for (let storeId of storeIds) {
                    promises.push(browser.cookies.getAll({storeId: storeId, firstPartyDomain: null}));
                }
            } else {
                // Legacy getAll() function
                for (let storeId of storeIds) {
                    promises.push(browser.cookies.getAll({storeId: storeId}));
                }
            }
            // Merge all promises
            return Promise.all(promises);
        })
        .then((cookies_array) => {
            // Merge all results of promises
            let cookies = Array.prototype.concat(...cookies_array);

            if (cookies.length > 0) {

                // Filtering cookies
                // Filtering on domains
                // PS: this step is made before the filtering of names and values
                // because it is less complex and removes much more items
                let filtered_cookies = [];
                if (vAPI.query_domain == "") {
                    // vAPI.query_domain is empty:
                    // - get_all_cookies() is called from background script
                    // in case of deletion on boot
                    // - there is no searched domain
                    filtered_cookies = cookies;
                } else {
                    for (let cookie of cookies) {
                        // Do not display domains different than the searched one
                        if (cookie.domain.indexOf(vAPI.query_domain) === -1)
                            continue;

                        filtered_cookies.push(cookie);
                    }
                }
                //console.log("get_all_cookies: nb:", filtered_cookies.length);
                resolve(filtered_cookies);
            } else
                reject("all_cookies-NoCookies");
        })
        .catch(err => console.error(err));
    });
}

vAPI.get_stores = function() {
    // Set stores & vAPI.storeIds
    // Return a promise with stores
    // TODO make a function to acess to vAPI.storeIds as private attribute

    return new Promise((resolve, reject) => {

        browser.extension.isAllowedIncognitoAccess().then((allowed_incognito_access) => {
            //console.log("get_stores:: allowed incognito access?", allowed_incognito_access);
            //console.log({default_stores: vAPI.default_stores});

            if (!allowed_incognito_access) {
                // The extension is not allowed to access private windows
                // Keep only default context
                vAPI.storesAllowed = [vAPI.default_stores[0]];
            } else {
                // Keep all default contexts
                vAPI.storesAllowed = vAPI.default_stores;
            }

            // Query other contexts
            return browser.contextualIdentities.query({});
        })
        .then((contexts) => {
            // contexts === false on Firefox < 57
            // on FF57- contexts doesn't contain default stores: firefox-private or firefox-default
            //console.log({CONTEXTS: contexts});

            // Init stores with default stores
            let stores = vAPI.storesAllowed;
            //console.log({storesAllowed: vAPI.storesAllowed});

            if (contexts !== false) {
                // Replace 'resource://usercontext-content' prefix in the urls of the context icons
                // Due to unsolved bug https://bugzilla.mozilla.org/show_bug.cgi?id=1499000
                for (let context of contexts) {
                    context.iconUrl = context.iconUrl.replace(/resource:\/\/usercontext-content/, "icons");
                }
                //console.log("CONTEXTS iconUrl replaced", contexts);

                // On FF+=57 add containers from contexts
                stores = stores.concat(contexts);
            }

            // Get only storeIds
            // TODO make a function to acess to this private attribute
            vAPI.storeIds = stores.map(function(store){
                return store.cookieStoreId;
            });
            //console.log({Stores: stores});

            resolve(stores);

        }, (error) => {
            console.error(e);
        });
    });
}

vAPI.FPI_detection = function(promise) {
    // Set the attribute vAPI.FPI with the status of First Party Isolation
    // This promise is made to be chained before all promises that call
    // browser.cookies.* on browser that can support or not this new API.
    // vAPI.FPI is undefined if FPI is not supported by the browser,
    // or false/true if supported but disabled/enabled.

    return new Promise((resolves, rejects) => {
        // This promise will crash on FF 59-
        // The error is captured by the error callback.
        //console.log('Test availability of firstPartyIsolate API');
        resolves(browser.privacy.websites.firstPartyIsolate.get({}));

    })
    .then((got) => {
        // First Party Isolation is supported (FF 58+=)
        //console.log('firstPartyIsolate API IS available');
        // set FPI status to true or false
        vAPI.FPI = got.value;
        //console.log({FPI_status: vAPI.FPI});
        return promise;

    }, (error) => {
        //console.log('firstPartyIsolate API is NOT available');
        // set FPI status
        vAPI.FPI = undefined;
        //console.log({FPI_status: vAPI.FPI});
        return promise;
    });
}

vAPI.delete_cookies = function(promise) {
    // Delete all cookies in the promise
    // Return a promise
    // PS: there is no verification of the support of FPI here
    // because, the promise is already composed of cookies that
    // come from getAll() and have the firstPartyDomain property if it is activated.
    // This presence of this property gives the status of the FPI support.
    // The promise returns the number of remaining cookies (not deleted because
    // they are protected against deletion)
    // NOTE: This function does not try to delete protected cookie

    return new Promise((resolve, reject) => {

        // DO NOT delete protected cookies
        var protected_cookies;
        var number_of_given_cookies;

        browser.storage.local.get({
            protected_cookies: {},
        })
        .then((items) => {

            protected_cookies = items.protected_cookies;
            return promise;
        })
        .then((cookies) => {
            let promises = [];
            number_of_given_cookies = cookies.length;

            for (let cookie of cookies) {
                // DO NOT delete protected cookies
                if (cookie.domain in protected_cookies
                    && protected_cookies[cookie.domain].indexOf(cookie.name) !== -1)
                    continue;

                // Remove current cookie
                let params = {
                    url: vAPI.getHostUrl(cookie),
                    name: cookie.name,
                    storeId: cookie.storeId,
                };

                // Handle FPI property
                if (cookie.firstPartyDomain !== undefined)
                    params.firstPartyDomain = cookie.firstPartyDomain;

                //console.log({value: cookie.value, firstPartyDomain: cookie.firstPartyDomain});
                promises.push(browser.cookies.remove(params));
            }
            // Merge all promises
            return Promise.all(promises);
        })
        .then((cookies_array) => {
            // Iter on all results of promises
            for (let deleted_cookie of cookies_array) {

                // If null: no error but no suppression
                // => display button content in red
                if (deleted_cookie === null) {
                    console.log({"Not removed": deleted_cookie});
                    // => display button content in red
                    reject("No error but not removed");
                }
               // console.log({"Removed": deleted_cookie});
            }
            // Ok => all cookies are deleted properly
            // Reactivate the interface
            // Return the number of remaining cookies
            resolve(number_of_given_cookies - cookies_array.length);
        }, vAPI.onError);
    });
}

vAPI.copy_cookies_to_store = function(promise, store_id) {
    // Copy a set of cookies to the store with the given store_id
    // Return a promise

    return new Promise((resolve, reject) => {
        promise.then((cookies) => {

            let promises = [];
            for (let cookie of cookies) {
                // Build cookie
                let params = {
                    url: vAPI.getHostUrl(cookie),
                    name: cookie.name,
                    value: cookie.value,
                    path: cookie.path,
                    httpOnly: cookie.httpOnly,
                    secure: cookie.secure,
                    storeId: store_id,
                };

                // Handle optional sameSite flag if supported
                if (cookie.sameSite != null)
                    params['sameSite'] = cookie.sameSite;

                // Session cookie has no expiration date
                if (!cookie.session) {
                    // Refuse expired cookies
                    if (cookie.expirationDate <= ((Date.now() / 1000|0) + 1))
                        continue;
                    params['expirationDate'] = cookie.expirationDate;
                }

                // Handle FPI property
                if (cookie.firstPartyDomain !== undefined)
                    params.firstPartyDomain = cookie.firstPartyDomain;

                promises.push(browser.cookies.set(params));
            }
            // Merge all promises
            return vAPI.add_cookies(Promise.all(promises));
        })
        .then((ret) => {
            // PS: when add_cookies raises an error, it handles itself this error,
            // so we can end up here right after.
            console.log("copy_cookies_to_store has ended");
            resolve();
        }, vAPI.onError);
    });
}

vAPI.add_cookies = function(new_cookies_promises, protection_status) {
    // Add given cookies to the cookie store
    // Used in export.js and api.js
    // Take a promise on new_cookies_promises
    // Return a promise

    if (protection_status === undefined)
        protection_status = false;

    return new Promise((resolve, reject) => {

        new_cookies_promises.then((cookies_array) => {
            // Iter on all results of promises
            for (let added_cookie of cookies_array) {

                // If null: no error but no save
                if (added_cookie === null) {
                    console.log({"Not added": added_cookie});
                    reject("Cookie " + JSON.stringify(added_cookie) + " can't be saved");
                }
                //console.log({"Added": added_cookie});
            }

            // Protect all cookies if asked in global settings
            if (protection_status)
                return vAPI.set_cookie_protection(cookies_array, true);

        }, (error) => {
            // Handle errors from browser.cookies.set promises
            // Ex: errors due to access to the private cookies storeId
            vAPI.onError(error);
            reject(JSON.stringify(error.message));

        }).then(() => {
            // Ok => all cookies are added/protected properly
            // Reactivate the interface
            resolve();
        }, (error) => {
            // Errors while adding the cookies,
            // or while the protection of cookies.
            // TODO: make a proper message
            reject(JSON.stringify(error));
        });
    });
}

vAPI.getCookiesFromSelectedDomain = function() {
    // Return a Promise with cookies that belong to the selected domain;
    // Return also cookies for subdomains if the subdomain checkbox is checked.
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Promise
    // TODO: handle multiple domains
    // TODO: pas d'accès à l'interface ici...
    // => la fonction doit prendre directement la liste des domaines, les stores, l'état de query-subdomains
    // Used by export.js on #clipboard_domain_export click event

    return new Promise((resolve, reject) => {

        // Workaround to get click event data of the selected domain
        // Get pure HTML document (not a JQuery one)
        var domain_obj = document.querySelector('#domain-list li.active');
        //console.log($._data(domain, "events" ));
        // Get data of the first click event registered
        var click_event_data = $._data(domain_obj, "events" ).click[0].data
        var domain = click_event_data.id;
        var storeIds = click_event_data.storeIds;
        // TODO: simulate multiple domains
        var domains = [domain, ];


        browser.runtime.getBrowserInfo().then(function(browser_info) {
            // Get 1 promise for each cookie store for each domain
            // Each promise stores all associated cookies

            // Detect Firefox version:
            // Ex: {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
            // -> firstPartyDomain argument is available on Firefox 59+=
            // -> browser.cookies.getAll() can't be queried on Firefox 59+=
            // with firstPartyDomain argument AND domain argument...
            // So for users that need to edit FPI cookies, we simply return all domains
            // filtered by forcing the checkbox query-subdomains to be unchecked.
            // (if it is checked, we can't filter all the domains...)
            // See https://bugzilla.mozilla.org/show_bug.cgi?id=1465063
            let version = parseInt(browser_info.version.split('.')[0], 10);

            var promises = [];
            if (version >= 62) {
                // Add firstPartyDomain argument to getAll() function
                for (let domain of domains) {
                    //console.log("getCookiesFromSelectedDomain: domain:", domain);
                    for (let storeId of storeIds) {
                        promises.push(browser.cookies.getAll({domain: domain, storeId: storeId, firstPartyDomain: null}));
                    }
                }
            } else if ((version >= 59) && (version < 62)) {
                // See explanations above.
                // Force unchecked status, remove the checkbox from the UI...
                let $query_subdomains_checkbox = $('#query-subdomains');
                $query_subdomains_checkbox.prop('checked', false);
                $query_subdomains_checkbox.parent().hide();

                // Return all cookies from the stores. domains will be filtered in the next step below
                return vAPI.get_all_cookies(storeIds);
            } else {
                // Legacy getAll() function
                for (let domain of domains) {
                    for (let storeId of storeIds) {
                        promises.push(browser.cookies.getAll({domain: domain, storeId: storeId}));
                    }
                }
            }
            // Merge all promises
            return Promise.all(promises);
        })
        .then((cookies_array) => {
            // Merge all results of promises
            let cookies = Array.prototype.concat(...cookies_array);

            if (cookies.length > 0) {

                // Filtering cookies
                // Filtering on domains
                // PS: this step is made before the filtering of names and values
                // because it is less complex and removes much more items
                let filtered_cookies = [];
                let query_subdomains = $('#query-subdomains').is(':checked');
                if (query_subdomains) {
                    filtered_cookies = cookies;
                } else {
                    // Sub domains are not wanted here
                    for (let cookie of cookies) {
                        // Filter on exact domain (remove sub domains from the list)
                        // If current domain is not found in domains => go to next cookie
                        if (domains.indexOf(cookie.domain) !== -1)
                            filtered_cookies.push(cookie);
                    }
                }
                //console.log("getCookiesFromSelectedDomain: nb", filtered_cookies.length);
                resolve(filtered_cookies);
            } else {
                reject("SelectedDomain-NoCookies");
            }
        });
    });
}

vAPI.set_cookie_protection = function(cookies, protect_flag) {
    // Iterate on all new cookies and add their domains and names to the
    // array of protected_cookies in local storage.
    // protect_flag: false: unprotect the cookies; true: protect the cookies
    // TODO: make a global promise shared with cookies.js (#protect_button.click) to check
    // the presence of a domain in protected_cookies

    return new Promise((resolve, reject) => {

        browser.storage.local.get({
            protected_cookies: {},
        })
        .then((items) => {
            for (let cookie of cookies) {
                //console.log(cookie);

                // Check domain
                let domain = cookie.domain;
                if (!(domain in items.protected_cookies)) {
                    if (protect_flag)
                        // Absent: we want to protect it: init domain
                        items.protected_cookies[domain] = [];
                    else
                        // Absent we want to unprotect: do nothing
                        continue;
                }

                // Check name
                let name = cookie.name;
                if (protect_flag && items.protected_cookies[domain].indexOf(name) === -1) {
                    // This cookie will be protected
                    console.log({'protect: add': name});
                    items.protected_cookies[domain].push(name);
                    continue;
                }

                if ((!protect_flag) && (items.protected_cookies[domain].indexOf(name) !== -1)) {
                    // This cookie will not be protected anymore
                    console.log({'protect: rm': name});
                    // Remove the current cookie name from list if it is already present
                    items.protected_cookies[domain] = items.protected_cookies[domain].filter(present_name => {
                        // To delete the cookie name, we have to return false if name == present_name
                        // So, return true if name != present_name
                        return name != present_name;
                    });
                }
            }

            // Clean empty domains => better privacy
            let cleaned_protected_cookies = {};
            for (let i in items.protected_cookies) {
                if (items.protected_cookies[i].length != 0) {
                    cleaned_protected_cookies[i] = items.protected_cookies[i];
                }
            }

            // Set new protected_cookies on storage area
            return browser.storage.local.set({"protected_cookies": cleaned_protected_cookies});
        })
        .then(() => {
            resolve();

        }, (error) => {
            console.log({"Error during protection:": error, "Protection flag:": protect_flag});
            reject({"Error during protection:": error, "Protection flag:": protect_flag});
        });
    });
}

vAPI.setFirstPartyIsolateStatus = function(status) {
    // Set firstPartyIsolate status

    var getting = browser.privacy.websites.firstPartyIsolate.get({});
    getting.then((got) => {
        //console.log({'got': got});

        if ((got.levelOfControl === "controlled_by_this_extension") ||
            (got.levelOfControl === "controllable_by_this_extension")) {

            // Set the status
            var setting = browser.privacy.websites.firstPartyIsolate.set({
                value: status
            });
            setting.then(vAPI.onSet);

        } else {
            console.log("Not able to set firstPartyIsolate");
        }
    });
}

vAPI.get_and_patch_protected_cookies = function(storage_items) {
    // Wrapper used to patch the storage data key 'protected_cookies'
    // Return the associative array of protected_cookies.
    // Return an empty associative array if something happened

    // The array check is a workaround to fix previous bug e4e735f (an array instead of an object)
    if (!Array.isArray(storage_items.protected_cookies))
        return storage_items.protected_cookies;
    else {
        // protected_cookies is an Array
        // Init data structure
        let set_settings = browser.storage.local.set({"protected_cookies": {}});
        set_settings.then(null, onError);
        return {};
    }
}

vAPI.get_session_cookies = function(cookies) {
    // Return only session cookies from an array of cookies

    let session_cookies = [];
    for (let cookie of cookies) {
        if (cookie.session)
            session_cookies.push(cookie);
    }
    console.log("get_session_cookies:", session_cookies.length);
    return session_cookies;
}

vAPI.ask_permission = function(permission_name) {
    // Ask the given permission to the browser
    // PS: Due to restrictions, this function must be called from a user input handler
    browser.permissions.request({permissions: [permission_name]})
    .then((response) => {
        console.log("ask_permission:", permission_name, response);
    })
    .catch(err => console.error(err));
}

vAPI.remove_permission = function(permission_name) {
    // Remove a permission
    browser.permissions.remove({permissions: [permission_name]})
    .catch(err => console.error(err));
}

/*********** Global variables ***********/

// Private attribute, see vAPI.storesAllowed
vAPI.default_stores = [
    {
        name: browser.i18n.getMessage("container_default"),
        icon: "circle",
        iconUrl: "",
        color: "black",
        colorCode: "#555555",
        cookieStoreId: "firefox-default",
    },
    {
        name: browser.i18n.getMessage("container_private"),
        icon: "private-browsing",
        iconUrl: "icons/private-browsing.svg",
        color: "purple",
        colorCode: "#af51f5",
        cookieStoreId: "firefox-private",
    },
];

// vAPI.default_stores without firefox-private if the extension is not allowed to access private windows
// This attribute is "public" and should be used instead of vAPI.default_stores
vAPI.storesAllowed = [];
vAPI.storeIds = []; //Ex: ['firefox-default', 'firefox-private', ...];

vAPI.template_JSON = {
    name: 'JSON',
    template: '{\n\
\t"Host raw": "{HOST_RAW}",\n\
\t"Name raw": "{NAME_RAW}",\n\
\t"Path raw": "{PATH_RAW}",\n\
\t"Content raw": "{CONTENT_RAW}",\n\
\t"Expires": "{EXPIRES}",\n\
\t"Expires raw": "{EXPIRES_RAW}",\n\
\t"Send for": "{ISSECURE}",\n\
\t"Send for raw": "{ISSECURE_RAW}",\n\
\t"HTTP only raw": "{ISHTTPONLY_RAW}",\n\
\t"SameSite raw": "{SAMESITE_RAW}",\n\
\t"This domain only": "{ISDOMAIN}",\n\
\t"This domain only raw": "{ISDOMAIN_RAW}",\n\
\t"Store raw": "{STORE_RAW}",\n\
\t"First Party Domain": "{FPI_RAW}"\n\
}',
    left_tag: '[',
    right_tag: ']',
    separator: ',\n',
};

vAPI.template_Netscape = {
    name: 'NETSCAPE',
    template: '{DOMAIN_RAW}\t{ISDOMAIN_RAW}\t{PATH_RAW}\t{ISSECURE_RAW}\t{EXPIRES_RAW}\t{NAME_RAW}\t{CONTENT_RAW}',
    left_tag: '',
    right_tag: '',
    separator: '\n',
};

vAPI.templates = {
    JSON: vAPI.template_JSON,
    NETSCAPE: vAPI.template_Netscape,
};

// Global date format
// PS: "DD-MM-YYYY hh:mm:ss a"), 'a' is for am/pm
vAPI.date_format = "DD-MM-YYYY HH:mm:ss";

// Optimal size of the windowed addon
vAPI.optimal_window_width = 1095;
vAPI.optimal_window_height = 640;

vAPI.query_domain = "";
vAPI.query_names;
vAPI.query_values;

})(this);