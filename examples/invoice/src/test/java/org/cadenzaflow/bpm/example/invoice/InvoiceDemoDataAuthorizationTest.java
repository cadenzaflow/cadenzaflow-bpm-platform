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
package org.cadenzaflow.bpm.example.invoice;

import java.util.ArrayList;
import java.util.List;

import org.cadenzaflow.bpm.engine.history.HistoricProcessInstance;
import org.cadenzaflow.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.cadenzaflow.bpm.engine.repository.Deployment;
import org.cadenzaflow.bpm.engine.task.Comment;
import org.cadenzaflow.bpm.engine.test.ProcessEngineTestCase;

/**
 * The demo data of the example on an engine that checks authorizations and
 * that already has its administrator "demo" when the example starts, like a
 * CadenzaFlow Run with <code>authorization.enabled</code>: the example then
 * creates no demo users and no authorizations for them.
 */
public class InvoiceDemoDataAuthorizationTest extends ProcessEngineTestCase {

  protected ProcessEngineConfigurationImpl processEngineConfiguration;
  protected List<String> deploymentIds = new ArrayList<>();

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    processEngineConfiguration = (ProcessEngineConfigurationImpl) processEngine.getProcessEngineConfiguration();
    identityService.saveUser(identityService.newUser("demo"));
    deploy("invoice.v1.bpmn");
    deploy("invoice.v2.bpmn");
    processEngineConfiguration.setAuthorizationEnabled(true);
  }

  @Override
  protected void tearDown() throws Exception {
    processEngineConfiguration.setAuthorizationEnabled(false);
    processEngineConfiguration.setDbMetricsReporterActivate(true);
    identityService.clearAuthentication();
    for (String deploymentId : deploymentIds) {
      repositoryService.deleteDeployment(deploymentId, true);
    }
    identityService.deleteUser("demo");
    managementService.deleteMetrics(null);
    super.tearDown();
  }

  public void testDemoDataIsCreated() {
    InvoiceApplicationHelper.startFirstProcess(processEngine);

    // three instances of each of the two versions
    assertEquals(6, historyService.createHistoricProcessInstanceQuery().processDefinitionKey("invoice").count());
    // no demo users were created, so nobody but the administrator may see the tasks
    assertNull(identityService.createUserQuery().userId("mary").singleResult());
    assertEquals(0, authorizationService.createAuthorizationQuery().userIdIn("mary").count());

    // the second invoice of each version is approved by demo
    List<HistoricProcessInstance> approved = historyService.createHistoricProcessInstanceQuery()
        .processDefinitionKey("invoice").variableValueEquals("invoiceNumber", "BOS-43934").list();
    assertEquals(2, approved.size());
    for (HistoricProcessInstance instance : approved) {
      assertEquals(1, historyService.createHistoricTaskInstanceQuery()
          .processInstanceId(instance.getId()).taskDefinitionKey("approveInvoice").taskAssignee("demo").finished().count());
    }

    // the third invoice of each version is rejected by mary, with her comment
    List<HistoricProcessInstance> rejected = historyService.createHistoricProcessInstanceQuery()
        .processDefinitionKey("invoice").variableValueEquals("invoiceNumber", "PSACE-5342").list();
    assertEquals(2, rejected.size());
    for (HistoricProcessInstance instance : rejected) {
      List<Comment> comments = taskService.getProcessInstanceComments(instance.getId());
      assertEquals(1, comments.size());
      assertEquals("mary", comments.get(0).getUserId());
      assertEquals(1, historyService.createHistoricTaskInstanceQuery()
          .processInstanceId(instance.getId()).taskDefinitionKey("approveInvoice").finished().count());
    }

    // the example leaves nobody logged in
    assertNull(identityService.getCurrentAuthentication());
  }

  protected void deploy(String process) {
    Deployment deployment = repositoryService.createDeployment()
        .addClasspathResource(process)
        .addClasspathResource("invoiceBusinessDecisions.dmn")
        .addClasspathResource("reviewInvoice.bpmn")
        .deploy();
    deploymentIds.add(deployment.getId());
  }

}
