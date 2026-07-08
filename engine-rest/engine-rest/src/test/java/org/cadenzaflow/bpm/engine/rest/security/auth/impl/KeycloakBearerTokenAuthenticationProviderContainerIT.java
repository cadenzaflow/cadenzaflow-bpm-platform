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
import static org.mockito.Mockito.when;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.rest.security.auth.AuthenticationResult;
import org.junit.AfterClass;
import org.junit.Assume;
import org.junit.BeforeClass;
import org.junit.Test;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * <p>
 * Container integration test: validates the provider against a REAL Keycloak
 * (Testcontainers) — covering everything the unit tests' in-memory JWKS cannot:
 * the URL-based JWKS fetch/cache path, real token shapes from the
 * {@code client_credentials} and {@code password} grants, and the real-world
 * audience behavior (Keycloak access tokens typically carry
 * {@code aud=account} and the client id only in {@code azp} — the reason the
 * {@code audience-mode} configuration exists).
 * </p>
 *
 * <p>
 * NOT part of the default surefire run (IT suffix). Run explicitly:
 * {@code mvn -pl engine-rest/engine-rest test
 * -Dtest=KeycloakBearerTokenAuthenticationProviderContainerIT}. Requires
 * Docker; skips (JUnit assume) when unavailable.
 * </p>
 *
 * <p>
 * Modern Docker engines (25+) raised the minimum API version above
 * docker-java's non-negotiated default (1.32) — without help, Testcontainers'
 * detection fails with an empty HTTP 400 on {@code /info}. docker-java honors
 * the {@code api.version} SYSTEM property (not docker CLI's
 * {@code DOCKER_API_VERSION} env var), so this class pins it in a static
 * initializer before any Testcontainers class loads.
 * </p>
 */
public class KeycloakBearerTokenAuthenticationProviderContainerIT {

  static {
    // Docker 25+: daemon min API > docker-java's non-negotiated 1.32 default.
    // 1.44 is supported by every 2024+ engine; override externally if needed.
    if (System.getProperty("api.version") == null) {
      System.setProperty("api.version", "1.44");
    }
  }

  protected static final String REALM = "cadenzaflow";
  protected static final String CLIENT_ID = "cadenzaflow-rest";
  protected static final String CLIENT_SECRET = "test-secret";
  protected static final DockerImageName KEYCLOAK_IMAGE = DockerImageName.parse("quay.io/keycloak/keycloak:26.0");

  protected static GenericContainer<?> keycloak;
  protected static String issuer;

  @BeforeClass
  public static void startKeycloak() {
    Assume.assumeTrue("Docker is not available - skipping Keycloak container IT",
        DockerClientFactory.instance().isDockerAvailable());

    keycloak = new GenericContainer<>(KEYCLOAK_IMAGE)
        .withEnv("KC_BOOTSTRAP_ADMIN_USERNAME", "admin")
        .withEnv("KC_BOOTSTRAP_ADMIN_PASSWORD", "admin")
        .withCopyFileToContainer(
            MountableFile.forClasspathResource("keycloak/cadenzaflow-realm.json"),
            "/opt/keycloak/data/import/cadenzaflow-realm.json")
        .withCommand("start-dev", "--import-realm")
        .withExposedPorts(8080)
        .waitingFor(Wait.forHttp("/realms/" + REALM).forPort(8080)
            .withStartupTimeout(Duration.ofMinutes(3)));
    keycloak.start();

    issuer = "http://" + keycloak.getHost() + ":" + keycloak.getMappedPort(8080) + "/realms/" + REALM;
  }

  @AfterClass
  public static void stopKeycloak() {
    if (keycloak != null) {
      keycloak.stop();
    }
  }

  // helpers

  protected static String fetchToken(String form) throws Exception {
    // Plain blocking HttpURLConnection on purpose: java.net.http.HttpClient's
    // internal NIO Selector cannot open its loopback pipe on this host (the
    // same mechanism nimbus's JWKS retriever avoids, for the same reason).
    HttpURLConnection connection = (HttpURLConnection) new URL(issuer + "/protocol/openid-connect/token")
        .openConnection();
    connection.setRequestMethod("POST");
    connection.setDoOutput(true);
    connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
    OutputStream out = connection.getOutputStream();
    try {
      out.write(form.getBytes(StandardCharsets.UTF_8));
    } finally {
      out.close();
    }

    int status = connection.getResponseCode();
    InputStream in = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
    String body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    assertThat(status).as("token endpoint response: %s", body).isEqualTo(200);
    return new ObjectMapper().readTree(body).get("access_token").asText();
  }

  protected static String clientCredentialsToken() throws Exception {
    return fetchToken("grant_type=client_credentials&client_id=" + CLIENT_ID + "&client_secret=" + CLIENT_SECRET);
  }

  protected static String passwordToken() throws Exception {
    return fetchToken("grant_type=password&client_id=" + CLIENT_ID + "&client_secret=" + CLIENT_SECRET
        + "&username=kermit&password=kermit");
  }

  /** Real provider: URL-based JWKS (derived from the issuer, Keycloak convention). */
  protected KeycloakBearerTokenAuthenticationProvider provider(String audienceMode) throws Exception {
    Map<String, String> params = new HashMap<String, String>();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, issuer);
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE, CLIENT_ID);
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, audienceMode);

    KeycloakBearerTokenAuthenticationProvider provider = new KeycloakBearerTokenAuthenticationProvider();
    provider.configure(params);
    return provider;
  }

  protected AuthenticationResult authenticate(KeycloakBearerTokenAuthenticationProvider provider, String token) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
    return provider.extractAuthenticatedUser(request, mock(ProcessEngine.class));
  }

  // tests

  @Test
  public void clientCredentialsTokenAuthenticatesInAzpMode() throws Exception {
    AuthenticationResult result = authenticate(provider("azp"), clientCredentialsToken());

    assertThat(result.isAuthenticated()).isTrue();
    // Keycloak convention: the service account user of the client
    assertThat(result.getAuthenticatedUser()).isEqualTo("service-account-" + CLIENT_ID);
    assertThat(result.getGroups()).isNull(); // groups resolve via IdentityService, never from the token
  }

  @Test
  public void clientCredentialsTokenFailsInDefaultAudMode() throws Exception {
    // Real Keycloak access tokens carry aud=account (not our client id) — the
    // documented reason audience-mode azp|any exists. If this ever starts
    // passing, Keycloak changed its default aud contents; re-evaluate D-4/§4.1.
    AuthenticationResult result = authenticate(provider("aud"), clientCredentialsToken());

    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void passwordGrantTokenAuthenticatesUser() throws Exception {
    AuthenticationResult result = authenticate(provider("any"), passwordToken());

    assertThat(result.isAuthenticated()).isTrue();
    assertThat(result.getAuthenticatedUser()).isEqualTo("kermit");
  }

  @Test
  public void tamperedTokenIsRejected() throws Exception {
    String token = passwordToken();
    // flip a character in the payload part
    int dot = token.indexOf('.') + 5;
    char original = token.charAt(dot);
    String tampered = token.substring(0, dot) + (original == 'A' ? 'B' : 'A') + token.substring(dot + 1);

    AuthenticationResult result = authenticate(provider("any"), tampered);

    assertThat(result.isAuthenticated()).isFalse();
  }

  @Test
  public void tokenFromAnotherRealmIsRejected() throws Exception {
    // provider configured for a different issuer must reject our realm's token
    Map<String, String> params = new HashMap<String, String>();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, issuer + "-other");
    params.put(KeycloakProviderConfig.PARAM_JWKS_URI, issuer + "/protocol/openid-connect/certs");
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE, CLIENT_ID);
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, "any");
    KeycloakBearerTokenAuthenticationProvider wrongIssuerProvider = new KeycloakBearerTokenAuthenticationProvider();
    wrongIssuerProvider.configure(params);

    AuthenticationResult result = authenticate(wrongIssuerProvider, passwordToken());

    assertThat(result.isAuthenticated()).isFalse();
  }
}
