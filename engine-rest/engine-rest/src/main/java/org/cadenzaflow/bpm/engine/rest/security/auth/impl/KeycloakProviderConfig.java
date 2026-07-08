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

import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import javax.servlet.ServletException;

import com.nimbusds.jose.JWSAlgorithm;

/**
 * <p>
 * Configuration holder for {@link KeycloakBearerTokenAuthenticationProvider},
 * parsed from the authentication filter's init-params (see
 * {@code ConfigurableAuthenticationProvider}). All parameters are non-secret
 * (URLs, ids, claim names, tolerances) — the provider only validates tokens
 * and never talks to the token endpoint, so no client secret is configured.
 * </p>
 *
 * <p>Parameters (defaults in parentheses):</p>
 * <ul>
 *   <li>{@code keycloak.issuer-uri} — required; expected {@code iss} claim value</li>
 *   <li>{@code keycloak.jwks-uri} — ({issuer}/protocol/openid-connect/certs, the
 *       Keycloak convention; set explicitly for other OIDC providers)</li>
 *   <li>{@code keycloak.audience} — required; expected {@code aud}/{@code azp} value</li>
 *   <li>{@code keycloak.audience-mode} — aud | azp | any (aud)</li>
 *   <li>{@code keycloak.username-claim} — (preferred_username)</li>
 *   <li>{@code keycloak.username-claim-fallback} — (sub)</li>
 *   <li>{@code keycloak.allowed-algorithms} — comma-separated JWS algorithms (RS256)</li>
 *   <li>{@code keycloak.clock-skew-seconds} — exp/nbf tolerance (60)</li>
 *   <li>{@code keycloak.jwks-cache-ttl-ms} — JWKS cache lifetime (300000)</li>
 *   <li>{@code keycloak.jwks-cache-refresh-timeout-ms} — max wait for a JWKS cache
 *       refresh operation (30000); NOT refresh-ahead</li>
 *   <li>{@code keycloak.jwks-min-interval-ms} — min interval between JWKS refetches,
 *       rate limit for unknown-kid bursts (30000)</li>
 * </ul>
 *
 * <p>Unknown parameters are ignored; missing/invalid required parameters fail
 * with a {@link ServletException} so that misconfiguration surfaces at
 * deployment time.</p>
 */
public class KeycloakProviderConfig {

  public enum AudienceMode {
    AUD, AZP, ANY
  }

  public static final String PARAM_ISSUER_URI = "keycloak.issuer-uri";
  public static final String PARAM_JWKS_URI = "keycloak.jwks-uri";
  public static final String PARAM_AUDIENCE = "keycloak.audience";
  public static final String PARAM_AUDIENCE_MODE = "keycloak.audience-mode";
  public static final String PARAM_USERNAME_CLAIM = "keycloak.username-claim";
  public static final String PARAM_USERNAME_CLAIM_FALLBACK = "keycloak.username-claim-fallback";
  public static final String PARAM_ALLOWED_ALGORITHMS = "keycloak.allowed-algorithms";
  public static final String PARAM_CLOCK_SKEW_SECONDS = "keycloak.clock-skew-seconds";
  public static final String PARAM_JWKS_CACHE_TTL_MS = "keycloak.jwks-cache-ttl-ms";
  public static final String PARAM_JWKS_CACHE_REFRESH_TIMEOUT_MS = "keycloak.jwks-cache-refresh-timeout-ms";
  public static final String PARAM_JWKS_MIN_INTERVAL_MS = "keycloak.jwks-min-interval-ms";

  protected static final String KEYCLOAK_CERTS_PATH = "/protocol/openid-connect/certs";

  protected final String issuer;
  protected final String jwksUri;
  protected final String audience;
  protected final AudienceMode audienceMode;
  protected final String usernameClaim;
  protected final String fallbackClaim;
  protected final Set<JWSAlgorithm> expectedAlgs;
  protected final int clockSkewSeconds;
  protected final long jwksCacheTtlMs;
  protected final long jwksCacheRefreshTimeoutMs;
  protected final long jwksMinIntervalMs;

  protected KeycloakProviderConfig(String issuer, String jwksUri, String audience, AudienceMode audienceMode,
      String usernameClaim, String fallbackClaim, Set<JWSAlgorithm> expectedAlgs, int clockSkewSeconds,
      long jwksCacheTtlMs, long jwksCacheRefreshTimeoutMs, long jwksMinIntervalMs) {
    this.issuer = issuer;
    this.jwksUri = jwksUri;
    this.audience = audience;
    this.audienceMode = audienceMode;
    this.usernameClaim = usernameClaim;
    this.fallbackClaim = fallbackClaim;
    this.expectedAlgs = expectedAlgs;
    this.clockSkewSeconds = clockSkewSeconds;
    this.jwksCacheTtlMs = jwksCacheTtlMs;
    this.jwksCacheRefreshTimeoutMs = jwksCacheRefreshTimeoutMs;
    this.jwksMinIntervalMs = jwksMinIntervalMs;
  }

  public static KeycloakProviderConfig fromInitParams(Map<String, String> parameters) throws ServletException {
    String issuer = required(parameters, PARAM_ISSUER_URI);
    String audience = required(parameters, PARAM_AUDIENCE);

    String jwksUri = trimmedOrNull(parameters.get(PARAM_JWKS_URI));
    if (jwksUri == null) {
      // Keycloak convention; non-Keycloak IdPs configure keycloak.jwks-uri explicitly
      String base = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
      jwksUri = base + KEYCLOAK_CERTS_PATH;
    }

    AudienceMode audienceMode = parseAudienceMode(parameters.get(PARAM_AUDIENCE_MODE));

    String usernameClaim = defaulted(parameters.get(PARAM_USERNAME_CLAIM), "preferred_username");
    String fallbackClaim = defaulted(parameters.get(PARAM_USERNAME_CLAIM_FALLBACK), "sub");

    Set<JWSAlgorithm> expectedAlgs = parseAlgorithms(defaulted(parameters.get(PARAM_ALLOWED_ALGORITHMS), "RS256"));

    int clockSkewSeconds = (int) parseNonNegativeLong(parameters, PARAM_CLOCK_SKEW_SECONDS, 60L);
    long jwksCacheTtlMs = parseNonNegativeLong(parameters, PARAM_JWKS_CACHE_TTL_MS, 300000L);
    long jwksCacheRefreshTimeoutMs = parseNonNegativeLong(parameters, PARAM_JWKS_CACHE_REFRESH_TIMEOUT_MS, 30000L);
    long jwksMinIntervalMs = parseNonNegativeLong(parameters, PARAM_JWKS_MIN_INTERVAL_MS, 30000L);

    return new KeycloakProviderConfig(issuer, jwksUri, audience, audienceMode, usernameClaim, fallbackClaim,
        expectedAlgs, clockSkewSeconds, jwksCacheTtlMs, jwksCacheRefreshTimeoutMs, jwksMinIntervalMs);
  }

  protected static String required(Map<String, String> parameters, String name) throws ServletException {
    String value = trimmedOrNull(parameters.get(name));
    if (value == null) {
      throw new ServletException("Cannot initialize Keycloak bearer token authentication: required init-param '"
          + name + "' is missing or empty");
    }
    return value;
  }

  protected static String trimmedOrNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  protected static String defaulted(String value, String defaultValue) {
    String trimmed = trimmedOrNull(value);
    return trimmed == null ? defaultValue : trimmed;
  }

  protected static AudienceMode parseAudienceMode(String value) throws ServletException {
    String mode = defaulted(value, "aud").toLowerCase(Locale.ROOT);
    if ("aud".equals(mode)) {
      return AudienceMode.AUD;
    } else if ("azp".equals(mode)) {
      return AudienceMode.AZP;
    } else if ("any".equals(mode)) {
      return AudienceMode.ANY;
    }
    throw new ServletException("Cannot initialize Keycloak bearer token authentication: init-param '"
        + PARAM_AUDIENCE_MODE + "' must be one of aud|azp|any but was '" + value + "'");
  }

  protected static Set<JWSAlgorithm> parseAlgorithms(String value) throws ServletException {
    Set<JWSAlgorithm> algorithms = new HashSet<JWSAlgorithm>();
    for (String name : value.split(",")) {
      String trimmed = name.trim();
      if (!trimmed.isEmpty()) {
        algorithms.add(JWSAlgorithm.parse(trimmed));
      }
    }
    if (algorithms.isEmpty()) {
      throw new ServletException("Cannot initialize Keycloak bearer token authentication: init-param '"
          + PARAM_ALLOWED_ALGORITHMS + "' must contain at least one JWS algorithm");
    }
    return algorithms;
  }

  protected static long parseNonNegativeLong(Map<String, String> parameters, String name, long defaultValue)
      throws ServletException {
    String value = trimmedOrNull(parameters.get(name));
    if (value == null) {
      return defaultValue;
    }
    try {
      long parsed = Long.parseLong(value);
      if (parsed < 0) {
        throw new NumberFormatException("negative");
      }
      return parsed;
    } catch (NumberFormatException e) {
      throw new ServletException("Cannot initialize Keycloak bearer token authentication: init-param '"
          + name + "' must be a non-negative number but was '" + value + "'");
    }
  }

  public String issuer() {
    return issuer;
  }

  public String jwksUri() {
    return jwksUri;
  }

  public String audience() {
    return audience;
  }

  public AudienceMode audienceMode() {
    return audienceMode;
  }

  public String usernameClaim() {
    return usernameClaim;
  }

  public String fallbackClaim() {
    return fallbackClaim;
  }

  public Set<JWSAlgorithm> expectedAlgs() {
    return expectedAlgs;
  }

  public int clockSkewSeconds() {
    return clockSkewSeconds;
  }

  public long jwksCacheTtlMs() {
    return jwksCacheTtlMs;
  }

  public long jwksCacheRefreshTimeoutMs() {
    return jwksCacheRefreshTimeoutMs;
  }

  public long jwksMinIntervalMs() {
    return jwksMinIntervalMs;
  }
}
