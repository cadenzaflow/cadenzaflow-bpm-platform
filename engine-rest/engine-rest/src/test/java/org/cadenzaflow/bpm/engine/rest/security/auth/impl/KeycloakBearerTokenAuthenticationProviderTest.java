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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.security.auth.AuthenticationResult;
import org.junit.BeforeClass;
import org.junit.Test;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/**
 * Unit tests for {@link KeycloakBearerTokenAuthenticationProvider}: token
 * validation against a locally generated RSA key exposed as an in-memory JWKS
 * ({@link ImmutableJWKSet}) — no network, no container. The URL-backed JWKS
 * fetch/cache path is covered by the Keycloak container IT.
 */
public class KeycloakBearerTokenAuthenticationProviderTest {

  protected static final String ISSUER = "https://idp.example.com/realms/cadenzaflow";
  protected static final String AUDIENCE = "cadenzaflow-rest";

  protected static RSAKey signingKey;    // published in the JWKS
  protected static RSAKey rogueKey;      // same kid, different key → bad signature
  protected static RSAKey unknownKidKey; // kid not in the JWKS

  @BeforeClass
  public static void setUpClass() throws Exception {
    signingKey = new RSAKeyGenerator(2048).keyID("primary").generate();
    rogueKey = new RSAKeyGenerator(2048).keyID("primary").generate();
    unknownKidKey = new RSAKeyGenerator(2048).keyID("unknown").generate();
  }

  // helpers

  /** Provider whose validator uses the in-memory JWKS instead of a URL fetch. */
  protected static KeycloakBearerTokenAuthenticationProvider inMemoryJwksProvider() {
    return new KeycloakBearerTokenAuthenticationProvider() {
      @Override
      protected BearerTokenValidator createValidator(KeycloakProviderConfig config) {
        return new BearerTokenValidator(config,
            new ImmutableJWKSet<SecurityContext>(new JWKSet(signingKey.toPublicJWK())));
      }
    };
  }

  protected KeycloakBearerTokenAuthenticationProvider provider() throws Exception {
    return provider(new HashMap<String, String>());
  }

  protected KeycloakBearerTokenAuthenticationProvider provider(Map<String, String> extraParams) throws Exception {
    Map<String, String> params = new HashMap<String, String>();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, ISSUER);
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE, AUDIENCE);
    params.putAll(extraParams);

    KeycloakBearerTokenAuthenticationProvider provider = inMemoryJwksProvider();
    provider.configure(params);
    return provider;
  }

  protected JWTClaimsSet.Builder defaultClaims() {
    return new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .audience(AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit");
  }

  protected String sign(RSAKey key, JWTClaimsSet claims) throws Exception {
    SignedJWT jwt = new SignedJWT(
        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
        claims);
    jwt.sign(new RSASSASigner(key));
    return jwt.serialize();
  }

  protected HttpServletRequest request(String authorizationHeader) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Authorization")).thenReturn(authorizationHeader);
    return request;
  }

  protected AuthenticationResult authenticate(KeycloakBearerTokenAuthenticationProvider provider, String token) {
    return provider.extractAuthenticatedUser(request("Bearer " + token), mock(ProcessEngine.class));
  }

  // happy path + username claims

  @Test
  public void validTokenAuthenticatesPreferredUsername() throws Exception {
    AuthenticationResult result = authenticate(provider(), sign(signingKey, defaultClaims().build()));

    assertThat(result.isAuthenticated()).isTrue();
    assertThat(result.getAuthenticatedUser()).isEqualTo("kermit");
    // groups deliberately NOT taken from the token — the filter resolves them via the IdentityService
    assertThat(result.getGroups()).isNull();
    assertThat(result.getTenants()).isNull();
  }

  @Test
  public void usernameFallsBackToSubClaim() throws Exception {
    JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .audience(AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .subject("service-account-worker")
        .build();

    AuthenticationResult result = authenticate(provider(), sign(signingKey, claims));

    assertThat(result.isAuthenticated()).isTrue();
    assertThat(result.getAuthenticatedUser()).isEqualTo("service-account-worker");
  }

  @Test
  public void missingUsernameAndSubjectIsUnsuccessful() throws Exception {
    JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .audience(AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  // expiry / nbf / clock skew

  @Test
  public void expiredTokenBeyondSkewIsUnsuccessful() throws Exception {
    JWTClaimsSet claims = defaultClaims()
        .expirationTime(new Date(System.currentTimeMillis() - 600000L))
        .build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  @Test
  public void expiredTokenWithinSkewIsAccepted() throws Exception {
    JWTClaimsSet claims = defaultClaims()
        .expirationTime(new Date(System.currentTimeMillis() - 30000L)) // 30 s ago, default skew 60 s
        .build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isTrue();
  }

  @Test
  public void notYetValidTokenBeyondSkewIsUnsuccessful() throws Exception {
    JWTClaimsSet claims = defaultClaims()
        .notBeforeTime(new Date(System.currentTimeMillis() + 600000L))
        .build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  // issuer / audience

  @Test
  public void wrongIssuerIsUnsuccessful() throws Exception {
    JWTClaimsSet claims = defaultClaims().issuer("https://evil.example.com/realms/other").build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  @Test
  public void wrongAudienceIsUnsuccessful() throws Exception {
    JWTClaimsSet claims = defaultClaims().audience("some-other-client").build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  @Test
  public void azpOnlyTokenFailsInDefaultAudMode() throws Exception {
    // Keycloak client_credentials tokens often have azp but no aud
    JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .claim("azp", AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit")
        .build();

    assertThat(authenticate(provider(), sign(signingKey, claims)).isAuthenticated()).isFalse();
  }

  @Test
  public void azpOnlyTokenPassesInAzpMode() throws Exception {
    Map<String, String> extra = new HashMap<String, String>();
    extra.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, "azp");

    JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .claim("azp", AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit")
        .build();

    assertThat(authenticate(provider(extra), sign(signingKey, claims)).isAuthenticated()).isTrue();
  }

  @Test
  public void anyModeAcceptsAudOrAzp() throws Exception {
    Map<String, String> extra = new HashMap<String, String>();
    extra.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, "any");

    JWTClaimsSet azpOnly = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .claim("azp", AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit")
        .build();
    assertThat(authenticate(provider(extra), sign(signingKey, azpOnly)).isAuthenticated()).isTrue();

    JWTClaimsSet audOnly = defaultClaims().build();
    assertThat(authenticate(provider(extra), sign(signingKey, audOnly)).isAuthenticated()).isTrue();

    JWTClaimsSet neither = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .claim("azp", "some-other-client")
        .audience("some-other-client")
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit")
        .build();
    assertThat(authenticate(provider(extra), sign(signingKey, neither)).isAuthenticated()).isFalse();
  }

  // signature / key / algorithm

  @Test
  public void badSignatureIsUnsuccessful() throws Exception {
    // same kid as the published key, but a different private key
    assertThat(authenticate(provider(), sign(rogueKey, defaultClaims().build())).isAuthenticated()).isFalse();
  }

  @Test
  public void unknownKidIsUnsuccessful() throws Exception {
    assertThat(authenticate(provider(), sign(unknownKidKey, defaultClaims().build())).isAuthenticated()).isFalse();
  }

  @Test
  public void hmacSignedTokenIsRejected() throws Exception {
    SignedJWT jwt = new SignedJWT(
        new JWSHeader.Builder(JWSAlgorithm.HS256).keyID("primary").build(),
        defaultClaims().build());
    jwt.sign(new MACSigner("01234567890123456789012345678901".getBytes(StandardCharsets.UTF_8)));

    assertThat(authenticate(provider(), jwt.serialize()).isAuthenticated()).isFalse();
  }

  // header handling

  @Test
  public void malformedTokenIsUnsuccessful() throws Exception {
    assertThat(authenticate(provider(), "not.a.jwt").isAuthenticated()).isFalse();
  }

  @Test
  public void missingHeaderIsUnsuccessful() throws Exception {
    AuthenticationResult result = provider().extractAuthenticatedUser(request(null), mock(ProcessEngine.class));
    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void nonBearerHeaderIsUnsuccessful() throws Exception {
    AuthenticationResult result = provider()
        .extractAuthenticatedUser(request("Basic a2VybWl0Omtlcm1pdA=="), mock(ProcessEngine.class));
    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void emptyBearerTokenIsUnsuccessful() throws Exception {
    AuthenticationResult result = provider().extractAuthenticatedUser(request("Bearer    "), mock(ProcessEngine.class));
    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void unconfiguredProviderIsUnsuccessfulInsteadOfFailing() {
    KeycloakBearerTokenAuthenticationProvider unconfigured = new KeycloakBearerTokenAuthenticationProvider();
    AuthenticationResult result = unconfigured
        .extractAuthenticatedUser(request("Bearer whatever"), mock(ProcessEngine.class));
    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void misconfigurationFailsAtConfigureTime() {
    KeycloakBearerTokenAuthenticationProvider provider = inMemoryJwksProvider();
    Map<String, String> params = new HashMap<String, String>(); // issuer + audience missing

    try {
      provider.configure(params);
      throw new AssertionError("expected ServletException");
    } catch (ServletException expected) {
      // deploy-time fail-fast
    }
  }

  // challenge

  @Test
  public void challengeIsRealmOnlyBearer() throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    ProcessEngine engine = mock(ProcessEngine.class);
    when(engine.getName()).thenReturn("default");

    provider().augmentResponseByAuthenticationChallenge(response, engine);

    // realm-only, no error attribute (RFC 6750 §3 — cannot distinguish missing vs invalid credentials)
    verify(response).setHeader("WWW-Authenticate", "Bearer realm=\"default\"");
  }
}
