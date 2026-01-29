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
package org.cadenzaflow.bpm.engine.spring;

import org.cadenzaflow.bpm.engine.AuthorizationService;
import org.cadenzaflow.bpm.engine.CaseService;
import org.cadenzaflow.bpm.engine.DecisionService;
import org.cadenzaflow.bpm.engine.ExternalTaskService;
import org.cadenzaflow.bpm.engine.FilterService;
import org.cadenzaflow.bpm.engine.FormService;
import org.cadenzaflow.bpm.engine.HistoryService;
import org.cadenzaflow.bpm.engine.IdentityService;
import org.cadenzaflow.bpm.engine.ManagementService;
import org.cadenzaflow.bpm.engine.ProcessEngine;
import org.cadenzaflow.bpm.engine.ProcessEngineServices;
import org.cadenzaflow.bpm.engine.RepositoryService;
import org.cadenzaflow.bpm.engine.RuntimeService;
import org.cadenzaflow.bpm.engine.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Exposes all camunda process engine services as beans.
 *
 * @author Jan Galinski
 */
@Configuration
public class SpringProcessEngineServicesConfiguration implements ProcessEngineServices {

  @Autowired
  private ProcessEngine processEngine;

  @Bean(name = "runtimeService")
  @Override
  public RuntimeService getRuntimeService() {
    return processEngine.getRuntimeService();
  }

  @Bean(name = "repositoryService")
  @Override
  public RepositoryService getRepositoryService() {
    return processEngine.getRepositoryService();
  }

  @Bean(name = "formService")
  @Override
  public FormService getFormService() {
    return processEngine.getFormService();
  }

  @Bean(name = "taskService")
  @Override
  public TaskService getTaskService() {
    return processEngine.getTaskService();
  }

  @Bean(name = "historyService")
  @Override
  public HistoryService getHistoryService() {
    return processEngine.getHistoryService();
  }

  @Bean(name = "identityService")
  @Override
  public IdentityService getIdentityService() {
    return processEngine.getIdentityService();
  }

  @Bean(name = "managementService")
  @Override
  public ManagementService getManagementService() {
    return processEngine.getManagementService();
  }

  @Bean(name = "authorizationService")
  @Override
  public AuthorizationService getAuthorizationService() {
    return processEngine.getAuthorizationService();
  }

  @Bean(name = "caseService")
  @Override
  public CaseService getCaseService() {
    return processEngine.getCaseService();
  }

  @Bean(name = "filterService")
  @Override
  public FilterService getFilterService() {
    return processEngine.getFilterService();
  }

  @Bean(name = "externalTaskService")
  @Override
  public ExternalTaskService getExternalTaskService() {
    return processEngine.getExternalTaskService();
  }

  @Bean(name = "decisionService")
  @Override
  public DecisionService getDecisionService() {
    return processEngine.getDecisionService();
  }

}
