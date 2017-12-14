/*
 *  Cookie Quick Manager: An addon to manage (view, search, create, edit,
 *  remove, backup, restore) cookies on Firefox.
 *  Copyright (C) 2017 Ysard
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
$(function () {

/*********** Utils ***********/
function build_cookie_dump() {
    // Return the updated template according to the selected cookie in cookie-list,
    // displayed in details.
    // Data: from the User Interface.

    function get_timestamp(raw) {
        // If raw is true, return the unix timestamp if the cookie is not a session cookie
        // otherwise, return 0.
        // If raw is false, return human readable date or "At the end of the session" for a
        // session cookie.
        var issession = $('#issession').is(':checked');
        if (raw) {
            return (!issession) ? $('#expiration_date').data("DateTimePicker").date().unix() : 0;
        }
        return (!issession) ? $('#expiration_date').data("DateTimePicker").date().format(date_format) : "At the end of the session";
    }

    function get_domain_status(raw) {
        // Return the domain status of cookie.
        // If raw is true, return false is cookie is valid for subdomains
        // If raw is false, return "Valid for subdomains" or "Valid for host only".
        // PS:
        //   foo.com => host-only
        //   .foo.com => subdomains
        //   www.foo.com => host-only
        var domain = $('#domain').val();
        if (raw) {
            // Return false if cookie is also valid for subdomains
            return (domain[0] == '.') ? false : true;
        }
        return (domain[0] == '.') ? "Valid for subdomains" : "Valid for host only";
    }

    function get_secure_status(raw) {
        // Return the secure status of the cookie
        // If raw is true, return true or false
        var issecure = $('#issecure').is(':checked');
        if (raw) {
            return issecure;
        }
        return (issecure) ? "Encrypted connections only" : "Any type of connection";
    }

    // Make a local copy of the template
    var template_temp = cookie_clipboard_template;

    // Update variables
    var params = {
        '{HOST_RAW}': $('#domain').val(),
        '{NAME_RAW}': $('#name').val(),
        '{PATH_RAW}': $('#path').val(),
        '{CONTENT}': decodeURIComponent($('#value').val()),
        '{CONTENT_RAW}': $('#value').val(),
        '{EXPIRES}': get_timestamp(false),
        '{EXPIRES_RAW}': get_timestamp(true),
        '{ISSECURE}': get_secure_status(false),
        '{ISSECURE_RAW}': get_secure_status(true),
        '{ISHTTPONLY_RAW}': $('#httponly').is(':checked'),
        '{ISDOMAIN}': get_domain_status(false),
        '{ISDOMAIN_RAW}': get_domain_status(true),
        '{ISPRIVATE}': $('#isprivate').is(':checked') ? 'firefox-private' : 'firefox-default',
        '{ISPRIVATE_RAW}': $('#isprivate').is(':checked'),
    };

    // Replace variables in template
    for (let key_pattern in params) {
        template_temp = template_temp.replace(key_pattern, params[key_pattern]);
    }
    return template_temp;
    //return JSON.stringify(JSON.parse(template_temp), null, 2);
}

function build_domain_dump(cookie) {
    // Return the updated template according to the given cookie object.
    // Data: from the given cookie object.

    function get_timestamp(raw) {
        // If raw is true, return the unix timestamp if the cookie is not a session cookie
        // otherwise, return 0.
        // If raw is false, return human readable date or "At the end of the session" for a
        // session cookie.
        var issession = $('#issession').is(':checked');
        if (raw) {
            return (!cookie.session) ? cookie.expirationDate : 0;
        }
        return (!cookie.session) ? moment(new Date(cookie.expirationDate * 1000)).format(date_format) : "At the end of the session";
    }

    function get_domain_status(raw) {
        // Return the domain status of cookie.
        // If raw is true, return false is cookie is valid for subdomains
        // If raw is false, return "Valid for subdomains" or "Valid for host only".
        // PS:
        //   foo.com => host-only
        //   .foo.com => subdomains
        //   www.foo.com => host-only
        if (raw) {
            // Return false if cookie is also valid for subdomains
            return cookie.httpOnly;
        }
        return (cookie.httpOnly) ? "Valid for subdomains" : "Valid for host only";
    }

    function get_secure_status(raw) {
        // Return the secure status of the cookie
        // If raw is true, return true or false
        if (raw) {
            return cookie.secure;
        }
        return (cookie.secure) ? "Encrypted connections only" : "Any type of connection";
    }

    function getHostUrl() {
        // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
        // modify or delete it.
        var host_protocol = (cookie.secure) ? 'https://' : 'http://';
        return host_protocol + cookie.domain + cookie.path;
    }

    // Make a local copy of the template
    var template_temp = cookie_clipboard_template;

    var params = {
        '{HOST_RAW}': getHostUrl(),
        '{NAME_RAW}': cookie.name,
        '{PATH_RAW}': cookie.path,
        '{CONTENT}': decodeURIComponent(cookie.value),
        '{CONTENT_RAW}': cookie.value,
        '{EXPIRES}': get_timestamp(false),
        '{EXPIRES_RAW}': get_timestamp(true),
        '{ISSECURE}': get_secure_status(false),
        '{ISSECURE_RAW}': get_secure_status(true),
        '{ISHTTPONLY_RAW}': cookie.httpOnly,
        '{ISDOMAIN}': get_domain_status(false),
        '{ISDOMAIN_RAW}': cookie.hostOnly,
        '{ISPRIVATE}': cookie.storeId,
        '{ISPRIVATE_RAW}': (cookie.storeId == 'firefox-private') ? true: false,
    };

    // Replace variables in template
    for (let key_pattern in params) {
        template_temp = template_temp.replace(key_pattern, params[key_pattern]);
    }
    return template_temp;
}

function download(filename, text) {
    /* bug for Firefox in panel ?
     * This file is opened in place of the current window instead of downloaded...
     * TODO: This function can be replaced with an iframe like in the event:
     * $("#file_export").click(function() ...
     */
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function onError(error) {
    // Function called when a save/remove function has failed by throwing an exception.
    console.log({"Error removing/saving cookie:": error});
}

/*********** Events attached to UI elements ***********/
$('#clipboard_textarea').focus(function() {
    // Capture the focus on textarea and select all its content
    $(this).select();
});
/* Bug in FF ? see download().
 $ ("*#file_export").click(function() {
 download($('#domain').val() + ".txt", build_cookie_dump());
});
*/
$("#file_export").click(function() {
    var f = document.createElement('iframe');
    f.style.position = 'fixed';
    //f.style.left = f.style.top = '-999px';
    //f.style.width = f.style.height = '99px';
    f.srcdoc = '<a download="cookies.json" target="_blank">cookies.json</a>';
    f.onload = function() {
        var blob = new Blob([build_cookie_dump()], {type: 'application/json'});
        var a = f.contentDocument.querySelector('a');
        a.href = f.contentWindow.URL.createObjectURL(blob);
        a.click();
        // Removing the frame document implicitly revokes the blob:-URL too.
        setTimeout(function() { f.remove(); }, 2000);
    };
    document.body.appendChild(f);
});

$("#clipboard_cookie_export").click(function() {
    // Handle the copy of the current cookie displayed in details zone
    // Build text according to template
    $('#clipboard_textarea').val(build_cookie_dump());
    // Update title of the dialog box (1 only cookie at the time here)
    $('#modal_clipboard h4.modal-title').html("Export 1 cookie");
});

$("#clipboard_domain_export").click(function() {
    // TODO: dynamic selection of domains
    //var ids = [".google.com", ".google.fr"];
    //var storeIds = ['firefox-default', 'firefox-private'];

    // Workaround to get click event data of the selected domain
    // Get pure HTML document (not a JQuery one)
    var domain = document.querySelector('#domain-list li.active');
    console.log($._data(domain, "events" ));
    // Get data of the first click event registered
    var click_event_data = $._data(domain, "events" ).click[0].data
    var id = click_event_data.id;
    var storeIds = click_event_data.storeIds;
    var ids = [id, ];


    // Get 1 promise for each cookie store
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
        var cookies = [];
        for (let cookie_subset of cookies_array) {
            cookies = cookies.concat(cookie_subset);
        }

        if (cookies.length > 0) {

            // Make 1 json for each cookie and store it
            // Count cookies displayed (not subdomains filtered)
            var display_count = 0;
            var templates = [];
            var query_subdomains = $('#query-subdomains').is(':checked');
            for (let cookie of cookies) {
                // Filter on exact domain (remove sub domains from the list)
                if (!query_subdomains) {
                    // If current domain is not found in ids => go to next cookie
                    if (ids.indexOf(cookie.domain) === -1)
                        continue;
                }
                display_count++;
                templates.push(build_domain_dump(cookie));
            }
            // Merge and display templates, update title with the number of cookies
            $('#clipboard_textarea').val('[' + templates.join(',') + ']');
            $('#modal_clipboard h4.modal-title').html("Export " + display_count + " cookie(s)");
        }
    });
});

$("#import_file").click(function(event) {
    // Overlay for <input type=file>
    var file_elem = document.getElementById("file_elem");
    if (file_elem) {
        file_elem.click();
    }
    event.preventDefault(); // prevent navigation to "#"
});

$("#file_elem").change(function(event) {
    // File load onto the browser
    var file = event.target.files[0];
    if (!file)
        return;

    var reader = new FileReader();
    reader.onload = function(event) {
        // Restore content
        handleUploadedFile(event.target.result);
    };
    reader.readAsText(file);
});

function handleUploadedFile(content) {
    // Take a file content and dispatch it to the good parser
    try {
        parseJSONFile(content);
        // Display modal info
        $('#modal_info .modal-body').html("Cookie successfully restored");
        $('#modal_info').modal('show');
        // Actualize interface
        $("#actualize_button").click();
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.log(error);
            $('#modal_info .modal-body').html("No cookie restored");
            $('#modal_info').modal('show');
        }
        else {
            throw error;
        }
    }
}

function parseJSONFile(content) {
    // Parse json file and return a cookie object

    var json_content = JSON.parse(content);

    // Build cookies
    var cookies = [];
    for (let json_cookie of json_content) {
        let params = {
            url: json_cookie["Host raw"],
            name: json_cookie["Name raw"],
            value: json_cookie["Content raw"],
            path: json_cookie["Path raw"],
            httpOnly: (json_cookie["HTTP only raw"] === 'true'),
            secure: (json_cookie["Send for raw"] === 'true'),
            storeId: (json_cookie["Private raw"]  === 'true') ? 'firefox-private' : 'firefox-default',
        };

        // Session cookie has no expiration date
        if (json_cookie["Expires raw"] != "0") {
            params['expirationDate'] = parseInt(json_cookie["Expires raw"], 10);
        }
        console.log(params);
        cookies.push(params);
    }

    // Set cookies
    for (let params of cookies) {
        var gettingAllCookies = browser.cookies.set(params);

        gettingAllCookies.then((cookie) => {
            // Reactivate the interface
            console.log({"Cookie saved: ": cookie});

            // If null: no error but no save
            // => display button content in red
            if (cookie === null) {
                //$("#save_button span").addClass("button-error");
                alert("error");
            } else {
                /*// Supress red color, disable & reset text editing for the next cookie
                // Simulate click on the same domain
                $("#save_button span").removeClass("button-error");
                disable_cookie_details();
                reset_cookie_details();
                $('#domain-list').find('li.active').click();*/
            }
        }, onError);
    }
}

/*********** Global variables ***********/

// Global date format
// PS: "DD-MM-YYYY hh:mm:ss a"), 'a' is for am/pm
var date_format = "DD-MM-YYYY HH:mm:ss";

var cookie_clipboard_template = '{\n\
\t"Host raw": "{HOST_RAW}",\n\
\t"Name raw": "{NAME_RAW}",\n\
\t"Path raw": "{PATH_RAW}",\n\
\t"Content": "{CONTENT}",\n\
\t"Content raw": "{CONTENT_RAW}",\n\
\t"Expires": "{EXPIRES}",\n\
\t"Expires raw": "{EXPIRES_RAW}",\n\
\t"Send for": "{ISSECURE}",\n\
\t"Send for raw": "{ISSECURE_RAW}",\n\
\t"HTTP only raw": "{ISHTTPONLY_RAW}",\n\
\t"This domain only": "{ISDOMAIN}",\n\
\t"This domain only raw": "{ISDOMAIN_RAW}",\n\
\t"Private": "{ISPRIVATE}",\n\
\t"Private raw": "{ISPRIVATE_RAW}"\n\
}';

});
