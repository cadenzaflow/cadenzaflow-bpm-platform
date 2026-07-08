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
package org.cadenzaflow.bpm.engine.rest.security.auth;

import java.util.Map;

import javax.servlet.ServletException;

/**
 * <p>
 * Optional extension of {@link AuthenticationProvider}: implemented by providers
 * that need configuration from the {@link ProcessEngineAuthenticationFilter}'s
 * filter init-params.
 * </p>
 *
 * <p>
 * The filter instantiates providers with a no-arg constructor. If the provider
 * also implements this interface, the filter calls {@link #configure(Map)} once
 * during {@code Filter#init}, passing all filter init-params except the two the
 * filter itself owns ({@code authentication-provider} and
 * {@code rest-url-pattern-prefix}).
 * </p>
 *
 * <p>
 * Implementations should validate their required parameters and throw a
 * {@link ServletException} on missing/invalid configuration, so that
 * misconfiguration fails at deployment time instead of silently
 * mis-authenticating requests.
 * </p>
 */
public interface ConfigurableAuthenticationProvider {

  /**
   * Called once by {@link ProcessEngineAuthenticationFilter} during filter
   * initialization, before the first request is served.
   *
   * @param parameters
   *          all filter init-params except {@code authentication-provider} and
   *          {@code rest-url-pattern-prefix}. Never <code>null</code>.
   * @throws ServletException
   *           if required parameters are missing or invalid; fails filter
   *           initialization (deploy-time error)
   */
  void configure(Map<String, String> parameters) throws ServletException;
}
