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
package org.cadenzaflow.bpm.engine.test.api.runtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

import org.cadenzaflow.bpm.engine.ProcessEngineConfiguration;
import org.cadenzaflow.bpm.engine.ProcessEngineException;
import org.cadenzaflow.bpm.engine.RuntimeService;
import org.cadenzaflow.bpm.engine.impl.util.ClockUtil;
import org.cadenzaflow.bpm.engine.runtime.ProcessInstance;
import org.cadenzaflow.bpm.engine.test.Deployment;
import org.cadenzaflow.bpm.engine.test.ProcessEngineRule;
import org.cadenzaflow.bpm.engine.test.RequiredHistoryLevel;
import org.cadenzaflow.bpm.engine.test.util.ProcessEngineTestRule;
import org.cadenzaflow.bpm.engine.test.util.ProvidedProcessEngineRule;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.RuleChain;

/**
 * Sorting runtime process instances by their start time, which the engine
 * reads from the process instance history (ACT_HI_PROCINST).
 */
@Deployment(resources = "org/cadenzaflow/bpm/engine/test/api/runtime/oneTaskProcess.bpmn20.xml")
public class ProcessInstanceQueryOrderByStartTimeTest {

  protected static final String PROCESS_KEY = "oneTaskProcess";
  protected static final long HOUR = 60 * 60 * 1000L;

  protected ProcessEngineRule engineRule = new ProvidedProcessEngineRule();
  protected ProcessEngineTestRule testHelper = new ProcessEngineTestRule(engineRule);

  @Rule
  public RuleChain ruleChain = RuleChain.outerRule(engineRule).around(testHelper);

  protected RuntimeService runtimeService;

  // started out of order on purpose: neither id nor business key follows the start time
  protected String startedSecond;
  protected String startedFirst;
  protected String startedThird;

  @Before
  public void setUp() {
    runtimeService = engineRule.getRuntimeService();

    Date base = new Date(1_700_000_000_000L);
    startedSecond = startAt(new Date(base.getTime() + HOUR), "b");
    startedFirst = startAt(base, "c");
    startedThird = startAt(new Date(base.getTime() + 2 * HOUR), "a");
  }

  @After
  public void resetClock() {
    ClockUtil.reset();
  }

  @Test
  @RequiredHistoryLevel(ProcessEngineConfiguration.HISTORY_ACTIVITY)
  public void shouldSortByStartTimeAscending() {
    List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().asc()
        .list();

    assertThat(ids(instances)).containsExactly(startedFirst, startedSecond, startedThird);
  }

  @Test
  @RequiredHistoryLevel(ProcessEngineConfiguration.HISTORY_ACTIVITY)
  public void shouldSortByStartTimeDescending() {
    List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().desc()
        .list();

    assertThat(ids(instances)).containsExactly(startedThird, startedSecond, startedFirst);
  }

  @Test
  @RequiredHistoryLevel(ProcessEngineConfiguration.HISTORY_ACTIVITY)
  public void shouldPageInStartTimeOrder() {
    List<ProcessInstance> firstPage = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().desc()
        .listPage(0, 2);
    List<ProcessInstance> secondPage = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().desc()
        .listPage(2, 2);

    assertThat(ids(firstPage)).containsExactly(startedThird, startedSecond);
    assertThat(ids(secondPage)).containsExactly(startedFirst);
  }

  @Test
  @RequiredHistoryLevel(ProcessEngineConfiguration.HISTORY_ACTIVITY)
  public void shouldUseSecondCriterionForEqualStartTimes() {
    Date sameTime = new Date(1_800_000_000_000L);
    String later1 = startAt(sameTime, "z");
    String later2 = startAt(sameTime, "y");

    List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().desc()
        .orderByBusinessKey().asc()
        .list();

    assertThat(ids(instances)).containsExactly(later2, later1, startedThird, startedSecond, startedFirst);
  }

  @Test
  @RequiredHistoryLevel(ProcessEngineConfiguration.HISTORY_ACTIVITY)
  public void shouldCombineWithFilters() {
    runtimeService.suspendProcessInstanceById(startedSecond);

    List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
        .active()
        .orderByStartTime().desc()
        .list();

    assertThat(ids(instances)).containsExactly(startedThird, startedFirst);
    assertThat(runtimeService.createProcessInstanceQuery().active().orderByStartTime().desc().count())
        .isEqualTo(2);
  }

  @Test
  public void shouldReturnAllInstancesAtAnyHistoryLevel() {
    // the history table is left-joined: an instance without a history row is still returned
    List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
        .orderByStartTime().asc()
        .list();

    assertThat(ids(instances)).containsExactlyInAnyOrder(startedFirst, startedSecond, startedThird);
    assertThat(runtimeService.createProcessInstanceQuery().orderByStartTime().asc().count()).isEqualTo(3);
  }

  @Test
  public void shouldNotAllowOrderByStartTimeInOrQuery() {
    assertThatThrownBy(() -> runtimeService.createProcessInstanceQuery().or().orderByStartTime())
        .isInstanceOf(ProcessEngineException.class)
        .hasMessageContaining("cannot set orderByStartTime() within 'or' query");
  }

  protected String startAt(Date time, String businessKey) {
    ClockUtil.setCurrentTime(time);
    return runtimeService.startProcessInstanceByKey(PROCESS_KEY, businessKey).getId();
  }

  protected static List<String> ids(List<ProcessInstance> instances) {
    return instances.stream().map(ProcessInstance::getId).collect(Collectors.toList());
  }
}
