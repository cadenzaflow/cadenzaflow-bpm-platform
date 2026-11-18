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
package org.cadenzaflow.bpm.webapp.impl.security.auth;

import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;

import javax.servlet.FilterChain;
import javax.ws.rs.core.Response.Status;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.helper.MockProvider;
import org.cadenzaflow.bpm.engine.rest.security.auth.ProcessEngineAuthenticationFilter;
import org.cadenzaflow.bpm.engine.rest.security.auth.impl.ContainerBasedAuthenticationProvider;
import org.cadenzaflow.bpm.webapp.impl.util.ProcessEngineUtil;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.mock.web.MockFilterConfig;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * The container authenticated a user the engine's identity provider does not know:
 * {@link AuthenticationUtil#createAuthentication} answers {@code null}. The filter must
 * answer 401 and stop, not hand the {@code null} to
 * {@link Authentications#addOrReplace(UserAuthentication)} (which threw a
 * NullPointerException, a 500 for the user).
 */
public class ContainerAuthenticationFilterUnknownUserTest {

  protected static final String SERVICE_PATH = "/cadenzaflow";

  private MockedStatic<AuthenticationUtil> authenticationUtilMockedStatic;
  private MockedStatic<ProcessEngineUtil> processEngineUtilMockedStatic;
  private Authentications authentications;
  private ContainerBasedAuthenticationFilter authenticationFilter;

  @Before
  public void setup() throws Exception {
    ProcessEngine engine = mock(ProcessEngine.class);
    processEngineUtilMockedStatic = mockStatic(ProcessEngineUtil.class);
    processEngineUtilMockedStatic.when(() -> ProcessEngineUtil.lookupProcessEngine(any()))
        .thenReturn(engine);

    Authentications.clearCurrent();
    authentications = mock(Authentications.class);
    authenticationUtilMockedStatic = mockStatic(AuthenticationUtil.class);
    authenticationUtilMockedStatic.when(() -> AuthenticationUtil.getAuthsFromSession(any()))
        .thenReturn(authentications);
    // the identity provider has no such user
    authenticationUtilMockedStatic
        .when(() -> AuthenticationUtil.createAuthentication(any(ProcessEngine.class), any(), any(), any()))
        .thenReturn(null);

    MockFilterConfig config = new MockFilterConfig();
    config.addInitParameter(ProcessEngineAuthenticationFilter.AUTHENTICATION_PROVIDER_PARAM,
        ContainerBasedAuthenticationProvider.class.getName());
    authenticationFilter = new ContainerBasedAuthenticationFilter();
    authenticationFilter.init(config);
  }

  @After
  public void teardown() {
    authenticationUtilMockedStatic.close();
    processEngineUtilMockedStatic.close();
  }

  @Test
  public void shouldAnswerUnauthorizedForAUserUnknownToTheIdentityProvider() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setRequestURI(SERVICE_PATH + "/app/cockpit/default/");
    request.setContextPath(SERVICE_PATH);
    request.setMethod("GET");
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(MockProvider.EXAMPLE_USER_ID);
    request.setUserPrincipal(principal);
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    authenticationFilter.doFilter(request, response, chain);

    Assert.assertEquals(Status.UNAUTHORIZED.getStatusCode(), response.getStatus());
    verify(authentications, never()).addOrReplace(any());
    verify(chain, never()).doFilter(any(), any());
  }
}
