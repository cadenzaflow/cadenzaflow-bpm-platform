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

import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import org.cadenzaflow.bpm.engine.rest.security.auth.impl.KeycloakProviderConfig.AudienceMode;

import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;

/**
 * <p>
 * Claim verification for Keycloak bearer tokens: one class owns the whole
 * claim rule. Issuer exact-match, {@code exp}/{@code nbf} (with clock-skew
 * tolerance) and — in {@link AudienceMode#AUD} mode — the audience check are
 * enforced by the {@link DefaultJWTClaimsVerifier} superclass; the
 * {@code azp}/{@code any} audience modes are enforced in
 * {@link #verify(JWTClaimsSet, SecurityContext)}.
 * </p>
 *
 * <p>
 * Keycloak {@code client_credentials} (service-account) tokens often carry the
 * client id only in {@code azp} and no {@code aud} claim at all — the
 * {@code azp}/{@code any} modes exist so that flow works instead of silently
 * failing with 401.
 * </p>
 */
public class KeycloakClaimsVerifier extends DefaultJWTClaimsVerifier<SecurityContext> {

  protected final KeycloakProviderConfig config;

  public KeycloakClaimsVerifier(KeycloakProviderConfig config) {
    super(
        // 4-arg constructor takes Set<String> acceptedAudience; null skips the
        // native aud check entirely (AZP/ANY modes enforce audience below)
        config.audienceMode() == AudienceMode.AUD
            ? Collections.singleton(config.audience())
            : null,
        new JWTClaimsSet.Builder().issuer(config.issuer()).build(),
        new HashSet<String>(Arrays.asList("exp")),
        null);
    setMaxClockSkew(config.clockSkewSeconds());
    this.config = config;
  }

  @Override
  public void verify(JWTClaimsSet claims, SecurityContext context) throws BadJWTException {
    super.verify(claims, context); // iss, exp/nbf (+skew); aud too when mode == AUD

    if (config.audienceMode() != AudienceMode.AUD) {
      String azp;
      try {
        azp = claims.getStringClaim("azp");
      } catch (ParseException e) {
        throw new BadJWTException("JWT azp claim is not a string", e);
      }

      boolean matches;
      if (config.audienceMode() == AudienceMode.AZP) {
        matches = config.audience().equals(azp);
      } else { // ANY: configured value in aud OR equals azp
        List<String> audience = claims.getAudience();
        matches = config.audience().equals(azp)
            || (audience != null && audience.contains(config.audience()));
      }

      if (!matches) {
        throw new BadJWTException("JWT audience/azp does not match the expected client");
      }
    }
  }
}
