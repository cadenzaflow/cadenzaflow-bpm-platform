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
package org.cadenzaflow.bpm.qa.upgrade;

import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.ProcessEngineConfiguration;
import org.cadenzaflow.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.cadenzaflow.bpm.qa.upgrade.scenarios120.AuthorizationScenario;
import org.cadenzaflow.bpm.qa.upgrade.scenarios120.JsonVariableScenario;
import org.cadenzaflow.bpm.qa.upgrade.scenarios120.ProcessInstanceScenario;

public class TestFixture {

  public static final String ENGINE_VERSION = "1.2.0";

  public TestFixture(ProcessEngine processEngine) {
  }

  public static void main(String... args) {
    ProcessEngineConfigurationImpl processEngineConfiguration = (ProcessEngineConfigurationImpl) ProcessEngineConfiguration
      .createProcessEngineConfigurationFromResource("cadenzaflow.cfg.xml");
    ProcessEngine processEngine = processEngineConfiguration.buildProcessEngine();

    // register test scenarios for the 1.1.0 -> 1.2.0 migration
    // 1.2.0 is a namespace-only rebranding release (org.camunda -> org.cadenzaflow),
    // no database schema changes were made.
    ScenarioRunner runner = new ScenarioRunner(processEngine, ENGINE_VERSION);

    // Verify in-flight process instances survive the namespace rebranding
    runner.setupScenarios(ProcessInstanceScenario.class);

    // Verify JSON-serialized variables are still readable after the rename
    runner.setupScenarios(JsonVariableScenario.class);

    // Verify camunda-admin group authorizations from 1.1.0 remain valid in 1.2.0
    runner.setupScenarios(AuthorizationScenario.class);

    processEngine.close();
  }
}

