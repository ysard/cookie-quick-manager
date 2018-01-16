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
// IIFE - Immediately Invoked Function Expression
(function(mycode) {

    // The global jQuery object is passed as a parameter
    mycode(window.jQuery, window, document);

}(function($, window, document) {

    // The $ is now locally scoped
    $(function () {
        /*********** Events attached to UI elements ***********/
        $('#import_protected_cookies').change(function() {
            set_option({'import_protected_cookies': $(this).is(':checked')});
        });
        $('#delete_all_on_restart').change(function() {
            set_option({'delete_all_on_restart': $(this).is(':checked')});
        });
        $('#skin').change(function() {
            console.log($(this).val());
            set_option({'skin': $(this).val()});
        });

        // Load options from storage and update the interface
        get_options();
    });

    /*********** Utils ***********/
    function set_option(option_object) {
        console.log({set_option: option_object});
        settings = browser.storage.local.set(option_object);
        settings.then(null, (error) => {
            console.log(`set_option_error: ${error}`);
        });
    }

    function get_options() {
        // Load options from storage and update the interface
        let settings = browser.storage.local.get({
            skin: 'default',
            delete_all_on_restart: false,
            import_protected_cookies: false,
        });
        settings.then((items) => {
            console.log({storage_data: items});

            $('#skin').val(items.skin);
            $('#delete_all_on_restart').prop('checked', items.delete_all_on_restart);
            $('#import_protected_cookies').prop('checked', items.import_protected_cookies);

        });
    }

    /*********** Global variables ***********/

}));