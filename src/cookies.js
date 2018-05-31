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

    // The global jQuery object is passed as a parameter
    mycode(window.jQuery, window.vAPI, window, document);

}(function($, vAPI, window, document) {

    // The $ is now locally scoped
    $(function () {

/*********** Events attached to UI elements ***********/
// Search box: handle keyboard inputs
$('#search_domain').on('input', actualizeDomains);
$('#search_domain').keypress(function(e) {
    // Enter key pressed
    if(e.which == 13)
        actualizeDomains();
});
// Search box: handle button pressed
$('#search_domain_submit').click(actualizeDomains);
// Query subdomains status: handle check
$('#query-subdomains').click(actualizeDomains);
// Actualize button pressed
$("#actualize_button").click(function() {
    // Copy of actualizeDomains() but call getStores() instead of showDomains()
    // It is the unique function that actualize stores
    $('#domain-list').empty();
    $('#cookie-list').empty();
    reset_cookie_details();
    getStores();
});

$( "#save_button" ).click(function() {
    /* Save a cookie displayed on details zone
     * ---
     * NOTE: If the expirationDate is set in the past and the cookie was not expired,
     * it will be automatically deleted.
     * If the cookie is already expired, there is no suppression and no update (no changed event emitted)
     * ---
     *
     * Leading dot:
     * The leading dot means that the cookie is valid for subdomains as well; nevertheless recent HTTP
     * specifications (RFC 6265) changed this rule so modern browsers should not care about the leading dot.
     * The dot may be needed by old browser implementing the deprecated RFC 2109.
     *
     * isSecure:
     * The Secure attribute limits the scope of the cookie to "secure" channels (where "secure" is
     * defined by the user agent). When a cookie has the Secure attribute, the user agent will include
     * the cookie in an HTTP request only if the request is transmitted over a secure channel (typically
     * HTTP over Transport Layer Security (TLS) [RFC2818]).
     *
     * Although seemingly useful for protecting cookies from active network attackers, the Secure
     * attribute protects only the cookie's confidentiality. An active network attacker can overwrite
     * Secure cookies from an insecure channel, disrupting their integrity (see Section 8.6 for more details).
     *
     * https://stackoverflow.com/questions/9618217/what-does-the-dot-prefix-in-the-cookie-domain-mean
     * https://www.mxsasha.eu/blog/2014/03/04/definitive-guide-to-cookie-domains/
     */
    var params = {
        url: vAPI.getHostUrl_from_UI(),
        name: $('#name').val(),
        value: $('#value').val(),
        path: $('#path').val(),
        httpOnly: $('#httponly').is(':checked'),
        secure: $('#issecure').is(':checked'),
        storeId: $('#store').val(),
    };
    // If there is no leading dot => the cookie becomes a host-only cookie.
    // To make a host-only cookie, we must omit the domain
    // To make a subdomain cookie, we must specify the domain
    // check that: we take the url which is based on the domain.
    // so if we omit the domain, the url is used to rebuild the domain internally
    // BUT if we give a url with http://.website.com
    // the leading dot makes this cookie a subdomain cookie
    // if we give a url with http://www.website.com
    // no leading dot makes a host-only cookie
    // SO we don't have to consider anymore the presence/absence of the domain
    // in the set query...
    /* PS:
     * foo.com => host-only
     * .foo.com => subdomains
     * www.foo.com => host-only
     */
    // Set expiration date if cookie is not a session cookie
    if (!$('#issession').is(':checked')) {
        var unix_timestamp = $('#expiration_date').data("DateTimePicker").date().unix();
        params['expirationDate'] = unix_timestamp;
        console.log(new Date(unix_timestamp * 1000));
    }
    // Set cookie
    console.log(params);
    var promise = browser.cookies.set(params);

    promise.then((cookie) => {
        // Reactivate the interface
        console.log({"Cookie saved: ": cookie});

        // If null: no error but no save
        // => display button content in red
        if (cookie === null) {
            $("#save_button span").addClass("button-error");
        } else {
            // Supress red color, disable & reset text editing for the next cookie
            // Simulate click on the same domain
            $("#save_button span").removeClass("button-error");
            disable_cookie_details();
            reset_cookie_details();
            $('#domain-list').find('li.active').click();
        }
    }, onError);
});

$("#edit_button").click(function() {
    // When edit button is pressed, a class "down" is added.
    // First press: allow editing of text fields other than value, and allow expiration date modifying
    // Second press: disallow ...
    if ($(this).hasClass("down")) {
        disable_cookie_details();
    } else {
        enable_cookie_details();
    }
    $(this).toggleClass("down");
});

$("#delete_button").click(function() {
    /* Remove a cookie displayed on details zone
     * NOTE: Remove inexistant cookie: Removed: null
     */
    delete_current_cookie();
});

$("#protect_button").click(function() {
    // Update the protect status of the current cookie
    //let settings = browser.storage.local.get("protected_cookies");
    //settings.then((items) => {

        // Do nothing if no cookie is selected
        let domain = $("#domain").val();
        let name = $('#name').val();
        if (name == '')
            return;

        let button_icon = $("#protect_button span");

        // Check domain
        if (!(domain in protected_cookies))
            protected_cookies[domain] = [];
        // Check name
        if (protected_cookies[domain].indexOf(name) === -1) {
            // This cookie will be protected
            console.log({'protect: add': name});
            protected_cookies[domain].push(name);

            button_icon.removeClass("glyphicon-lock");
            button_icon.addClass("glyphicon-unlock");
        } else {
            // This cookie will not be protected anymore
            console.log({'protect: rm': name});
            protected_cookies[domain] = protected_cookies[domain].filter(item => ![name,].includes(item));

            button_icon.removeClass("glyphicon-unlock");
            button_icon.addClass("glyphicon-lock");
        }
        //console.log(protected_cookies);
        // Set new protected_cookies on storage area
        let set_settings = browser.storage.local.set({"protected_cookies": protected_cookies});
        set_settings.then((ret) => {
            // Simulate click on domain
            $('#domain-list').find('li.active').click();
        }, onError);
    //});
});

$("#delete_domain_button").click(function() {
    // Remove each cookie for the selected domain
    var promise = vAPI.getCookiesFromSelectedDomain();
    delete_cookies(promise, "#delete_domain_button span");
});

$("#delete_all_button").click(function() {
    // Remove all cookies
    var promise = vAPI.get_all_cookies([$('#search_store').val()]);
    delete_cookies(promise, "#delete_all_button span");
});

$("#toggle_b64").click(function() {
    // When edit button is pressed, a class "down" is added.
    // First press: allow editing of text fields other than value, and allow expiration date modifying
    // Second press: disallow ...
    // NOTE: When the decoding/encoding is not possible,
    // this function is stopped without modifying the UI.
    var $value = $("#value");

    // Useful functions to encode/decode in base64
    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    function b64EncodeUnicode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode(parseInt(p1, 16))
        }))
    }

    function b64DecodeUnicode(str) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
    }

    if ($(this).hasClass("down")) {
        // second click => encode
        $value.val(b64EncodeUnicode($value.val()));
    } else {
        // first click => decode
        $value.val(b64DecodeUnicode($value.val()));
    }
    // Toggle .down class
    $(this).toggleClass("down");
});

$("#toggle_url").click(function() {
    // When edit button is pressed, a class "down" is added.
    // First press: allow editing of text fields other than value, and allow expiration date modifying
    // Second press: disallow ...
    var $value = $("#value");

    if ($(this).hasClass("down")) {
        // second click => encode
        $value.val(encodeURIComponent($value.val()));
    } else {
        // first click => decode
        $value.val(decodeURIComponent($value.val()));
    }
    // Toggle .down class
    $(this).toggleClass("down");
});

$(document).keydown(function(event){
    let key = event.which;

    // Delete current cookie with suppr.
    if (key == 46) {
        delete_current_cookie();
        return;
    }

    /*************************************************************************/
    // Change selected list with Ctrl + left or Ctrl + right
    if (event.ctrlKey) {
        if (key == 37) // left
            $current_selected_list = $('#domain-list');
        else if (key == 39) // right
            $current_selected_list = $('#cookie-list');

        else if (key == 70) { // F => search
            $('#search_domain').select();
            // Avoid to display the search box of the browser
            event.preventDefault();
        }
        return;
    }

    /*************************************************************************/
    // Up & down key pressed
    // Make a loop on all items of the list.
    // When the end is reached, the next selected item is then the first of the list.
    if (key != 40 && key != 38)
        return;

    // Init default selected list => done in main namespace
    /*if ($current_selected_list === undefined)
        $current_selected_list = $('#domain-list');
     */

    // Focus on items in the current list
    let $listItems = $current_selected_list.find('li');
    let $selected = $listItems.filter('.active');
    let $current;
    $listItems.removeClass('selected');

    if ( key == 40 ) // Down key
    {
        console.log($selected.length);
        if ( ! $selected.length || $selected.is(':last-child') ) {
            $current = $listItems.eq(0);
        }
        else {
            $current = $selected.next();
        }
    }
    else if ( key == 38 ) // Up key
    {
        if ( ! $selected.length || $selected.is(':first-child') ) {
            $current = $listItems.last();
        }
        else {
            $current = $selected.prev();
        }
    }
    adjust_scrollbar($current);

    // Simulate click on current item (domain or cookie)
    $current.click();
    event.preventDefault();
});

$('input[type=checkbox][name=issession]').change(function() {
    // Hide/Show datetimepicker according to the session checkbox state
    if(!$(this).is(':checked')) {
        // Not session => show
        $('#expiration_date').closest('.form-group').show();
    } else {
        // Session => hide
        $('#expiration_date').closest('.form-group').hide();
    }
});

$('#search_store').change(function() {
    // Filter domains on selected store
    actualizeDomains();
});

$('#expiration_date').on("dp.change", function(event) {
    // Emited by DateTimePicker when date(newDate) is called, and when input field is edited
    if (isExpired(event.date.unix())) {
        $('#expiration_date input').addClass("cookie-expired");
    } else {
        $('#expiration_date input').removeClass("cookie-expired");
    }
});

$('#button_optimal_size').click(function() {
    // Optimal size on click
    browser.windows.getCurrent().then((currentWindow) => {
        var updateInfo = {
            width: 1095,
            height: 531,
        };
        console.log(updateInfo);
        browser.windows.update(currentWindow.id, updateInfo);
    });
});

$("#protect_all_button").click(function() {
    // Build 1 json template for each cookie in all stores
    let promise = vAPI.get_all_cookies([$('#search_store').val()]);
    promise.then((cookies) => {
        vAPI.set_cookie_protection(cookies, true);
        // Update the UI
        // why we don't just click on the current domain ?
        // Because Firefox 57 is too fast for the asynchronous api
        // to update the list of protected cookies before clicking.
        let button_icon = $("#protect_button span");
        button_icon.removeClass("glyphicon-lock");
        button_icon.addClass("glyphicon-unlock");
    });
});

$("#unprotect_all_button").click(function() {
    // Build 1 json template for each cookie in all stores
    let promise = vAPI.get_all_cookies([$('#search_store').val()]);
    promise.then((cookies) => {
        vAPI.set_cookie_protection(cookies, false);
        // Update the UI
        // why we don't just click on the current domain ?
        // Because Firefox 57 is too fast for the asynchronous api
        // to update the list of protected cookies before clicking.
        let button_icon = $("#protect_button span");
        button_icon.removeClass("glyphicon-unlock");
        button_icon.addClass("glyphicon-lock");
    });
});

$('#button_options_page').click(function() {
    // Open Options Page
    browser.runtime.openOptionsPage();
});

window.onresize = function(event) {
    // Set the current size in local storage
    // This value is compared when the user clicks on the toolbar menu

    // If opened in tab: do nothing
    if (addon_window_type != 'window')
        return;

    addonSize = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    /*
     *  // minus the width of the scrollbar:
     *  width = $(window).width();
     *  height = $(window).height();
     */
    //console.log(addonSize);
    let set_settings = browser.storage.local.set({addonSize});
    set_settings.then(null, (error) => {
        console.log(`Error_resizing: ${error}`);
    });
};

browser.storage.onChanged.addListener(function (changes, area) {
    // Called when the local storage area is modified
    // Here: we handle only 'protected_cookies' key.
    // We do that here because when a user imports a json file,
    // if the global option import_protected_cookies is true, modifications
    // are made in protected_cookies array.

    //console.log("Change in storage area: " + area);
    console.log(changes);
    // Reload protected_cookies
    if (changes['protected_cookies'] !== undefined)
        protected_cookies = changes.protected_cookies.newValue;

    // Load/remove css skin
    if (changes['skin'] !== undefined) {
        update_skin(changes.skin.newValue);
    }
});

/*********** Initializations ***********/

// Init datetimepicker object
$('#expiration_date').datetimepicker({
    format: vAPI.date_format,
    defaultDate: moment(new Date(), vAPI.date_format),
    useCurrent: false, // Set to current date
    showClear: true // Trash button
});

// Enable popovers
$('[data-toggle="popover"]').popover();

// Enable tooltips
$('[data-toggle="tooltip"]').tooltip({placement: "right", trigger: "hover"});

firefox57_workaround_for_blank_panel();

// Set default domain in search box
setDefaultDomain();

// Init protected_cookies array in global context and load options from storage
get_options();

// Fill the domains list
getStores();

});

/*********** Utils ***********/
function firefox57_workaround_for_blank_panel() {
    // browser.windows.create() displays blank windows (panel, popup or detached_panel)
    // The trick to display content is to resize the window...

    // Get parameter from full url
    // If addon is opened in a new tab, there is no issue on FF57+
    var current_addon_url = new URL(window.location.href);
    addon_window_type = current_addon_url.searchParams.get('type');
    if (addon_window_type != 'window') {
        $('#button_optimal_size').toggle();
        return;
    }

    browser.windows.getCurrent().then((currentWindow) => {
        var updateInfo = {
            width: window.innerWidth,
            height: window.innerHeight + 2, // 2 pixel more than original size...
        };
        browser.windows.update(currentWindow.id, updateInfo);
    });
}

function adjust_scrollbar($current) {
    // Set the scrollbar position when the user uses up/down keys to scroll from keyboard
    // => avoid to select an element which is hidden due to overflow
    /* The magic of JavaScript...
     * Don't ask me how it works...
     * magic 7: the height of the current li has to be incremented by padding (3px) and borders (1px)
     * since there is a bottom margin of -1px => 7px
     */
    /*
     c onsole.log({scroll: $current_selected_list.scro*llTop()});
    console.log({scroll_height: $current_selected_list.prop('scrollHeight')});
    console.log({clientHeight: $current_selected_list.prop('clientHeight')});
    console.log({curr_top: $current.position().top});
    console.log({curr_height: $current.height()});
    console.log({hauteur_tot: $current_selected_list.height()});
    */
    // Get the current position of scrollbar in pixels
    let scrollpos = $current_selected_list.scrollTop();
    // Get the maximum number of pixels by which the contents of the document can be scrolled vertically.
    // The returned value is the difference between the total (scrollHeight)
    // and the visible (clientHeight) height of the contents.
    // scrollHeight: height of an element's content, including content not visible on the screen due to overflow.
    // http://help.dottoro.com/ljhafjja.php
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
    let max_scrollpos = $current_selected_list.prop('scrollHeight') - $current_selected_list.prop('clientHeight');
    let new_scrollpos;
    // Move down
    if ($current.position().top + $current.height() >= $current_selected_list.height()) {
        if (scrollpos == 0 && $current.position().top > $current_selected_list.height()) {
            // The cursor is on the first element and the user presses up another time
            // Set scrolltop to maximum
            new_scrollpos = max_scrollpos;
            console.log({DOWN_another_time: $current.position().top});
        }
        else
            // Increment scrolltop since the previous element is already near to be hidden
            new_scrollpos = scrollpos + $current.height() + 7;

        // Move up
    } else if ($current.position().top - $current.height() - 7 <= 0) {
        // scrolltop is at the maximum and the current element is
        if ($current.position().top + 7 <= 0 && scrollpos == max_scrollpos) {
            // The cursor is on the last element and the user presses down another time
            // Set scrolltop to 0
            new_scrollpos = 0;
            console.log({UP_another_time: $current.position().top});
        } else {
            // Decrement the scrolltop => go to the value 0,
            // with the current element near to the top
            new_scrollpos = scrollpos - ($current.height() + 7);
            console.log({up_decr: $current.position().top});
        }
    }
    $current_selected_list.scrollTop(new_scrollpos);
}

function uniqueDomains(cookies) {
    /* Return a dict with domains as keys and storeIds and number of cookies for that domain.
     */
    var domains = {};
    for (let cookie of cookies) {
        if (cookie.domain in domains) {
            domains[cookie.domain]['number']++;
            if (domains[cookie.domain]['storeIds'].indexOf(cookie.storeId) === -1) {
                domains[cookie.domain]['storeIds'].push(cookie.storeId);
            }
        } else {
            // First time we see the domain
            domains[cookie.domain] = {'number': 1};
            domains[cookie.domain]['storeIds'] = [cookie.storeId];
        }
    }
    return domains;
}

function filter_master_domains(domains) {
    // Return a dict only with domains that are on top of other subdomains

    let unique_domains = Object.keys(domains);
    let non_master_domains = [];
    unique_domains.forEach(function(domain){
        unique_domains.forEach(function(other_domain){
            if (domain == other_domain)
                return;
            // recherche des domaines ne contenant pas d'autres domaines
            if (domain.indexOf(other_domain) !== -1) {
                // other_domain trouvé dans domain => domain n'est pas un master
                // ex: github.com trouvé dans .github.com => .github.com n'est pas master
                // On ajoute donc les données de .github.com à github.com
                //console.log({found: other_domain, in_: domain});
                non_master_domains.push(domain);
                domains[other_domain].number += domains[domain].number;
            }
        });
    });

    // Remove non master domains from unique domains
    unique_domains = unique_domains.filter(function(el) {
        return !non_master_domains.includes(el);
    });
    //console.log({not_master: non_master_domains});
    //console.log({master: unique_domains});

    // Rebuild filtered domains
    let full_master_domains = {};
    for (let domain of unique_domains) {
        full_master_domains[domain] = domains[domain];
    }
    return full_master_domains;
}

function showStores(stores) {
    // Display stores with their icon on the select menu
    // Reset previous data

    function update_select_form(element_id) {
        let $obj = $(element_id);
        $obj.html('');

        if (element_id === '#search_store') {
            // Prepend stores with 'all' option for the search filter
            // WARNING: do not call unshift method here. stores is not readonly
            // and is repercuted to vAPI.default_stores (when contexts == false)...
            stores = [{
                name: "All",
                icon: "circle",
                iconUrl: "",
                color: "black",
                colorCode: "#555555",
                cookieStoreId: "all",
            }].concat(stores);
        }

        for (let store of stores) {
            // Build text & icon for each store
            //console.log(store);
            let $elem = $('<span/>', {
                css: {
                    'background-color': store.colorCode,
                    'mask': 'url(' + store.iconUrl + ') no-repeat 50% 50%',
                    'mask-size': 'cover',
                },
            });
            $elem.addClass("glyphicon glyphicon-store");
            $obj.append($('<option/>', {
                value: store.cookieStoreId,
                html : $elem,
            }).append(store.name));
        }
    }

    update_select_form('#store');
    update_select_form('#search_store');
}

function getStores() {
    /* Initialize the list of domains in the ui & the list of containers/stores in section "details" */

    vAPI.get_stores().then((stores) => {

        // Init dict of storeIds with iconURl and color as values
        for (let store of stores) {
            storeIcons[store.cookieStoreId] = [store.iconUrl, store.colorCode];
        }

        // Display stores with their icon on the select menu
        showStores(stores);

        // Fill the list of domains
        // vAPI.storeIds is set during the call of get_stores() promise
        showDomains(vAPI.storeIds);
    });
}

function delete_cookies(promise, delete_button_selector) {
    // Delete all cookies in the promise
    let deletion_promise = vAPI.delete_cookies(promise);
    deletion_promise.then((ret) => {
        // Supress red color, disable & reset text editing for the next cookie
        $(delete_button_selector).removeClass("button-error");

        // Reactivate the interface
        disable_cookie_details();

        if (delete_button_selector == "#delete_all_button span")
            actualizeDomains();
        else {
            // Deletion of a single domain is ok:
            // Get the current domain:
            // - click on the next element
            // - remove it from the list
            let $selected = $('#domain-list').find('li.active');
            let $next = $selected.next();
            if ($next.length == 1) {
                $next.click();
                $selected.remove();
            } else {
                actualizeDomains();
            }
        }


    }, (error) => {
        console.log({RemovedError: error});
        // If null: no error but no suppression
        // => display button content in red
        $(delete_button_selector).addClass("button-error");

        // Reactivate the interface
        disable_cookie_details();
        // On error: reload all the domains if multiple domains were concerned;
        // reload only the current domain if a single domain is concerned
        if (delete_button_selector == "#delete_all_button span")
            actualizeDomains();
        else {
            reset_cookie_details();
            // Click on the same domain since there are not deleted cookies
            $('#domain-list').find('li.active').click();
        }
    });
}

function no_cookie_alert(domNode) {
    // No cookies to display
    // Add info to the given node (cookie-list or domain-list div)
    let p = document.createElement("p");
    let content = document.createTextNode(browser.i18n.getMessage("noCookieAlert")); //"No cookies in this tab."
    let parent = domNode.parentNode;
    p.appendChild(content);
    domNode.appendChild(p);

    // Focus on the domain list by default
    // TODO: sufficient ?
    $current_selected_list = $('#domain-list');
}

function get_options() {
    // Get options from storage
    // Init protected_cookies array in global context
    // Load css stylesheet

    let get_settings = browser.storage.local.get({
        protected_cookies: {},
        skin: 'default',
    });
    get_settings.then((items) => {
        console.log({storage_data: items});

        // protected_cookies array
        // The array check is a workaround to fix previous bug e4e735f (an array instead of an object)
        if (!Array.isArray(items.protected_cookies))
            protected_cookies = items.protected_cookies;
        else {
            // Init data structure
            set_settings = browser.storage.local.set({"protected_cookies": {}});
            set_settings.then(null, onError);
        }

        if (items.skin != 'default')
            update_skin(items.skin);
    });
}

function disable_cookie_details() {
    // Disable all text inputs
    // Note: These inputs create a NEW cookie if they are modified
    $("#domain").prop("readonly", true);
    $('#fpi-domain').prop("readonly", true);
    $("#name").prop("readonly", true);
    $("#path").prop("readonly", true);
}

function enable_cookie_details() {
    // Enable all text inputs
    // Note: These inputs create a NEW cookie if they are modified
    $("#domain").prop("readonly", false);
    $('#fpi-domain').prop("readonly", false);
    $("#name").prop("readonly", false);
    $("#path").prop("readonly", false);
}

function onError(error) {
    // Function called when a save/remove function has failed by throwing an exception.
    console.log({"Error removing/saving cookie:": error});
}

function reset_cookie_details() {
    // Reset cookie details to default
    // Suppression of all values in text inputs and textarea
    $("#cookie-details input[type=text]").each(function() {
        $(this).val("");
    });
    $("#value").val("");
    $("#issession").prop("checked", true);
    $('#expiration_date').closest('.form-group').hide();
    $("#edit_button").removeClass("down");
}

function actualizeDomains() {
    // Reset domains/cookies list
    // Reset details
    // Rebuild domains list with a new query
    // Called when searchbox is modified, and when actualize button is pressed
    $('#domain-list').empty();
    $('#cookie-list').empty();
    reset_cookie_details();
    showDomains(vAPI.storeIds);
    //getStores();
}

function isExpired(expirationDate) {
    // Detect expired date
    // Return true if expired, else otherwise
    // Get Unix timestamp (seconds)
    let current_date = new Date(); // milliseconds
    return (current_date / 1000 > expirationDate);
}

function setDefaultDomain() {
    // Set default domain into search box in order to filter the domains list;
    // The url is given by the popup for the current consulted page.

    // Get parameter from full url
    let current_addon_url = new URL(window.location.href);
    let parent_url = current_addon_url.searchParams.get("parent_url");
    if (parent_url == "")
        return;
    // Get domain from hostname without subdomain
    // https://stackoverflow.com/questions/9752963/get-domain-name-without-subdomains-using-javascript
    var splitted_domain = (new URL(parent_url)).hostname.replace(/^www\./, '').split('.');
    while (splitted_domain.length > 3) {
        splitted_domain.shift();
    }
    if (splitted_domain.length === 3 && ((splitted_domain[1].length > 2 && splitted_domain[2].length > 2))) {
        splitted_domain.shift();
    }
    var parent_domain = splitted_domain.join('.');
    // Set searched domain to searchbox
    $('#search_domain').val(parent_domain);
}

function showDomains(storeIds) {
    /* Show domains in a list.
     * Domains with private cookies have a private badge.
     * When user click on an element, an event is sent to query/display related cookies.
     */
    let searched_domain = $('#search_domain').val();
    let searched_store = $('#search_store').val();
    var domainList = document.getElementById('domain-list');

    // Filter on selected store
    if (searched_store != 'all')
        storeIds = [searched_store];

    /* Strict domain search => too rigid
    if (searched_domain != "") {
        params['domain'] = searched_domain;
    }*/

    vAPI.get_all_cookies(storeIds).then((cookies) => {

        // Get dict of domains with number of cookies + cookieStore ids
        var domains = uniqueDomains(cookies);
        // Remove subdomains & keep only domains on top of subdomains
        if ($('#query-subdomains').is(':checked'))
            domains = filter_master_domains(domains);
        // Sort domains names alphabetically
        var domains_names = Object.keys(domains);
        domains_names.sort();
        var display_count = 0;
        //add an <li> item with the name and value of the cookie to the list
        domains_names.forEach(function(domain){

            // Do not display domains different than the searched one
            if (searched_domain != "" && domain.indexOf(searched_domain) === -1) {
                return;
            }
            // Count displayed domains
            display_count++;

            let li = document.createElement("li");
            li.className = "list-group-item";
            let b_content = document.createTextNode(domains[domain].number);
            let content = document.createTextNode(domain);
            // Add a badge with the number of cookies for that domain
            let badge = document.createElement("span");
            badge.className = "badge";
            badge.appendChild(b_content);
            li.appendChild(content);
            li.appendChild(badge);

            // Display badge if cookie comes from a special store
            for (let storeId of domains[domain].storeIds) {
                if (storeId == 'firefox-default')
                    continue;
                let private_badge = document.createElement("span");
                private_badge.className = "store-badge";
                private_badge.style['background-color'] = storeIcons[storeId][1];
                private_badge.style['mask'] = 'url(' + storeIcons[storeId][0] + ') no-repeat 50% 50%';
                private_badge.style['mask-size'] = 'cover';

                li.appendChild(private_badge);
            }

            domainList.appendChild(li);

            // When a user click on the domain, we build a new query to get/display domain cookies
            // TODO: workaround: attach all storeIds in case of someone creates a private cookie
            // in a domain with only default cookies => without these 2 ids, the private
            // cookie will be not displayed until user reloads the domains list.
            $(li).bind('click', {id: domain, storeIds: /*domains[domain].*/storeIds}, showCookiesList);
        });

        // Print no cookie alert if we filtered domains, and there are no more domains to display.
        if (display_count == 0) {
            // No domain to display
            no_cookie_alert(domainList);
            return;
        }

        // Simulate click on the first domain in the list when the list is built
        $("#domain-list li").first().click();

    }, (error) => {
        // No domain to display
        console.log(error);
        no_cookie_alert(domainList);
    });
}

function showCookiesList(event) {
    var id = event.data.id;
    var storeIds = event.data.storeIds

    // Display selected domain as active and reset previously selected domain
    $that = $(this);
    $that.parent().find('li').removeClass('active');
    $that.addClass('active');

    // Get 1 promise for each cookie store
    // Each promise stores all associated cookies
    let promise = vAPI.get_all_cookies(storeIds);
    // Merge all promises
    promise.then((cookies_array) => {

        // Merge all results of promises
        var cookies = [];
        for (let cookie_subset of cookies_array) {
            cookies = cookies.concat(cookie_subset);
        }

        var cookieList = document.getElementById('cookie-list');
        // Reset previous list
        cookieList.innerHTML = "";

        if (cookies.length > 0) {
            // Count cookies displayed (not subdomains filtered)
            var display_count = 0;
            // Avoid to query the same element multiple times
            var query_subdomains = $('#query-subdomains').is(':checked');

            for (let cookie of cookies) {
                // Filter on exact domain (remove sub domains from the list)
                if (!query_subdomains) {
                    if (id != cookie.domain)
                        continue;
                }
                display_count++;

                let li = document.createElement("li");
                li.className = "list-group-item";

                // Detect expired cookie
                if (isExpired(cookie.expirationDate)) {
                    li.className += " cookie-expired";
                }

                let content = document.createTextNode(cookie.name + "=" + cookie.value);

                // Display badge if cookie comes from a special store
                if (cookie.storeId != 'firefox-default') {
                    let private_badge = document.createElement("span");
                    private_badge.className = "cookie-badge";
                    private_badge.style['background-color'] = storeIcons[cookie.storeId][1];
                    private_badge.style['mask'] = 'url(' + storeIcons[cookie.storeId][0] + ') no-repeat 50% 50%';
                    private_badge.style['mask-size'] = 'cover';

                    li.appendChild(private_badge);
                }

                // Add text content
                li.appendChild(content);

                // Display a lock badge if cookie is protected
                try {
                    if (protected_cookies[cookie.domain].indexOf(cookie.name) !== -1) {
                        let lock_badge = document.createElement("span");
                        lock_badge.className = "lock-badge glyphicon glyphicon-lock";
                        li.appendChild(lock_badge);
                    }
                } catch (e) {}

                cookieList.appendChild(li);

                // When a user click on the cookie, we build a new query to display the details
                // in the last ui section.
                // Link the element to the cookie object
                $(li).data("cookie", cookie);
                $(li).bind('click', display_cookie_details);
            }

            // Print no cookie alert if we filtered subdomains, and there are no more cookies to display.
            if (display_count == 0) {
                // No cookie to display: Search clicked domain and remove it
                //console.log($that.parent().find('li.active'));
                $that.parent().find('li.active').remove();
                no_cookie_alert(cookieList);
            } else {
                // Simulate click on the first cookie in the list when the list is built
                $("#cookie-list li").first().click();
            }
        } else {
            // No cookie to display: Search clicked domain and remove it
            //console.log($that.parent().find('li.active'));
            $that.parent().find('li.active').remove();
            no_cookie_alert(cookieList);
        }
    }).catch(reason => {
        console.log({"Error showCookiesList":reason});
    });
}

function display_cookie_details(event) {

    // Display selected cookie as active and reset previously selected cookie
    $that = $(this);
    $that.parent().find('li').removeClass('active');
    $that.addClass('active');

    // Get the current cookie object
    var cookie = $that.data("cookie");
    console.log(cookie);

    // Reset value modifiers
    $("#toggle_url").removeClass("down");
    $("#toggle_b64").removeClass("down");

    // Fill the fields
    $('#domain').val(cookie.domain);
    $('#fpi-domain').val(cookie.firstPartyDomain);
    $('#name').val(cookie.name);
    $('#value').val(cookie.value);
    $('#path').val(cookie.path);
    $('#store').val(cookie.storeId);

    $('#httponly').prop("checked", cookie.httpOnly);
    $('#issecure').prop("checked", cookie.secure);
    $('#issession').prop("checked", cookie.session);

    // If the cookie is not a session cookie: handle the expiration date
    if (!cookie.session) {
        var $expiration_date = $('#expiration_date')
        $expiration_date.closest('.form-group').show();

        // Timestamp is in Unix format: seconds and not milliseconds (so we use moment.unix() method)
        // We can multiply by 1000...
        $expiration_date.data("DateTimePicker").date(moment.unix(cookie.expirationDate).format(vAPI.date_format));

        // not ok
        //$('#myDatepicker').data("DateTimePicker").date(moment(new Date(), 'DD-MM-YYYY HH:mm:ss'));
        // ok
        //$('#myDatepicker').data("DateTimePicker").date(moment(new Date ).format('DD-MM-YYYY HH:mm:ss'));

    } else {
        // Mask datetimepicker in case of a session cookie
        var $expiration_date = $('#expiration_date')
        $expiration_date.closest('.form-group').hide();
        // Put current timestamp + 24h if user decides to set an expiration date later
        //$('#myDatepicker').data("DateTimePicker").clear();
        $expiration_date.data("DateTimePicker").date(moment(new Date ).add(1, 'days').format(vAPI.date_format));
    }

    // If the cookie is not in protected_cookies array: display lock icon
    // otherwise, display unlock icon
    let button_icon = $("#protect_button span");
    if (protected_cookies[cookie.domain] === undefined ||
        protected_cookies[cookie.domain].indexOf(cookie.name) === -1) {
        // is not protected
        button_icon.removeClass("glyphicon-unlock");
        button_icon.addClass("glyphicon-lock");
    } else {
        // is protected
        button_icon.removeClass("glyphicon-lock");
        button_icon.addClass("glyphicon-unlock");
    }
}

function delete_current_cookie() {
    /* Remove a cookie displayed on details zone
     * NOTE: Remove inexistant cookie: Removed: null
     */
    var params = {
      url: vAPI.getHostUrl_from_UI(),
      name: $('#name').val(),
      storeId: $('#store').val(),
    }

    var removing = browser.cookies.remove(params);
    removing.then((cookie) => {
        // Reactivate the interface
        console.log({"Removed:": cookie});

        // If null: no error but no suppression
        // => display button content in red
        if (cookie === null) {
            $("#delete_button span").addClass("button-error");
        } else {
            // OK
            // Supress red color, disable & reset text editing for the next cookie
            // Simulate click on the same domain
            $("#delete_button span").removeClass("button-error");
            disable_cookie_details();
            reset_cookie_details();
            $('#domain-list').find('li.active').click();
        }
    }, onError);
}

function update_skin(skin) {
    // Update skin if skin != 'default'
    // if skin == 'default' => remove the css stylesheet

    if (skin == 'default')
        $('#custom_theme').remove();
    else
        $('<link>')
        .appendTo('head')
        .attr({
            id: 'custom_theme',
            type: 'text/css',
            rel: 'stylesheet',
            href: skin + '.css'
        });
}

/*********** Global variables ***********/

var $current_selected_list = $('#domain-list');

var protected_cookies;
var addon_window_type;
// Init dict of storeIds with iconURl and color as values
var storeIcons = {};
}));
