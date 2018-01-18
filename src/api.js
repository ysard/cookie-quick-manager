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

vAPI.get_all_cookies = function() {
    // Return a Promise with all cookies in all stores
    // TODO: handle multiple stores
    // Used by export.js on #clipboard_domain_export click event

    return new Promise((resolve, reject) => {
        // TODO: fix that :p
        var storeIds = ['firefox-default', 'firefox-private'];

        // Get 1 promise for each cookie store for each domain
        // Each promise stores all associated cookies
        var promises = [];
        for (let storeId of storeIds) {
            promises.push(browser.cookies.getAll({storeId: storeId}));
        }

        // Merge all promises
        Promise.all(promises).then((cookies_array) => {

            // Merge all results of promises
            let cookies = [];
            for (let cookie_subset of cookies_array) {
                cookies = cookies.concat(cookie_subset);
            }

            if (cookies.length > 0)
                resolve(cookies);
            else
                reject("NoCookies");
        });
    });
}

vAPI.delete_cookies = function(promise) {
    // Delete all cookies in the promise
    // Return a promise
    return new Promise((resolve, reject) => {

        promise.then((cookies) => {

            let promises = [];
            for (let cookie of cookies) {
                // Remove current cookie
                let params = {
                    url: vAPI.getHostUrl(cookie),
                    name: cookie.name,
                    storeId: cookie.storeId,
                };
                promises.push(browser.cookies.remove(params));
            }

            Promise.all(promises).then((cookies_array) => {
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
        var domain = document.querySelector('#domain-list li.active');
        //console.log($._data(domain, "events" ));
        // Get data of the first click event registered
        var click_event_data = $._data(domain, "events" ).click[0].data
        var id = click_event_data.id;
        var storeIds = click_event_data.storeIds;
        // TODO: simulate multiple domains
        var ids = [id, ];

        // Get 1 promise for each cookie store for each domain
        // Each promise stores all associated cookies
        var promises = [];
        for (let id of ids) {
            for (let storeId of storeIds) {
                promises.push(browser.cookies.getAll({domain: id, storeId: storeId}));
            }
        }

        // Merge all promises
        Promise.all(promises).then((cookies_array) => {

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
                        // If current domain is not found in ids => go to next cookie
                        if (ids.indexOf(cookie.domain) === -1)
                            continue;
                    }
                    // OK: send filtered cookies
                    filtered_cookies.push(cookie);
                }
                resolve(filtered_cookies);
            } else {
                reject("NoCookies");
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


})(this);