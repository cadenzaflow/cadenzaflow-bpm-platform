/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership. Camunda licenses this file to you under the Apache License,
 * Version 2.0; you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// the URL of the SSO logout: the page URL up to the webapps' root, then /logout
function logoutUrl(appRoot) {
  const idx = document.location.href.indexOf(appRoot);
  return document.location.href.substring(0, idx) + "/logout";
}

// AngularJS webapps (they have a <base app-root>)
const base = document.querySelector("base[app-root]");
if (base) {
  // observe document if logout link is rendered and override it for SSO logout
  const observer = new MutationObserver(() => {
    const logoutListItem = document.querySelector("li.account li.logout");
    if (logoutListItem) {
      observer.disconnect();

      const oldLogoutLink = logoutListItem.getElementsByTagName("a")[0];
      // create a clone so no listeners are attached anymore
      const logoutLink = oldLogoutLink.cloneNode(true);
      logoutListItem.replaceChild(logoutLink, oldLogoutLink);

      logoutLink.href = logoutUrl(base.getAttribute("app-root"));
    }
  });
  observer.observe(document, { attributes: false, childList: true, characterData: false, subtree: true });

  // on page load forward user from login page to dashboard
  if (window.location.hash === '#/login') {
    window.location.hash = "";
  }
}

// React webapps (/app/react/): "Log out" in the user menu calls the logout of
// the {app}.logout plugin; the AngularJS webapps have no such plugin point
export default ["admin", "cockpit", "tasklist", "welcome"].map(app => ({
  id: "sso-logout",
  pluginPoint: `${app}.logout`,
  logout: ({ api }) => {
    document.location.href = logoutUrl(api.adminApi.replace(/\/api\/admin$/, ""));
  }
}));
