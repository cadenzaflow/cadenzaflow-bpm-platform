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
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.cadenzaflow.bpm.engine.IdentityService;
import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.security.auth.AuthenticationResult;
import org.junit.BeforeClass;
import org.junit.Test;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/**
 * Unit tests for {@link CompositeAuthenticationProvider}: scheme dispatch
 * (Bearer → Keycloak, Basic/none → HTTP Basic) and the dual
 * {@code WWW-Authenticate} challenge. Uses an in-memory JWKS — no network.
 */
public class CompositeAuthenticationProviderTest {

  protected static final String ISSUER = "https://idp.example.com/realms/cadenzaflow";
  protected static final String AUDIENCE = "cadenzaflow-rest";

  protected static RSAKey signingKey;

  @BeforeClass
  public static void setUpClass() throws Exception {
    signingKey = new RSAKeyGenerator(2048).keyID("primary").generate();
  }

  protected CompositeAuthenticationProvider provider() throws Exception {
    KeycloakBearerTokenAuthenticationProvider bearerProvider = new KeycloakBearerTokenAuthenticationProvider() {
      @Override
      protected BearerTokenValidator createValidator(KeycloakProviderConfig config) {
        return new BearerTokenValidator(config,
            new ImmutableJWKSet<SecurityContext>(new JWKSet(signingKey.toPublicJWK())));
      }
    };

    CompositeAuthenticationProvider provider =
        new CompositeAuthenticationProvider(bearerProvider, new HttpBasicAuthenticationProvider());

    Map<String, String> params = new HashMap<String, String>();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, ISSUER);
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE, AUDIENCE);
    provider.configure(params);
    return provider;
  }

  protected HttpServletRequest request(String authorizationHeader) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Authorization")).thenReturn(authorizationHeader);
    return request;
  }

  @Test
  public void bearerRequestIsRoutedToKeycloakProvider() throws Exception {
    JWTClaimsSet claims = new JWTClaimsSet.Builder()
        .issuer(ISSUER)
        .audience(AUDIENCE)
        .expirationTime(new Date(System.currentTimeMillis() + 300000L))
        .claim("preferred_username", "kermit")
        .build();
    SignedJWT jwt = new SignedJWT(
        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signingKey.getKeyID()).build(), claims);
    jwt.sign(new RSASSASigner(signingKey));

    AuthenticationResult result = provider()
        .extractAuthenticatedUser(request("Bearer " + jwt.serialize()), mock(ProcessEngine.class));

    assertThat(result.isAuthenticated()).isTrue();
    assertThat(result.getAuthenticatedUser()).isEqualTo("kermit");
  }

  @Test
  public void basicRequestIsRoutedToBasicProvider() throws Exception {
    ProcessEngine engine = mock(ProcessEngine.class);
    IdentityService identityService = mock(IdentityService.class);
    when(engine.getIdentityService()).thenReturn(identityService);
    when(identityService.checkPassword("kermit", "kermit")).thenReturn(true);

    // "kermit:kermit" base64
    AuthenticationResult result = provider()
        .extractAuthenticatedUser(request("Basic a2VybWl0Omtlcm1pdA=="), engine);

    assertThat(result.isAuthenticated()).isTrue();
    assertThat(result.getAuthenticatedUser()).isEqualTo("kermit");
  }

  @Test
  public void missingHeaderTakesBasicPathAndIsUnsuccessful() throws Exception {
    AuthenticationResult result = provider().extractAuthenticatedUser(request(null), mock(ProcessEngine.class));

    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void challengeAdvertisesBothSchemesWithoutOverwriting() throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    ProcessEngine engine = mock(ProcessEngine.class);
    when(engine.getName()).thenReturn("default");

    provider().augmentResponseByAuthenticationChallenge(response, engine);

    // both schemes via addHeader — setHeader would overwrite (Phase 4 review FINDING-001)
    verify(response).addHeader("WWW-Authenticate", "Bearer realm=\"default\"");
    verify(response).addHeader("WWW-Authenticate", "Basic realm=\"default\"");
    verifyNoMoreInteractions(response);
  }
}
