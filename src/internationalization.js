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

    // The global arguments are passed as parameters
    mycode(window, document);

}(function(window, document) {

    // The arguments are now locally scoped

    /*
     * $(function(){
     *  set_translations();
     * });
     */

    /* By using the event DOMContentLoaded instead of JQuery $(function(){code});
     * to isolate code that is executed when the DOM is ready, we have to
     * modify the attributes "title" instead of "data-original-title".
     *
     * It seems that DOMContentLoaded is emitted sooner than the $(document).ready
     * of JQuery.
     *
     * JQuery ready: data-original-title
     * Pure JS DOMContentLoaded: title
     */

    document.addEventListener("DOMContentLoaded", function(event) {
        /*********** Events attached to UI elements ***********/


        /*********** Initializations ***********/

        set_translations();

    }, false);

    /*********** Utils ***********/

    function set_translations() {
        //console.log(browser.i18n.getUILanguage());
        // Workaround used to speed-up the load of UI for non supported locales
        let supported_locales = ['fr', 'de'];
        if (supported_locales.includes(browser.i18n.getUILanguage())) {
            insertI18nContentIntoDocument();
            insertI18nTitleIntoDocument();

            // Quick & dirty fix for input tags with placeholder attribute
            insertI18nPlaceholderIntoDocument('search_domain');
            insertI18nPlaceholderIntoDocument('search_filter');
        }
        insertI18nPopoverContentIntoDocument();
    };

    function insertI18nContentIntoDocument() {
        // Set text content for UI elements

        let i18nElements = document.querySelectorAll('[data-i18n-content]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-content');
            // TODO: use innerHTML instead for the html parsing (less efficient).
            i18nElement.textContent = browser.i18n.getMessage(i18nMessageName);
        });
    };

    function insertI18nTitleIntoDocument() {
        // Set title for tooltips elements

        let i18nElements = document.querySelectorAll('[data-i18n-title]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-title');
            //i18nElement.setAttribute('data-original-title', browser.i18n.getMessage(i18nMessageName));
            i18nElement.setAttribute('title', browser.i18n.getMessage(i18nMessageName));
        });
    };

    function insertI18nPopoverContentIntoDocument() {
        // Set content and title for popover elements
        // Title message in _locales must be prefixed by 'tooltip'

        let i18nElements = document.querySelectorAll('[data-i18n-popover-content]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-popover-content');
            i18nElement.setAttribute('data-content', browser.i18n.getMessage(i18nMessageName));
            i18nElement.setAttribute('data-original-title', browser.i18n.getMessage('tooltip' + i18nMessageName));
        });
    };

    function insertI18nPlaceholderIntoDocument(elementID) {
        // Set placeholders for element with the given id

        let i18nElement = document.getElementById(elementID);
        i18nElement.setAttribute('placeholder', browser.i18n.getMessage(elementID + 'Placeholder'));
    };
}));