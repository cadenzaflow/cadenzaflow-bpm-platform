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

import java.net.MalformedURLException;
import java.net.URL;

import javax.servlet.ServletException;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

/**
 * <p>
 * Offline JWT validation for Keycloak bearer tokens, built on nimbus-jose-jwt.
 * Signature verification uses the issuer's JWKS, fetched once and cached
 * in-memory — there is <b>no per-request round trip</b> to the identity
 * provider. An unknown {@code kid} triggers a JWKS refetch, rate-limited by
 * {@code keycloak.jwks-min-interval-ms} so unknown-kid bursts cannot hammer
 * the IdP; after a key rotation the new key is picked up on the next refetch.
 * </p>
 *
 * <p>
 * All components are immutable after construction and safe for concurrent use
 * (one instance is shared across requests by the authentication filter).
 * </p>
 */
public class BearerTokenValidator {

  protected final DefaultJWTProcessor<SecurityContext> processor;

  public BearerTokenValidator(KeycloakProviderConfig config) throws ServletException {
    this(config, buildJwkSource(config));
  }

  /**
   * Seam for tests: allows an in-memory {@code JWKSource} (e.g.
   * {@code ImmutableJWKSet}) instead of the URL-backed cached source.
   */
  protected BearerTokenValidator(KeycloakProviderConfig config, JWKSource<SecurityContext> jwkSource) {
    DefaultJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<SecurityContext>();
    jwtProcessor.setJWSKeySelector(new JWSVerificationKeySelector<SecurityContext>(config.expectedAlgs(), jwkSource));
    jwtProcessor.setJWTClaimsSetVerifier(new KeycloakClaimsVerifier(config));
    this.processor = jwtProcessor;
  }

  protected static JWKSource<SecurityContext> buildJwkSource(KeycloakProviderConfig config) throws ServletException {
    URL jwksUrl;
    try {
      jwksUrl = new URL(config.jwksUri());
    } catch (MalformedURLException e) {
      throw new ServletException("Cannot initialize Keycloak bearer token authentication: JWKS URI '"
          + config.jwksUri() + "' is not a valid URL", e);
    }

    return JWKSourceBuilder.create(jwksUrl)
        .cache(config.jwksCacheTtlMs(), config.jwksCacheRefreshTimeoutMs())
        .rateLimited(config.jwksMinIntervalMs())
        .build();
  }

  /**
   * Validates the given serialized JWT: signature against the (cached) JWKS,
   * then all claim rules ({@link KeycloakClaimsVerifier}).
   *
   * @return the verified claims
   * @throws Exception
   *           if the token is malformed, unsigned, has a bad signature or
   *           violates any claim rule ({@code ParseException},
   *           {@code BadJOSEException}, {@code BadJWTException}, ...)
   */
  public JWTClaimsSet validate(String token) throws Exception {
    return processor.process(SignedJWT.parse(token), null);
  }
}
