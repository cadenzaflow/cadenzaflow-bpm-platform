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
package org.cadenzaflow.bpm.engine.test.concurrency;

import org.cadenzaflow.bpm.engine.ExternalTaskService;
import org.cadenzaflow.bpm.engine.HistoryService;
import org.cadenzaflow.bpm.engine.ManagementService;
import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.RepositoryService;
import org.cadenzaflow.bpm.engine.RuntimeService;
import org.cadenzaflow.bpm.engine.TaskService;
import org.cadenzaflow.bpm.engine.test.util.ProcessEngineTestRule;
import org.cadenzaflow.bpm.engine.test.util.ProvidedProcessEngineRule;
import org.junit.Before;
import org.junit.Rule;
import org.junit.rules.RuleChain;

/**
 * @author Daniel Meyer
 *
 */
public abstract class ConcurrencyTestCase extends ConcurrencyTestHelper {

  protected ProvidedProcessEngineRule engineRule = new ProvidedProcessEngineRule();
  protected ProcessEngineTestRule testRule = new ProcessEngineTestRule(engineRule);

  @Rule
  public RuleChain ruleChain = RuleChain.outerRule(engineRule).around(testRule);

  protected ProcessEngine processEngine;
  protected RepositoryService repositoryService;
  protected RuntimeService runtimeService;
  protected TaskService taskService;
  protected HistoryService historyService;
  protected ManagementService managementService;
  protected ExternalTaskService externalTaskService;

  @Before
  public void init() {
    processEngine = engineRule.getProcessEngine();
    processEngineConfiguration = engineRule.getProcessEngineConfiguration();
    repositoryService = engineRule.getRepositoryService();
    runtimeService = engineRule.getRuntimeService();
    taskService = engineRule.getTaskService();
    historyService = engineRule.getHistoryService();
    historyService = engineRule.getHistoryService();
    managementService = engineRule.getManagementService();
    externalTaskService = engineRule.getExternalTaskService();
    super.init();
  }

}
