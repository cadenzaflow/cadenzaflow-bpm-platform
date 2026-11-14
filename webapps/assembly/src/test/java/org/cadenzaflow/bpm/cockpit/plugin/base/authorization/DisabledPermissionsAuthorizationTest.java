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
package org.cadenzaflow.bpm.cockpit.plugin.base.authorization;

import static org.cadenzaflow.bpm.engine.authorization.Permissions.DELETE_HISTORY;
import static org.cadenzaflow.bpm.engine.authorization.Permissions.READ;
import static org.cadenzaflow.bpm.engine.authorization.Permissions.READ_INSTANCE;
import static org.cadenzaflow.bpm.engine.authorization.Resources.PROCESS_DEFINITION;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import javax.ws.rs.core.MultivaluedHashMap;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.UriInfo;

import org.cadenzaflow.bpm.cockpit.impl.plugin.base.dto.IncidentDto;
import org.cadenzaflow.bpm.cockpit.impl.plugin.base.dto.ProcessDefinitionStatisticsDto;
import org.cadenzaflow.bpm.cockpit.impl.plugin.base.dto.ProcessInstanceDto;
import org.cadenzaflow.bpm.cockpit.impl.plugin.base.dto.query.IncidentQueryDto;
import org.cadenzaflow.bpm.cockpit.impl.plugin.base.dto.query.ProcessInstanceQueryDto;
import org.cadenzaflow.bpm.cockpit.impl.plugin.resources.IncidentRestService;
import org.cadenzaflow.bpm.cockpit.impl.plugin.resources.ProcessDefinitionRestService;
import org.cadenzaflow.bpm.cockpit.impl.plugin.resources.ProcessInstanceRestService;
import org.cadenzaflow.bpm.engine.runtime.ProcessInstance;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

/**
 * The Cockpit queries skip exactly the permissions that are disabled in the
 * process engine configuration, as the queries of the engine do.
 */
public class DisabledPermissionsAuthorizationTest extends AuthorizationTest {

  protected static final String USER_TASK_PROCESS_KEY = "userTaskProcess";
  protected static final String FAILING_PROCESS_KEY = "FailingProcess";

  protected String deploymentId;

  protected ProcessInstanceRestService processInstanceResource;
  protected IncidentRestService incidentResource;
  protected ProcessDefinitionRestService processDefinitionResource;
  protected UriInfo uriInfo;

  @Override
  @Before
  public void setUp() throws Exception {
    super.setUp();

    deploymentId = createDeployment(null, "processes/user-task-process.bpmn", "processes/failing-process.bpmn").getId();

    startProcessInstances(USER_TASK_PROCESS_KEY, 3);
    startProcessInstances(FAILING_PROCESS_KEY, 3);
    disableAuthorization();
    executeAvailableJobs();
    enableAuthorization();

    processInstanceResource = new ProcessInstanceRestService(engineName);
    incidentResource = new IncidentRestService(engineName);
    processDefinitionResource = new ProcessDefinitionRestService(engineName);

    MultivaluedMap<String, String> queryParameters = new MultivaluedHashMap<>();
    queryParameters.add("sortBy", "key");
    queryParameters.add("sortOrder", "asc");
    uriInfo = Mockito.mock(UriInfo.class);
    Mockito.doReturn(queryParameters).when(uriInfo).getQueryParameters();
  }

  @Override
  @After
  public void tearDown() {
    processEngineConfiguration.setDisabledPermissions(Collections.<String>emptyList());
    deleteDeployment(deploymentId);
    super.tearDown();
  }

  @Test
  public void shouldCheckProcessInstancesWhenAnotherPermissionIsDisabled() {
    // given
    processEngineConfiguration.setDisabledPermissions(Collections.singletonList(DELETE_HISTORY.getName()));

    // when
    List<ProcessInstanceDto> instances = processInstanceResource.queryProcessInstances(new ProcessInstanceQueryDto(), null, null);

    // then
    assertThat(instances).isEmpty();
  }

  @Test
  public void shouldCheckIncidentsWhenAnotherPermissionIsDisabled() {
    // given
    processEngineConfiguration.setDisabledPermissions(Collections.singletonList(DELETE_HISTORY.getName()));

    // when
    List<IncidentDto> incidents = incidentResource.queryIncidents(new IncidentQueryDto(), null, null);

    // then
    assertThat(incidents).isEmpty();
  }

  @Test
  public void shouldCheckProcessDefinitionsWhenAnotherPermissionIsDisabled() {
    // given
    processEngineConfiguration.setDisabledPermissions(Collections.singletonList(DELETE_HISTORY.getName()));

    // when
    List<ProcessDefinitionStatisticsDto> statistics = processDefinitionResource.queryStatistics(uriInfo, null, null);

    // then
    assertThat(statistics).isEmpty();
    assertThat(processDefinitionResource.getStatisticsCount(uriInfo).getCount()).isZero();
  }

  @Test
  public void shouldCheckReadInstanceWhenReadIsDisabled() {
    // given
    processEngineConfiguration.setDisabledPermissions(Collections.singletonList(READ.getName()));
    createGrantAuthorization(PROCESS_DEFINITION, USER_TASK_PROCESS_KEY, userId, READ_INSTANCE);

    // when
    List<ProcessInstanceDto> instances = processInstanceResource.queryProcessInstances(new ProcessInstanceQueryDto(), null, null);

    // then
    assertThat(instances).extracting("id")
        .containsExactlyInAnyOrderElementsOf(selectProcessInstanceIdsByKey(USER_TASK_PROCESS_KEY));
  }

  @Test
  public void shouldSkipTheDisabledReadOnProcessDefinitionsAsTheEngineDoes() {
    // given
    processEngineConfiguration.setDisabledPermissions(Collections.singletonList(READ.getName()));

    // when
    List<ProcessDefinitionStatisticsDto> statistics = processDefinitionResource.queryStatistics(uriInfo, null, null);

    // then
    assertThat(repositoryService.createProcessDefinitionQuery().count()).isEqualTo(2);
    assertThat(statistics).extracting("key").containsExactlyInAnyOrder(FAILING_PROCESS_KEY, USER_TASK_PROCESS_KEY);
  }

  @Test
  public void shouldCheckAllPermissionsWhenNoListIsSet() {
    // given
    processEngineConfiguration.setDisabledPermissions(null);

    // when
    List<ProcessInstanceDto> instances = processInstanceResource.queryProcessInstances(new ProcessInstanceQueryDto(), null, null);

    // then
    assertThat(instances).isEmpty();
  }

  protected List<String> selectProcessInstanceIdsByKey(String processDefinitionKey) {
    disableAuthorization();
    List<String> ids = runtimeService.createProcessInstanceQuery()
        .processDefinitionKey(processDefinitionKey)
        .list()
        .stream()
        .map(ProcessInstance::getId)
        .collect(Collectors.toList());
    enableAuthorization();
    return ids;
  }

}
