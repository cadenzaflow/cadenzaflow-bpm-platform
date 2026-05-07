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
import org.cadenzaflow.bpm.engine.authorization.Authorization;
import org.cadenzaflow.bpm.engine.authorization.Groups;
import org.cadenzaflow.bpm.engine.authorization.Permissions;
import org.cadenzaflow.bpm.engine.authorization.Resources;
import org.cadenzaflow.bpm.qa.upgrade.DescribesScenario;
import org.cadenzaflow.bpm.qa.upgrade.ScenarioSetup;

/**
 * Scenario: Verify that the camunda-admin group's authorization grants (created in 1.1.0)
 * survive the upgrade to 1.2.0.
 *
 * <p>The group name {@link Groups#CAMUNDA_ADMIN} ("camunda-admin") is stored in the database.
 * Since 1.2.0 is a namespace-only change, the group name in the DB is NOT renamed.
 * The migration test verifies that the existing authorization records are still valid
 * and the admin group can still access protected resources.</p>
 */
public class AuthorizationScenario {

  /**
   * Creates authorization entries for the camunda-admin group as they would exist in 1.1.0.
   * The migration test verifies these authorizations are still present in 1.2.0.
   */
  @DescribesScenario("adminAuthorizationBeforeUpgrade")
  public static ScenarioSetup createAdminAuthorization() {
    return (ProcessEngine engine, String scenarioName) -> {
      // Create an explicit authorization for the camunda-admin group on PROCESS_DEFINITION
      // This simulates what a user would have configured in 1.1.0
      Authorization auth = engine.getAuthorizationService()
        .createNewAuthorization(Authorization.AUTH_TYPE_GRANT);
      auth.setGroupId(Groups.CAMUNDA_ADMIN);
      auth.setResource(Resources.PROCESS_DEFINITION);
      auth.setResourceId(Authorization.ANY);
      auth.addPermission(Permissions.ALL);
      engine.getAuthorizationService().saveAuthorization(auth);
    };
  }
}
