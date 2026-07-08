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
package org.cadenzaflow.bpm.engine.rest.security.auth.impl;

import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.core.HttpHeaders;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.security.auth.AuthenticationProvider;
import org.cadenzaflow.bpm.engine.rest.security.auth.AuthenticationResult;
import org.cadenzaflow.bpm.engine.rest.security.auth.ConfigurableAuthenticationProvider;

/**
 * <p>
 * Mixed-mode authentication: dispatches on the {@code Authorization} scheme.
 * {@code Bearer} requests are validated as Keycloak OIDC tokens
 * ({@link KeycloakBearerTokenAuthenticationProvider}); everything else —
 * {@code Basic} or no header — takes today's HTTP Basic path
 * ({@link HttpBasicAuthenticationProvider}), unchanged. This is the
 * backward-compatible migration mode: existing Basic clients keep working
 * while OIDC clients move to tokens.
 * </p>
 */
public class CompositeAuthenticationProvider
    implements AuthenticationProvider, ConfigurableAuthenticationProvider {

  protected final KeycloakBearerTokenAuthenticationProvider bearerProvider;
  protected final HttpBasicAuthenticationProvider basicProvider;

  public CompositeAuthenticationProvider() {
    this(new KeycloakBearerTokenAuthenticationProvider(), new HttpBasicAuthenticationProvider());
  }

  /** Composition seam (also used by tests to inject an in-memory-JWKS bearer provider). */
  public CompositeAuthenticationProvider(KeycloakBearerTokenAuthenticationProvider bearerProvider,
      HttpBasicAuthenticationProvider basicProvider) {
    this.bearerProvider = bearerProvider;
    this.basicProvider = basicProvider;
  }

  @Override
  public void configure(Map<String, String> parameters) throws ServletException {
    // only the bearer side needs configuration; Basic has none
    bearerProvider.configure(parameters);
  }

  @Override
  public AuthenticationResult extractAuthenticatedUser(HttpServletRequest request, ProcessEngine engine) {
    String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

    if (authorizationHeader != null
        && authorizationHeader.startsWith(KeycloakBearerTokenAuthenticationProvider.BEARER_AUTH_HEADER_PREFIX)) {
      return bearerProvider.extractAuthenticatedUser(request, engine);
    }

    // Basic or no header: byte-for-byte today's behavior
    return basicProvider.extractAuthenticatedUser(request, engine);
  }

  @Override
  public void augmentResponseByAuthenticationChallenge(HttpServletResponse response, ProcessEngine engine) {
    // The underlying providers both use setHeader(), which would overwrite each
    // other (only the last scheme would be advertised). Emit both challenges here
    // with addHeader() so a client sees Bearer AND Basic; realm-only per RFC 6750
    // (see KeycloakBearerTokenAuthenticationProvider).
    response.addHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer realm=\"" + engine.getName() + "\"");
    response.addHeader(HttpHeaders.WWW_AUTHENTICATE, "Basic realm=\"" + engine.getName() + "\"");
  }
}
