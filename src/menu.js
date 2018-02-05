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

  mycode(window, document);

}(function(window, document) {

function onError(error) {
    // Function called when a save/remove function has failed by throwing an exception.
    console.log({"Error removing cookies:": error});
}

function getActiveTab() {
  //get active tab to run an callback function.
  //it sends to our callback an array of tab objects
  return browser.tabs.query({currentWindow: true, active: true});
}

function getHostUrl(cookie) {
    // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
    // modify or delete it.
    var host_protocol = (cookie.secure) ? 'https://' : 'http://';
    return host_protocol + cookie.domain + cookie.path;
}

function delete_cookies(promise) {
    // PS: copy of vAPI function
    // Delete all cookies in the promise
    // Return a promise
    return new Promise((resolve, reject) => {

        promise.then((cookies) => {

            let promises = [];
            for (let cookie of cookies) {
                // Remove current cookie
                let params = {
                    url: getHostUrl(cookie),
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

                let a = document.querySelector('#delete_current_cookies');
                // Since we add a text content as a child node, we can just replace it (3rd pos)
                a.childNodes[2].replaceWith(" (0)");

                // Ok => all cookies are deleted properly
                // Reactivate the interface
                resolve();
            }, onError);
        }, onError);
    });
}

function createWindow(createData) {
  // Get settings
  let get_settings = browser.storage.local.get(["addonSize", "open_in_new_tab"]);
  get_settings.then((items) => {

    // Open new tab
    if (items.open_in_new_tab !== undefined && items.open_in_new_tab === true) {
        let new_tab = browser.tabs.create({url: createData.url});
        new_tab.then(() => {
            console.log("The tab has been created");
        });
        window.close();
        return;
    }

    // Open new window
    let height = 531;
    let width = 1095;

    // If addonSize item is in storage and if previous sizes are too small
    // => force default values
    // 768 is the smallest width to avoid the break of the ui
    if (items.addonSize !== undefined && items.addonSize.width >= 768 && items.addonSize.height >= height) {
      height = items.addonSize.height;
      width = items.addonSize.width;
    }
    //console.log({h:height, w:width});
    /*
     * TODO: why it is not ok on some computers with small resolution ?*/
    createData.width = width;
    createData.height = height;

    // Create window
    createData.url += "&type=window";
    let new_window = browser.windows.create(createData);
    new_window.then(() => {
        console.log("The panel has been created");
    });
  });
}

/************************************/

document.addEventListener("click", (e) => {
  let id = e.target.id;

  if (id === "search_cookie_manager") {
      // Send current url
      let createData = {
        type: "panel",
        url: "cookies.html?parent_url=" + current_tab.url,
      };
      createWindow(createData);
  }

  else if (id === "simple_cookie_manager") {
    // Send empty url
    let createData = {
      type: "panel",
      url: "cookies.html?parent_url=",
    };
    createWindow(createData);
  }

  else if (id === "delete_current_cookies") {
    // Delete all cookies for the current domain/store
    var params = {
      url: current_tab.url,
      storeId: current_tab.cookieStoreId,
    }
    delete_cookies(browser.cookies.getAll(params));
  }

  else if (id === "delete_current_localstorage") {
      // Purge LocalStore for the current domain
      // NOTE: subdomains will not be taken into account
      let prom = browser.browsingData.removeLocalStorage({hostnames: [(new URL(current_tab.url)).hostname, ]});
      prom.then(null);
  }

  else if (id === "options") {
      // Open Options Page
      browser.runtime.openOptionsPage();
      window.close();
  }

  e.preventDefault();
});

/************************************/

var current_tab;

// Set the searched domain
getActiveTab().then((tabs) => {
  // Set the global var with current tab
  current_tab = tabs[0];

  // Display a shortcut to search cookies for the current domain
  let a = document.querySelector('#search_cookie_manager');
  // Workaround for domains without favicon
  // no alt text to avoid the break of the ui
  let favIconUrl = (current_tab.favIconUrl === undefined) ? "icons/icon48.png" : current_tab.favIconUrl;
  let img = document.createElement("img");
  img.src = favIconUrl;
  img.className = 'favicon';
  let content = document.createTextNode('Search cookie for: ' + (new URL(current_tab.url)).hostname);
  a.appendChild(img);
  a.appendChild(content);

  // Display a shortcut to delete all cookies for the current domain/store
  // Print the number of cookies
  browser.cookies.getAll({
      url: current_tab.url,
      storeId: current_tab.cookieStoreId,
  }).then((cookies) => {
      let a = document.querySelector('#delete_current_cookies');
      let content = document.createTextNode(" (" + cookies.length + ")");
      a.appendChild(content);
  });

  // Detect Firefox version:
  // - LocalStorage is not available on Firefox 56
  browser.runtime.getBrowserInfo().then((info) => {
    let version = info.version.split('.')[0];
    if (parseInt(version) >= 57)
        document.querySelector('#delete_current_localstorage').style['display'] = 'inline-block';
  });
});

}));