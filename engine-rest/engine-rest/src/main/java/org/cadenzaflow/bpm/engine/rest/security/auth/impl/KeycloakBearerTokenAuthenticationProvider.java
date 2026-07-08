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

import com.nimbusds.jwt.JWTClaimsSet;

/**
 * <p>
 * Authenticates a request by validating a Keycloak (OIDC) JWT access token
 * from the {@code Authorization: Bearer} header — offline, against the
 * issuer's cached JWKS ({@link BearerTokenValidator}). How the client obtained
 * the token ({@code client_credentials}, {@code password}, ...) is
 * deliberately irrelevant here: any valid JWT from the configured issuer is
 * accepted.
 * </p>
 *
 * <p>
 * On success only the user id (from the configured username claim, default
 * {@code preferred_username}, fallback {@code sub}) is returned — groups and
 * tenants are deliberately NOT read from the token; they resolve through the
 * engine's {@code IdentityService} (see
 * {@code ProcessEngineAuthenticationFilter#setAuthenticatedUser}), which is
 * backed by the Keycloak identity provider plugin when configured. One
 * identity source for webapps and REST.
 * </p>
 *
 * <p>
 * Configuration comes from filter init-params via
 * {@link ConfigurableAuthenticationProvider#configure(Map)} — see
 * {@link KeycloakProviderConfig} for the parameter reference. The
 * {@code "Bearer "} prefix match is case-sensitive by choice, consistent with
 * {@link HttpBasicAuthenticationProvider}'s {@code "Basic "} handling.
 * </p>
 */
public class KeycloakBearerTokenAuthenticationProvider
    implements AuthenticationProvider, ConfigurableAuthenticationProvider {

  protected static final String BEARER_AUTH_HEADER_PREFIX = "Bearer ";

  protected BearerTokenValidator validator;
  protected String usernameClaim = "preferred_username";
  protected String fallbackClaim = "sub";

  @Override
  public void configure(Map<String, String> parameters) throws ServletException {
    KeycloakProviderConfig config = KeycloakProviderConfig.fromInitParams(parameters);
    this.usernameClaim = config.usernameClaim();
    this.fallbackClaim = config.fallbackClaim();
    this.validator = createValidator(config);
  }

  /** Seam for tests: override to supply a validator with an in-memory JWKS. */
  protected BearerTokenValidator createValidator(KeycloakProviderConfig config) throws ServletException {
    return new BearerTokenValidator(config);
  }

  @Override
  public AuthenticationResult extractAuthenticatedUser(HttpServletRequest request, ProcessEngine engine) {
    String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

    if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_AUTH_HEADER_PREFIX)) {
      return AuthenticationResult.unsuccessful();
    }

    if (validator == null) {
      // configure(Map) was never called (provider used outside the filter without
      // configuration) — treat as unauthenticated rather than failing with an NPE
      return AuthenticationResult.unsuccessful();
    }

    String token = authorizationHeader.substring(BEARER_AUTH_HEADER_PREFIX.length()).trim();
    if (token.isEmpty()) {
      return AuthenticationResult.unsuccessful();
    }

    try {
      JWTClaimsSet claims = validator.validate(token);

      String user = claims.getStringClaim(usernameClaim);
      if (user == null || user.isEmpty()) {
        user = claims.getStringClaim(fallbackClaim);
      }
      if (user == null || user.isEmpty()) {
        return AuthenticationResult.unsuccessful();
      }

      // no groups/tenants: the filter resolves them via the IdentityService
      return AuthenticationResult.successful(user);
    } catch (Exception e) {
      // never leak the token or the specific validation failure to the caller
      return AuthenticationResult.unsuccessful();
    }
  }

  @Override
  public void augmentResponseByAuthenticationChallenge(HttpServletResponse response, ProcessEngine engine) {
    // Realm-only challenge: this callback fires for EVERY 401 — including requests
    // that sent no Authorization header at all — and RFC 6750 §3 forbids an error
    // code when no credentials were presented. The callback cannot distinguish
    // missing vs. invalid, so the error attribute is omitted.
    response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer realm=\"" + engine.getName() + "\"");
  }
}
