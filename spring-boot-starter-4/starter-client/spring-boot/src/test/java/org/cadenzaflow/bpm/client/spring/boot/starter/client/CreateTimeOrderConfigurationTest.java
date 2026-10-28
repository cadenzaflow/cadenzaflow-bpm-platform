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
package org.cadenzaflow.bpm.client.spring.boot.starter.client;

import org.cadenzaflow.bpm.client.ExternalTaskClientBuilder;
import org.cadenzaflow.bpm.client.spring.boot.starter.ClientProperties;
import org.cadenzaflow.bpm.client.spring.boot.starter.MockHelper;
import org.cadenzaflow.bpm.client.spring.boot.starter.impl.PropertiesAwareClientFactory;
import org.cadenzaflow.bpm.client.spring.exception.SpringExternalTaskClientException;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

public class CreateTimeOrderConfigurationTest {

  protected ClientProperties properties;

  @Before
  public void initMocks() {
    MockHelper.initMocks();
    properties = new ClientProperties();
  }

  @After
  public void reset() {
    MockHelper.reset();
  }

  @Test
  public void shouldNotOrderByCreateTimeByDefault() {
    buildClient();

    verify(clientBuilder(), never()).orderByCreateTime();
  }

  @Test
  public void shouldOrderByCreateTimeAscending() {
    properties.setOrderByCreateTime("asc");

    buildClient();

    verify(clientBuilder()).orderByCreateTime();
    verify(clientBuilder()).asc();
    verify(clientBuilder(), never()).desc();
  }

  @Test
  public void shouldOrderByCreateTimeDescending() {
    properties.setOrderByCreateTime("desc");

    buildClient();

    verify(clientBuilder()).orderByCreateTime();
    verify(clientBuilder()).desc();
    verify(clientBuilder(), never()).asc();
  }

  @Test
  public void shouldUseCreateTime() {
    properties.setUseCreateTime(true);

    buildClient();

    verify(clientBuilder()).orderByCreateTime();
    verify(clientBuilder()).desc();
    verify(clientBuilder(), never()).asc();
  }

  @Test
  public void shouldNotOrderByCreateTimeWhenUseCreateTimeIsFalse() {
    properties.setUseCreateTime(false);

    buildClient();

    verify(clientBuilder(), never()).orderByCreateTime();
  }

  @Test
  public void shouldRejectUseCreateTimeTogetherWithOrderByCreateTime() {
    properties.setUseCreateTime(true);
    properties.setOrderByCreateTime("asc");

    assertThatThrownBy(this::buildClient)
        .isInstanceOf(SpringExternalTaskClientException.class)
        .hasMessageContaining("Both \"useCreateTime\" and \"orderByCreateTime\" are enabled");
  }

  @Test
  public void shouldRejectInvalidOrderByCreateTime() {
    properties.setOrderByCreateTime("sideways");

    assertThatThrownBy(this::buildClient)
        .isInstanceOf(SpringExternalTaskClientException.class)
        .hasMessageContaining("Invalid value sideways");
  }

  protected void buildClient() {
    PropertiesAwareClientFactory factory = new PropertiesAwareClientFactory();
    factory.applyPropertiesFrom(properties);
    factory.getObject();
  }

  protected ExternalTaskClientBuilder clientBuilder() {
    return MockHelper.getClientBuilder();
  }

}
