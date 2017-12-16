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

  mycode(window, document);

}(function(window, document) {

//get active tab to run an callback function.
//it sends to our callback an array of tab objects
function getActiveTab() {
  return browser.tabs.query({currentWindow: true, active: true});
}

function createWindow(createData) {
  let creating = browser.windows.create(createData);
  creating.then(() => {
    console.log("The panel has been created");
  });
}

document.addEventListener("click", (e) => {
  let height = 585;
  let width = 1200;

  if (e.target.id === "search_cookie_manager") {

    getActiveTab().then((tabs) => {
      // Send current url
      let createData = {
        type: "panel",
        url: "cookies.html?parent_url=" + tabs[0].url,
        height: height,
        width: width,
      };
      createWindow(createData);
    });
  }

  else if (e.target.id === "simple_cookie_manager") {
    // Send empty url
    let createData = {
      type: "panel",
      url: "cookies.html?parent_url=",
      height: height,
      width: width,
    };
    createWindow(createData);
  }

  e.preventDefault();
});

// Set the searched domain
getActiveTab().then((tabs) => {
  let current_tab = tabs[0];
  let a = document.querySelector('#search_cookie_manager');
  // Workaround for domains without favicon
  // no alt text to avoid the break of the ui
  let favIconUrl = (current_tab.favIconUrl === undefined) ? "icons/icon48.png" : current_tab.favIconUrl;
  let img = document.createElement("img");
  img.src = favIconUrl;
  img.className = 'favicon';
  let content = document.createTextNode('Search: ' + (new URL(current_tab.url)).hostname);
  a.appendChild(img);
  a.appendChild(content);
});

}));