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
    mycode(window.jQuery, window, document);

}(function($, window, document) {

    // The $ is now locally scoped
    $(function () {

    /*********** Events attached to UI elements ***********/

    // Workaround used to speed-up the load of UI for non supported locales
    let supported_locales = ['fr', 'de'];
    if (supported_locales.includes(browser.i18n.getUILanguage())) {
        //alert(browser.i18n.getUILanguage());
        insertI18nContentIntoDocument(document);
        insertI18nTitleIntoDocument(document);
        insertI18nPopoverContentIntoDocument(document);
    }
    });

    /*********** Utils ***********/

    function insertI18nContentIntoDocument(document) {
        // Set text content for UI elements

        let i18nElements = document.querySelectorAll('[data-i18n-content]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-content');
            i18nElement.textContent = browser.i18n.getMessage(i18nMessageName);
        });
    };

    function insertI18nTitleIntoDocument(document) {
        // Set title for tooltips elements

        let i18nElements = document.querySelectorAll('[data-i18n-title]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-title');
            i18nElement.setAttribute('data-original-title', browser.i18n.getMessage(i18nMessageName));
        });
    };

    function insertI18nPopoverContentIntoDocument(document) {
        // Set content and title for popover elements

        let i18nElements = document.querySelectorAll('[data-i18n-popover-content]');

        i18nElements.forEach(function (i18nElement) {

            let i18nMessageName = i18nElement.getAttribute('data-i18n-popover-content');
            i18nElement.setAttribute('data-content', browser.i18n.getMessage(i18nMessageName));
            i18nElement.setAttribute('data-original-title', browser.i18n.getMessage('tooltip' + i18nMessageName));
        });
    };

}));