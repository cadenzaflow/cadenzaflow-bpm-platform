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

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.runtime.ProcessInstance;
import org.cadenzaflow.bpm.qa.upgrade.DescribesScenario;
import org.cadenzaflow.bpm.qa.upgrade.ScenarioSetup;

/**
 * Scenario: Start a process instance in 1.1.0 and verify it is still accessible
 * after upgrading to 1.2.0.
 *
 * <p>1.2.0 is a namespace-only rebranding release (org.camunda -> org.cadenzaflow),
 * no DB schema changes were made. This scenario ensures in-flight process instances
 * survive the upgrade transparently.</p>
 */
public class ProcessInstanceScenario {

  /**
   * Creates a simple in-flight process instance that should survive the 1.1.0 → 1.2.0 upgrade.
   */
  @DescribesScenario("startedBeforeUpgrade")
  public static ScenarioSetup startProcessInstance() {
    return (ProcessEngine engine, String scenarioName) -> {
      // Deploy a minimal one-task process
      engine.getRepositoryService()
        .createDeployment()
        .name(scenarioName)
        .addClasspathResource("scenarios/upgrade120/ProcessInstanceScenario.bpmn20.xml")
        .deploy();

      // Start the process and leave it waiting on the user task
      ProcessInstance instance = engine.getRuntimeService()
        .startProcessInstanceByKey("upgrade120ProcessInstance",
          java.util.Collections.singletonMap("scenarioName", scenarioName));
    };
  }
}
