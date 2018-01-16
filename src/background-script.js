var protected_cookies_counter = 0;
var protected_cookies;

function getHostUrl(cookie) {
    // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
    // modify or delete it.
    var host_protocol = (cookie.secure) ? 'https://' : 'http://';
    return host_protocol + cookie.domain + cookie.path;
}

function onError(error) {
    // Function called when a save/remove function has failed by throwing an exception.
    console.log({"Error removing/saving cookie:": error});
}

function init_protected_cookies() {
    // Get & set options from storage
    // Init protected_cookies array in global context
    let settings = browser.storage.local.get("protected_cookies");
    settings.then((items) => {
        console.log({storage_data: items});
        let storage_data = {};

        // protected_cookies array
        // The array check is a workaround to fix previous bug e4e735f (an array instead of an object)
        if (items.protected_cookies !== undefined && !Array.isArray(items.protected_cookies))
            protected_cookies = items.protected_cookies;
        else
            storage_data['protected_cookies'] = {};

        // Init data structure
        settings = browser.storage.local.set(storage_data);
        settings.then(null, onError);
    });
}

/*********** Events ***********/
browser.cookies.onChanged.addListener(function(changeInfo) {
    /* Callback when the cookie store is updated
     * PS: not called when you try to overwrite the exact same cookie.
     *
     * Modification event:
     * Object { removed: true, cookie: Object, cause: "overwrite" }
     * Object { removed: false, cookie: Object, cause: "explicit" }
     *
     * Delete event:
     * Object {removed: true, cookie: Object, cause: "explicit" }
     *
     * if (changeInfo.removed && changeInfo.cause == "explicit") {
     *     // Reset 2 lists
     *     document.getElementById('domain-list').innerHTML = "";
     *     document.getElementById('cookie-list').innerHTML = "";
     *     // Repop first list
     *     getStores();
     *     // todo update details
     *     // ça vaut peut être pas le coup de réinitialiser les 2 listes tant qu'il y a encore
     *     // des éléments dans la seconde...
     *     // vérifier depuis changeInfo.cookie, le domaine et vérifier si ce domaine a encore des cookies.
     *     // si non, tout rafrachir, si oui on reclique dessus
     * }
     *
     *    if (changeInfo.removed && changeInfo.cause == "overwrite") {
     *        // Simulate click on domain
     *        $('#domain-list').find('li.active').click();
     *
     *    // send directly the id of the cookie overwritten
     *    // {id: domain, storeIds: domains[domain].storeIds}
     *    // Impossible de savoir si d'autres cookies font ref à un autre store
     *    // => obligé de simuler le clic
     *    //var event = {'data': {'id': changeInfo.cookie.domain}};
     *    //showCookiesList(event);
     *    }
     */
    //console.log(changeInfo);

    if (changeInfo.removed && changeInfo.cause == 'explicit') {

        // If the deleted cookie is not in protected_cookies array: do nothing
        if (protected_cookies[changeInfo.cookie.domain] === undefined ||
            protected_cookies[changeInfo.cookie.domain].indexOf(changeInfo.cookie.name) === -1)
            return;

        // Rebuild the cookie given by the event
        let params = {
            url: getHostUrl(changeInfo.cookie),
            name: changeInfo.cookie.name,
            value: changeInfo.cookie.value,
            path: changeInfo.cookie.path,
            httpOnly: changeInfo.cookie.httpOnly,
            secure: changeInfo.cookie.secure,
            storeId: changeInfo.cookie.storeId,
        };

        let promise = browser.cookies.set(params);
        promise.then((cookie) => {
            console.log({"Erasure protection: Cookie NOT deleted!:": cookie});
            // Increment counter of protected cookies on the toolbar icon
            protected_cookies_counter++;
            // TODO: 1 counter per tab ? or add clearer information.. Is this option useful ?
            //browser.browserAction.setBadgeText({text: String(protected_cookies_counter)});
        }, onError);
    }
});

browser.storage.onChanged.addListener(function (changes, area) {
    // Called when the local storage area is modified
    // Here: we handle only 'protected_cookies' key.
    // We do that here because we have to know if a cookie must be
    // protected or not from deletion when there is a deletion event.

    //console.log("Change in storage area: " + area);
    console.log(changes);
    if (changes['protected_cookies'] !== undefined)
        protected_cookies = changes.protected_cookies.newValue;

});

/*********** Global variables ***********/

init_protected_cookies();
// Set default color of the counter of protected cookies on the toolbar icon
browser.browserAction.setBadgeBackgroundColor({color: 'black'});