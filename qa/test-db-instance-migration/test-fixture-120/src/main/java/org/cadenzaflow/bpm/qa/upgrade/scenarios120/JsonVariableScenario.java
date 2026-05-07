/*
 * Copyright CadenzaFlow Services GmbH and/or licensed to CadenzaFlow Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership. CadenzaFlow licenses this file to you under the Apache License,
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
package org.cadenzaflow.bpm.qa.upgrade.scenarios120;

import java.util.HashMap;
import java.util.Map;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.qa.upgrade.DescribesScenario;
import org.cadenzaflow.bpm.qa.upgrade.ScenarioSetup;

/**
 * Scenario: Store a JSON-serialized variable in 1.1.0 and verify it is still
 * readable after upgrading to 1.2.0.
 *
 * <p>1.2.0 renamed Java packages from org.camunda.* to org.cadenzaflow.*,
 * but JSON-serialized variables store only JSON text — not Java class names.
 * This scenario verifies that JSON variables survive the namespace rebranding.</p>
 */
public class JsonVariableScenario {

  /**
   * Starts a process and stores a JSON-serialized variable.
   * The migration test verifies the variable can be deserialized in 1.2.0.
   */
  @DescribesScenario("jsonVariableBeforeUpgrade")
  public static ScenarioSetup storeJsonVariable() {
    return (ProcessEngine engine, String scenarioName) -> {
      engine.getRepositoryService()
        .createDeployment()
        .name(scenarioName)
        .addClasspathResource("scenarios/upgrade120/JsonVariableScenario.bpmn20.xml")
        .deploy();

      Map<String, Object> variables = new HashMap<>();
      variables.put("scenarioName", scenarioName);
      // JSON value stored as a map (serialized as application/json by default)
      Map<String, String> jsonData = new HashMap<>();
      jsonData.put("key", "value-from-1.1.0");
      jsonData.put("version", "1.1.0");
      variables.put("jsonData", jsonData);

      engine.getRuntimeService()
        .startProcessInstanceByKey("upgrade120JsonVariable", variables);
    };
  }
}
