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
package org.cadenzaflow.bpm.engine.impl.db.sql;

/**
 * Joins the history row of a process instance (one per instance, same id)
 * so a runtime query can sort by its start time.
 */
public class HistoricProcessInstanceTableMapping implements MyBatisTableMapping {

  public String getTableName() {
    return "ACT_HI_PROCINST";
  }

  public String getTableAlias() {
    return "HPI";
  }

  public boolean isOneToOneRelation() {
    return true;
  }
}
