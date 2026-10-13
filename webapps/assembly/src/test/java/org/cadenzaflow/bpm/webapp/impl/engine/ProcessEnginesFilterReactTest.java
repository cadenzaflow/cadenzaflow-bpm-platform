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
package org.cadenzaflow.bpm.webapp.impl.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import javax.servlet.ServletContext;

import org.cadenzaflow.bpm.cockpit.Cockpit;
import org.cadenzaflow.bpm.cockpit.impl.DefaultCockpitRuntimeDelegate;
import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.spi.ProcessEngineProvider;
import org.cadenzaflow.bpm.webapp.plugin.spi.AppPlugin;
import org.cadenzaflow.bpm.webapp.plugin.spi.impl.AbstractAppPlugin;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockFilterConfig;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;

public class ProcessEnginesFilterReactTest {

  protected static final String CONTEXT_PATH = "/cadenzaflow";

  protected ProcessEnginesFilter filter;
  protected MockServletContext servletContext;
  /** whether the engine still has no admin user */
  protected boolean initialUserNeeded;
  /** the plugins of the cockpit; the other apps have none */
  protected List<AppPlugin> plugins = new ArrayList<>();
  /** the index pages: their name, the root and the plugins */
  protected String template = "page=%s root=$APP_ROOT";

  @Before
  public void setUp() throws Exception {
    Cockpit.setCockpitRuntimeDelegate(new DefaultCockpitRuntimeDelegate() {
      protected ProcessEngineProvider loadProcessEngineProvider() {
        return null;
      }

      public Set<String> getProcessEngineNames() {
        return Collections.singleton("default");
      }

      public ProcessEngine getProcessEngine(String processEngineName) {
        return null;
      }

      public ProcessEngine getDefaultProcessEngine() {
        return null;
      }
    });

    filter = new ProcessEnginesFilter() {
      @Override
      protected String getWebResourceContents(String name) {
        return String.format(template, name);
      }

      @Override
      protected void setWebappInTelemetry(String engineName, String appName, ServletContext servletContext) {
        // no engine in this test
      }

      @Override
      @SuppressWarnings("unchecked")
      protected <T extends AppPlugin> List<T> getPlugins(String appName) {
        return "cockpit".equals(appName) ? (List<T>) plugins : Collections.emptyList();
      }

      @Override
      protected boolean needsInitialUser(String engineName) {
        return initialUserNeeded;
      }
    };
    servletContext = new MockServletContext();
    servletContext.setContextPath(CONTEXT_PATH);
    filter.init(new MockFilterConfig(servletContext));
  }

  @After
  public void cleanup() {
    Cockpit.setCockpitRuntimeDelegate(null);
  }

  @Test
  public void shouldLeaveTheAngularJsWebappsAsTheyAre() throws Exception {
    MockHttpServletResponse response = get("/app/tasklist/default/");

    assertThat(response.getContentAsString()).isEqualTo("page=/app/tasklist/index.html root=" + CONTEXT_PATH);
  }

  @Test
  public void shouldServeTheReactIndexBelowEveryReactApp() throws Exception {
    for (String app : new String[] { "cockpit", "tasklist", "admin", "welcome" }) {
      MockHttpServletResponse response = get("/app/react/" + app + "/default/");

      assertThat(response.getContentAsString()).isEqualTo("page=/app/react/index.html root=" + CONTEXT_PATH);
    }
  }

  @Test
  public void shouldServeTheReactIndexForRoutesBelowTheEngine() throws Exception {
    MockHttpServletResponse response = get("/app/react/cockpit/default/process-instance/42");

    assertThat(response.getContentAsString()).isEqualTo("page=/app/react/index.html root=" + CONTEXT_PATH);
  }

  @Test
  public void shouldRedirectToTheDefaultEngineAndApp() throws Exception {
    assertThat(get("/app/react/admin/").getRedirectedUrl()).isEqualTo(CONTEXT_PATH + "/app/react/admin/default/");
    assertThat(get("/app/react/").getRedirectedUrl()).isEqualTo(CONTEXT_PATH + "/app/react/tasklist/default/");
  }

  @Test
  public void shouldPassTheReactFilesThrough() throws Exception {
    MockFilterChain chain = new MockFilterChain();
    MockHttpServletResponse response = get("/app/react/assets/index.js", chain);

    assertThat(chain.getRequest()).isNotNull();
    assertThat(response.getContentAsString()).isEmpty();
  }

  @Test
  public void shouldKeepDeepPathsOfAngularJsUnchanged() throws Exception {
    MockFilterChain chain = new MockFilterChain();
    get("/app/cockpit/default/process-instance/42", chain);

    assertThat(chain.getRequest()).isNotNull();
  }

  @Test
  public void shouldLeadToTheSetupPageWhileThereIsNoAdminUser() throws Exception {
    initialUserNeeded = true;

    assertThat(get("/app/react/tasklist/default/").getRedirectedUrl()).isEqualTo(CONTEXT_PATH + "/app/react/admin/default/setup");
    assertThat(get("/app/react/admin/default/users").getRedirectedUrl()).isEqualTo(CONTEXT_PATH + "/app/react/admin/default/setup");
    assertThat(get("/app/react/admin/default/setup").getContentAsString()).isEqualTo("page=/app/react/index.html root=" + CONTEXT_PATH);
  }

  @Test
  public void shouldLeaveTheSetupPageOnceThereIsAnAdminUser() throws Exception {
    assertThat(get("/app/react/admin/default/setup").getRedirectedUrl()).isEqualTo(CONTEXT_PATH + "/app/react/admin/default/");
  }

  @Test
  public void shouldListThePluginsOfEveryApp() throws Exception {
    template = "plugins=$PLUGINS";
    plugins.add(plugin("zeta"));
    plugins.add(plugin("alpha"));

    // the same on every page: the single-page app moves between the apps
    for (String page : new String[] { "/app/react/cockpit/default/", "/app/react/tasklist/default/" }) {
      assertThat(get(page).getContentAsString()).isEqualTo("plugins={\"admin\":[],\"cockpit\":["
          + "{\"id\":\"alpha\",\"location\":\"" + CONTEXT_PATH + "/api/cockpit/plugin/alpha/static/app\"},"
          + "{\"id\":\"zeta\",\"location\":\"" + CONTEXT_PATH + "/api/cockpit/plugin/zeta/static/app\"}],"
          + "\"tasklist\":[],\"welcome\":[]}");
    }
  }

  @Test
  public void shouldKeepPluginIdsFromEndingTheScriptElement() throws Exception {
    assertThat(ProcessEnginesFilter.toJsonString("a\"b\\c</script>&\n")).isEqualTo("\"a\\\"b\\\\c\\u003c/script\\u003e\\u0026\\u000a\"");
  }

  protected AppPlugin plugin(String id) {
    return new AbstractAppPlugin() {
      public String getId() {
        return id;
      }
    };
  }

  protected MockHttpServletResponse get(String uri) throws Exception {
    return get(uri, new MockFilterChain());
  }

  protected MockHttpServletResponse get(String uri, MockFilterChain chain) throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest(servletContext, "GET", CONTEXT_PATH + uri);
    request.setContextPath(CONTEXT_PATH);
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, chain);
    return response;
  }
}
