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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;

import org.cadenzaflow.bpm.engine.rest.security.auth.impl.KeycloakProviderConfig.AudienceMode;
import org.junit.Test;

import com.nimbusds.jose.JWSAlgorithm;

public class KeycloakProviderConfigTest {

  protected Map<String, String> minimalParams() {
    Map<String, String> params = new HashMap<String, String>();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, "https://idp.example.com/realms/cadenzaflow");
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE, "cadenzaflow-rest");
    return params;
  }

  @Test
  public void minimalConfigurationAppliesDocumentedDefaults() throws Exception {
    KeycloakProviderConfig config = KeycloakProviderConfig.fromInitParams(minimalParams());

    assertThat(config.issuer()).isEqualTo("https://idp.example.com/realms/cadenzaflow");
    assertThat(config.audience()).isEqualTo("cadenzaflow-rest");
    assertThat(config.audienceMode()).isEqualTo(AudienceMode.AUD);
    assertThat(config.usernameClaim()).isEqualTo("preferred_username");
    assertThat(config.fallbackClaim()).isEqualTo("sub");
    assertThat(config.expectedAlgs()).containsExactly(JWSAlgorithm.RS256);
    assertThat(config.clockSkewSeconds()).isEqualTo(60);
    assertThat(config.jwksCacheTtlMs()).isEqualTo(300000L);
    assertThat(config.jwksCacheRefreshTimeoutMs()).isEqualTo(30000L);
    assertThat(config.jwksMinIntervalMs()).isEqualTo(30000L);
  }

  @Test
  public void jwksUriIsDerivedFromIssuerWithKeycloakConvention() throws Exception {
    assertThat(KeycloakProviderConfig.fromInitParams(minimalParams()).jwksUri())
        .isEqualTo("https://idp.example.com/realms/cadenzaflow/protocol/openid-connect/certs");
  }

  @Test
  public void jwksUriDerivationHandlesTrailingSlash() throws Exception {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, "https://idp.example.com/realms/cadenzaflow/");

    assertThat(KeycloakProviderConfig.fromInitParams(params).jwksUri())
        .isEqualTo("https://idp.example.com/realms/cadenzaflow/protocol/openid-connect/certs");
  }

  @Test
  public void explicitJwksUriWins() throws Exception {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_JWKS_URI, "https://generic-idp.example.com/jwks.json");

    assertThat(KeycloakProviderConfig.fromInitParams(params).jwksUri())
        .isEqualTo("https://generic-idp.example.com/jwks.json");
  }

  @Test
  public void missingIssuerFailsFast() {
    Map<String, String> params = minimalParams();
    params.remove(KeycloakProviderConfig.PARAM_ISSUER_URI);

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class)
        .hasMessageContaining(KeycloakProviderConfig.PARAM_ISSUER_URI);
  }

  @Test
  public void missingAudienceFailsFast() {
    Map<String, String> params = minimalParams();
    params.remove(KeycloakProviderConfig.PARAM_AUDIENCE);

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class)
        .hasMessageContaining(KeycloakProviderConfig.PARAM_AUDIENCE);
  }

  @Test
  public void blankRequiredParameterCountsAsMissing() {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_ISSUER_URI, "   ");

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class);
  }

  @Test
  public void invalidAudienceModeFailsFast() {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, "bogus");

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class)
        .hasMessageContaining("aud|azp|any");
  }

  @Test
  public void audienceModeParsingIsCaseInsensitive() throws Exception {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_AUDIENCE_MODE, "AZP");

    assertThat(KeycloakProviderConfig.fromInitParams(params).audienceMode()).isEqualTo(AudienceMode.AZP);
  }

  @Test
  public void allowedAlgorithmsParsesCommaSeparatedList() throws Exception {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_ALLOWED_ALGORITHMS, "RS256, ES256");

    assertThat(KeycloakProviderConfig.fromInitParams(params).expectedAlgs())
        .containsExactlyInAnyOrder(JWSAlgorithm.RS256, JWSAlgorithm.ES256);
  }

  @Test
  public void negativeNumericParameterFailsFast() {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_CLOCK_SKEW_SECONDS, "-5");

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class)
        .hasMessageContaining(KeycloakProviderConfig.PARAM_CLOCK_SKEW_SECONDS);
  }

  @Test
  public void nonNumericParameterFailsFast() {
    Map<String, String> params = minimalParams();
    params.put(KeycloakProviderConfig.PARAM_JWKS_CACHE_TTL_MS, "five minutes");

    assertThatThrownBy(() -> KeycloakProviderConfig.fromInitParams(params))
        .isInstanceOf(ServletException.class)
        .hasMessageContaining(KeycloakProviderConfig.PARAM_JWKS_CACHE_TTL_MS);
  }

  @Test
  public void unknownParametersAreIgnored() throws Exception {
    Map<String, String> params = minimalParams();
    params.put("some-unrelated-filter-param", "value");

    assertThat(KeycloakProviderConfig.fromInitParams(params)).isNotNull();
  }
}
