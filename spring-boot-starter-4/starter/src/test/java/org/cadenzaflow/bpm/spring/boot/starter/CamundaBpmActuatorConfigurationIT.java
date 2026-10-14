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
package org.cadenzaflow.bpm.spring.boot.starter;

import static org.junit.Assert.assertEquals;

import java.util.Map;
import org.cadenzaflow.bpm.spring.boot.starter.test.nonpa.TestApplication;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@SpringBootTest(classes = { TestApplication.class }, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class CamundaBpmActuatorConfigurationIT extends AbstractCamundaAutoConfigurationIT{

  @Autowired
  private TestRestTemplate testRestTemplate;

  @Test
  public void jobExecutorHealthIndicatorTest() {
    final Map<?, ?> jobExecutor = getHealthComponent("jobExecutor");
    assertEquals("wrong health " + jobExecutor, "UP", jobExecutor.get("status"));
  }

  @Test
  public void processEngineHealthIndicatorTest() {
    final Map<?, ?> processEngine = getHealthComponent("processEngine");
    assertEquals("wrong health " + processEngine, "UP", processEngine.get("status"));
    assertEquals("wrong health " + processEngine, Map.of("name", "testEngine"), processEngine.get("details"));
  }

  // compared as JSON, not as text: the order of the properties is not fixed
  private Map<?, ?> getHealthComponent(String name) {
    final Map<?, ?> health = testRestTemplate.getForObject("/actuator/health", Map.class);
    final Map<?, ?> components = (Map<?, ?>) health.get("components");
    return (Map<?, ?>) components.get(name);
  }
}
