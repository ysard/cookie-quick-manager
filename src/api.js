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
            if (parseInt(version) >= 59) {
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
            let cookies = [];
            for (let cookie_subset of cookies_array) {
                cookies = cookies.concat(cookie_subset);
            }

            if (cookies.length > 0)
                resolve(cookies);
            else
                reject("all_cookies-NoCookies");
        })
    });
}

vAPI.get_stores = function() {
    // Set stores & vAPI.storeIds
    // Return a promise with stores
    // TODO make a function to acess to vAPI.storeIds as private attribute

    return new Promise((resolve, reject) => {

        browser.contextualIdentities.query({}).then((contexts) => {
            // contexts === false on Firefox < 57
            // on FF+=57 contexts doesn't contain default stores: firefox-private or firefox-default
            //console.log({CONTEXTS: contexts});

            // Init stores with default stores
            let stores = vAPI.default_stores;
            console.log({default_stores: vAPI.default_stores});

            // On FF+=57 add containers
            if (contexts !== false)
                stores = stores.concat(contexts);

            // Get only storeIds
            // TODO make a function to acess to this private attribute
            vAPI.storeIds = stores.map(function(store){
                return store.cookieStoreId;
            });
            console.log({Stores: stores});

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
        console.log('Test availability of firstPartyIsolate API');
        resolves(browser.privacy.websites.firstPartyIsolate.get({}));

    })
    .then((got) => {
        // First Party Isolation is supported (FF 58+=)
        console.log('firstPartyIsolate API IS available');
        // set FPI status to true or false
        vAPI.FPI = got.value;
        console.log({FPI_status: vAPI.FPI});
        return promise;

    }, (error) => {
        console.log('firstPartyIsolate API is NOT available');
        // set FPI status
        vAPI.FPI = undefined;
        console.log({FPI_status: vAPI.FPI});
        return promise;
    });
}

vAPI.delete_cookies = function(promise) {
    // Delete all cookies in the promise
    // Return a promise
    return new Promise((resolve, reject) => {

        vAPI.FPI_detection(promise).then((cookies) => {

            let promises = [];
            if ((vAPI.FPI === undefined) || (vAPI.FPI === false)) {
                // FPI not supported or disabled
                // Legacy method
                for (let cookie of cookies) {
                    // Remove current cookie
                    let params = {
                        url: vAPI.getHostUrl(cookie),
                        name: cookie.name,
                        storeId: cookie.storeId,
                    };
                    console.log({value: cookie.value, firstPartyDomain: cookie.firstPartyDomain});
                    promises.push(browser.cookies.remove(params));
                }

            } else {
                // FPI enabled
                // firstPartyDomain is mandatory
                for (let cookie of cookies) {
                    // Remove current cookie
                    let params = {
                        url: vAPI.getHostUrl(cookie),
                        name: cookie.name,
                        storeId: cookie.storeId,
                        firstPartyDomain: cookie.firstPartyDomain,
                    };
                    console.log({value: cookie.value, firstPartyDomain: cookie.firstPartyDomain});
                    promises.push(browser.cookies.remove(params));
                }
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
                console.log({"Removed": deleted_cookie});
            }
            // Ok => all cookies are deleted properly
            // Reactivate the interface
            resolve();
        }, vAPI.onError);
    });
}

vAPI.add_cookies = function(new_cookies_promises, protection_status) {
    // TODO cal it instead of duplicated code in export.js
    // Take a promise on new_cookies_promises

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
                console.log({"Added": added_cookie});
            }

            // Protect all cookies if asked in global settings
            if (protection_status)
                vAPI.set_cookie_protection(cookies_array, true);

            // Ok => all cookies are added properly
            // Reactivate the interface
            resolve();
        }, vAPI.onError);
    });
}

vAPI.getCookiesFromSelectedDomain = function() {
    // Return a Promise with cookies that belong to the selected domain;
    // Return also cookies for subdomains if the subdomain checkbox is checked.
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Promise
    // TODO: handle multiple domains
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
            // -> firstPartyDomain argument is available on Firefox 59+=
            // {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
            let version = browser_info.version.split('.')[0];

            var promises = [];
            if (parseInt(version) >= 59) {
                // Add firstPartyDomain argument to getAll() function
                for (let domain of domains) {
                    console.log({current_domain: domain});
                    for (let storeId of storeIds) {
                        promises.push(browser.cookies.getAll({domain: domain, storeId: storeId, firstPartyDomain: null})); //firstPartyDomain: "whatarecookies.com"}));
                    }
                }
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
            console.log({cookie_array: cookies_array});
            // Merge all results of promises
            let cookies = [];
            for (let cookie_subset of cookies_array) {
                cookies = cookies.concat(cookie_subset);
            }

            if (cookies.length > 0) {
                // Build filtered cookies list
                let filtered_cookies = [];
                let query_subdomains = $('#query-subdomains').is(':checked');
                for (let cookie of cookies) {
                    // Filter on exact domain (remove sub domains from the list)
                    if (!query_subdomains) {
                        // If current domain is not found in domains => go to next cookie
                        if (domains.indexOf(cookie.domain) === -1)
                            continue;
                    }
                    // OK: send filtered cookies
                    filtered_cookies.push(cookie);
                }
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

    let settings = browser.storage.local.get({
        protected_cookies: {},
    });
    settings.then((items) => {
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
                items.protected_cookies[domain] = items.protected_cookies[domain].filter(item => ![name,].includes(item));
            }
        }
        // Set new protected_cookies on storage area
        settings = browser.storage.local.set({"protected_cookies": items.protected_cookies});
        settings.then(null, (error) => {
            console.log({"Error during all protect:": error});
        });
    });
}

/*********** Global variables ***********/

vAPI.default_stores = [
    {
        name: "Default",
        icon: "circle",
        iconUrl: "",
        color: "black",
        colorCode: "#555555",
        cookieStoreId: "firefox-default",
    },
    {
        name: "Private",
        icon: "private-browsing",
        iconUrl: "icons/private-browsing.svg",
        color: "purple",
        colorCode: "#af51f5",
        cookieStoreId: "firefox-private",
    },
];

vAPI.storeIds = ['firefox-default', 'firefox-private'];

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
\t"This domain only": "{ISDOMAIN}",\n\
\t"This domain only raw": "{ISDOMAIN_RAW}",\n\
\t"Store raw": "{STORE_RAW}"\n\
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

})(this);