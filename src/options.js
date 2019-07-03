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

// IIFE - Immediately Invoked Function Expression
(function(mycode) {

    // The global jQuery object is passed as a parameter
    mycode(window.jQuery, window.vAPI, window, document);

}(function($, vAPI, window, document) {

    // The $ is now locally scoped
    $(function () {
        /*********** Events attached to UI elements ***********/
        $('#import_protected_cookies').change(function() {
            // Import cookies as protected cookies
            set_option({'import_protected_cookies': $(this).is(':checked')});
        });
        $('#delete_all_on_restart').change(function() {
            // Delete all cookies when the browser restarts
            set_option({'delete_all_on_restart': $(this).is(':checked')});
        });
        $('#fpi_status').change(function() {
            // Set the FPI option
            vAPI.setFirstPartyIsolateStatus($(this).is(':checked'));
        });
        $('#prevent_protected_cookies_deletion').change(function() {
            // Prevent protected cookies deletion from websites
            set_option({'prevent_protected_cookies_deletion': $(this).is(':checked')});
        });
        $('#skin').change(function() {
            // Change skin
            set_option({'skin': $(this).val()});
        });
        $('#open_in_new_tab').change(function() {
            // Delete all cookies when the browser restarts
            set_option({'open_in_new_tab': $(this).is(':checked')});
        });
        $('#display_deletion_alert').change(function() {
            // Display an alert when a user wants to delete all cookies from a context
            set_option({'display_deletion_alert': $(this).is(':checked')});
        });
        $('#template').change(function() {
            // Change template
            set_option({'template': $(this).val()});
        });
        $('#resetUserDataButton').click(function() {
            // Reset all data
            browser.storage.local.clear();
            // Update the interface
            get_options();
        });
        $('#backupUserDataButton').click(function() {
            // Get all storage data
            let get_settings = browser.storage.local.get();
            get_settings.then((items) => {
                // Download the json file
                download({
                    'url': 'data:text/plain,' + encodeURIComponent(JSON.stringify(items, null, 2)),
                    'filename': 'userdata_cookie_quick_manager.json'
                });
            });
        });
        $("#restoreUserDataButton").click(function(event) {
            // Overlay for <input type=file>
            var restoreFilePicker = document.getElementById("restoreFilePicker");
            if (restoreFilePicker) {
                restoreFilePicker.click();
            }
            event.preventDefault(); // prevent navigation to "#"
        });
        $('#restoreFilePicker').change(function(event) {
            // File load onto the browser
            var file = event.target.files[0];
            if (!file)
                return;

            var reader = new FileReader();
            reader.onload = function(event) {
                // Restore content
                //console.log(JSON.parse(event.target.result));
                set_option(JSON.parse(event.target.result));
                // Update the interface
                get_options();
            };
            reader.readAsText(file);
        });
        $("#show_delete_all_on_restart").click(function(event) {
            $('#delete_all_on_restart_info').toggle();
        });
        $("#show_fpi").click(function(event) {
            $('#fpi_info').toggle();
        });

        $("#unprotectSelectedCookies").click(function(event) {
            let protected_cookies = {};

            // Get unchecked cookies in unchecked domains
            for (let unchecked_item of $('#protected-cookie-tree').treeview('getUnchecked')) {

                // Remove leafs
                if (!unchecked_item.nodes)
                    continue;

                // If a domain is unchecked, it's because none of his children are checked
                let unchecked_items = [];
                for (let node of unchecked_item.nodes)
                    unchecked_items.push(node.text);

                protected_cookies[unchecked_item.text] = unchecked_items;
            }

            // Get unchecked cookies in checked domains
            for (let checked_item of $('#protected-cookie-tree').treeview('getChecked')) {

                // Remove leafs
                if (!checked_item.nodes)
                    continue;

                let unchecked_items = [];
                for (let node of checked_item.nodes) {
                    // If a domain is checked, maybe there is at least one child unchecked
                    if (!node.state.checked)
                        unchecked_items.push(node.text);
                }

                if (unchecked_items.length)
                    protected_cookies[checked_item.text] = unchecked_items;
            }

            //console.log("protected", protected_cookies);

            // Set new protected_cookies on storage area
            browser.storage.local.set({"protected_cookies": protected_cookies});
            // Update the treeview
            build_treeview();

        });

        $('#my-protected-cookies-toggle').click(function(event) {
            // Lazy load of treeview
            build_treeview();
        });

        // Load options from storage and update the interface
        get_options();
        display_features_depending_on_browser_version();
        display_features_depending_on_OS();
    });

    /*********** Utils ***********/
    function set_option(option_object) {
        //console.log({set_option: option_object});
        let set_settings = browser.storage.local.set(option_object);
        set_settings.then(null, (error) => {
            console.log(`set_option_error: ${error}`);
        });
    }

    function get_options() {
        // Load options from storage and update the interface
        let get_settings = browser.storage.local.get({
            delete_all_on_restart: false,
            import_protected_cookies: false,
            prevent_protected_cookies_deletion: true,
            skin: 'default',
            open_in_new_tab: true,
            display_deletion_alert: true,
            template: 'JSON',
        });
        get_settings.then((items) => {
            //console.log({storage_data: items});

            // Update the interface
            $('#delete_all_on_restart').prop('checked', items.delete_all_on_restart);
            $('#import_protected_cookies').prop('checked', items.import_protected_cookies);
            $('#prevent_protected_cookies_deletion').prop('checked', items.prevent_protected_cookies_deletion);
            $('#skin').val(items.skin);
            $('#open_in_new_tab').prop('checked', items.open_in_new_tab);
            $('#display_deletion_alert').prop('checked', items.display_deletion_alert);
            $('#template').val(items.template);
        });
    }

    function display_features_depending_on_browser_version() {
        // Display features according to the capacities of the browser

        // First-Party Isolation
        vAPI.FPI_detection(browser.runtime.getBrowserInfo()).then((browser_info) => {
            // Detect Firefox version:
            // -> firstPartyDomain argument is available on Firefox 59+=
            // -> privacy.firstparty.isolate is available on Firefox 58 but we don't want it
            // since we can't handle these cookies on this browser.
            // {name: "Firefox", vendor: "Mozilla", version: "60.0.1", buildID: ""}
            let version = browser_info.version.split('.')[0];

            if ((vAPI.FPI === undefined) || (parseInt(version, 10) < 59)) {
                // Firefox 58-=
                // FPI is not available or we don't want it
                $('#fpi_status').prop('disabled', true);
            } else {
                // Display FPI status
                $('#fpi_status').prop('checked', vAPI.FPI);
            }
        });
    }

    function display_features_depending_on_OS() {
        // Display features according to the capacities of the OS

        let gettingInfo = browser.runtime.getPlatformInfo();
        gettingInfo.then((info) => {
            // On Android, the addon must be opened in a new tab
            if (info.os == 'android')
                $('#open_in_new_tab').parent().hide();
        })
        .catch((error) => {
            console.log(`display_features_depending_on_OS: ${error}`);
        });
    }

    function download(details) {
        // Download a file that contains the given details
        if ( !details.url ) {
            return;
        }

        var a = document.createElement('a');
        a.href = details.url;
        a.setAttribute('download', details.filename || '');
        a.dispatchEvent(new MouseEvent('click'));
    }


    function build_treeview() {
        // Build a treeview by getting protected cookies and initializing the treeview object.

        let get_settings = browser.storage.local.get({
            protected_cookies: {},
        });
        get_settings.then((items) => {

            // Build tree object
            var tree = [];
            for (let domain in items.protected_cookies) {
                let cookies_names = items.protected_cookies[domain];

                // Build parent node
                let node = {};
                node.text = domain;
                node.tags = [cookies_names.length];

                // Build leafs with cookies names
                let nodes = [];
                cookies_names.forEach((cookie_name) => {
                    nodes.push({text: cookie_name});
                });

                // Add nodes to parent
                node['nodes'] = nodes;
                // Add parent to tree
                tree.push(node);
            }
            //console.log(tree);

            if (!tree.length) {
                $protected_cookie_tree.html('<i>' + browser.i18n.getMessage('oNoProtectedCookiesAlert') + '</i>');
                $('#unprotectSelectedCookies').hide();
                return;
            }

            // Protected cookies to show
            $('#unprotectSelectedCookies').show();
            // Init treeview
            init_treeview(tree);

        })
        .catch(err => console.error(err));
    }

    function init_treeview(tree) {

        $protected_cookie_tree.treeview({
            data: tree,
            showIcon: false,
            showCheckbox: true,
            showTags: true,
            showBorder: false,
            onNodeChecked: function(event, node) {
                //console.log(node.text + ' was checked');
                if (!node.nodes) {
                    // Leaf: check the parent node
                    let parent_node = $protected_cookie_tree.treeview('getParent', node);
                    $protected_cookie_tree.treeview('checkNode', [ parent_node.nodeId, { silent: true } ]);
                    return;
                }
                // Parent node: check all leafs
                for (let child_node of node.nodes) {
                    //Triggers nodeChecked event; pass silent to suppress events.
                    $protected_cookie_tree.treeview('checkNode', [ child_node.nodeId, { silent: true } ]);
                }
            },
            onNodeUnchecked: function (event, node) {
                //console.log(node.text + ' was unchecked');
                if (!node.nodes) {
                    // Leaf
                    // Check if siblings are unchecked too
                    // If there is no checked node, we uncheck the parent one.
                    let sibling_nodes = $protected_cookie_tree.treeview('getSiblings', node);
                    let checked_siblings_count = 0;
                    for (let sibling_node of sibling_nodes) {
                        if (sibling_node.state.checked)
                            checked_siblings_count++;
                    }

                    if (!checked_siblings_count) {
                        // No checked leafs
                        let parent_node = $protected_cookie_tree.treeview('getParent', node);
                        $protected_cookie_tree.treeview('uncheckNode', [ parent_node.nodeId, { silent: true } ]);
                    }
                    return;
                }
                // Parent node: uncheck all leafs
                for (let child_node of node.nodes) {
                    //Triggers nodeChecked event; pass silent to suppress events.
                    $protected_cookie_tree.treeview('uncheckNode', [ child_node.nodeId, { silent: true } ]);
                }
            }
        });
    }

    /*********** Global variables ***********/

    var $protected_cookie_tree = $('#protected-cookie-tree');
}));