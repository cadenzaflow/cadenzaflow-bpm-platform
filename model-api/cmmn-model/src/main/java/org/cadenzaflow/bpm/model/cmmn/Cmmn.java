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
package org.cadenzaflow.bpm.model.cmmn;

import static org.cadenzaflow.bpm.model.cmmn.impl.CmmnModelConstants.CMMN10_NS;
import static org.cadenzaflow.bpm.model.cmmn.impl.CmmnModelConstants.CMMN11_NS;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import org.cadenzaflow.bpm.model.cmmn.impl.CmmnParser;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ApplicabilityRuleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ArtifactImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.AssociationImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.BindingRefinementExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.BodyImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileItemDefinitionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileItemImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileItemOnPartImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileItemStartTriggerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileItemTransitionStandardEventImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseFileModelImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CasePlanModel;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseRefExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseRoleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseRolesImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CaseTaskImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ChildrenImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CmmnElementImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ConditionExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.CriterionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DecisionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DecisionParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DecisionRefExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DecisionTaskImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DefaultControlImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DefinitionsImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DiscretionaryItemImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.DocumentationImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.EntryCriterionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.EventImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.EventListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ExitCriterionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ExtensionElementsImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.HumanTaskImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.IfPartImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ImportImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.InputCaseParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.InputDecisionParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.InputProcessParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.InputsCaseParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ItemControlImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ManualActivationRuleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.MilestoneImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.OnPartImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.OutputCaseParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.OutputDecisionParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.OutputProcessParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.OutputsCaseParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ParameterMappingImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanFragmentImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemControlImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemDefinitionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemOnPartImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemStartTriggerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanItemTransitionStandardEventImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PlanningTableImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ProcessImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ProcessParameterImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ProcessRefExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.ProcessTaskImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.PropertyImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.RelationshipImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.RepetitionRuleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.RequiredRuleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.RoleImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.SentryImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.SourceImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.StageImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.StartTriggerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TableItemImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TargetImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TaskImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TextAnnotationImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TextImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TimerEventImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TimerEventListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TimerExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.TransformationExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.UserEventImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.UserEventListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaCaseExecutionListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaExpressionImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaFieldImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaInImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaOutImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaScriptImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaStringImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaTaskListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaVariableListenerImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaVariableOnPartImpl;
import org.cadenzaflow.bpm.model.cmmn.impl.instance.camunda.CamundaVariableTransitionEventImpl;
import org.cadenzaflow.bpm.model.xml.Model;
import org.cadenzaflow.bpm.model.xml.ModelBuilder;
import org.cadenzaflow.bpm.model.xml.ModelException;
import org.cadenzaflow.bpm.model.xml.ModelParseException;
import org.cadenzaflow.bpm.model.xml.ModelValidationException;
import org.cadenzaflow.bpm.model.xml.impl.instance.ModelElementInstanceImpl;
import org.cadenzaflow.bpm.model.xml.impl.util.IoUtil;

/**
 * @author Roman Smirnov
 *
 */
public class Cmmn {

  /** the singleton instance of {@link Cmmn}. If you want to customize the behavior of Cmmn,
   * replace this instance with an instance of a custom subclass of {@link Cmmn}. */
  public static Cmmn INSTANCE = new Cmmn();

  /** the parser used by the Cmmn implementation. */
  private CmmnParser cmmnParser = new CmmnParser();
  private final ModelBuilder cmmnModelBuilder;

  /** The {@link Model}
   */
  private Model cmmnModel;

  /**
   * Allows reading a {@link CmmnModelInstance} from a File.
   *
   * @param file the {@link File} to read the {@link CmmnModelInstance} from
   * @return the model read
   * @throws CmmnModelException if the model cannot be read
   */
  public static CmmnModelInstance readModelFromFile(File file) {
    return INSTANCE.doReadModelFromFile(file);
  }

  /**
   * Allows reading a {@link CmmnModelInstance} from an {@link InputStream}
   *
   * @param stream the {@link InputStream} to read the {@link CmmnModelInstance} from
   * @return the model read
   * @throws ModelParseException if the model cannot be read
   */
  public static CmmnModelInstance readModelFromStream(InputStream stream) {
    return INSTANCE.doReadModelFromInputStream(stream);
  }

  /**
   * Allows writing a {@link CmmnModelInstance} to a File. It will be
   * validated before writing.
   *
   * @param file the {@link File} to write the {@link CmmnModelInstance} to
   * @param modelInstance the {@link CmmnModelInstance} to write
   * @throws CmmnModelException if the model cannot be written
   * @throws ModelValidationException if the model is not valid
   */
  public static void writeModelToFile(File file, CmmnModelInstance modelInstance) {
    INSTANCE.doWriteModelToFile(file, modelInstance);
  }

  /**
   * Allows writing a {@link CmmnModelInstance} to an {@link OutputStream}. It will be
   * validated before writing.
   *
   * @param stream the {@link OutputStream} to write the {@link CmmnModelInstance} to
   * @param modelInstance the {@link CmmnModelInstance} to write
   * @throws ModelException if the model cannot be written
   * @throws ModelValidationException if the model is not valid
   */
  public static void writeModelToStream(OutputStream stream, CmmnModelInstance modelInstance) {
    INSTANCE.doWriteModelToOutputStream(stream, modelInstance);
  }

  /**
   * Allows the conversion of a {@link CmmnModelInstance} to an {@link String}. It will
   * be validated before conversion.
   *
   * @param modelInstance  the model instance to convert
   * @return the XML string representation of the model instance
   */
  public static String convertToString(CmmnModelInstance modelInstance) {
    return INSTANCE.doConvertToString(modelInstance);
  }

  /**
   * Validate model DOM document
   *
   * @param modelInstance the {@link CmmnModelInstance} to validate
   * @throws ModelValidationException if the model is not valid
   */
  public static void validateModel(CmmnModelInstance modelInstance) {
    INSTANCE.doValidateModel(modelInstance);
  }

  /**
   * Allows creating an new, empty {@link CmmnModelInstance}.
   *
   * @return the empty model.
   */
  public static CmmnModelInstance createEmptyModel() {
    return INSTANCE.doCreateEmptyModel();
  }

  /**
   * Register known types of the Cmmn model
   */
  protected Cmmn() {
    cmmnModelBuilder = ModelBuilder.createInstance("CMMN Model");
    cmmnModelBuilder.alternativeNamespace(CMMN10_NS, CMMN11_NS);
    doRegisterTypes(cmmnModelBuilder);
    cmmnModel = cmmnModelBuilder.build();
  }

  protected CmmnModelInstance doReadModelFromFile(File file) {
    InputStream is = null;
    try {
      is = new FileInputStream(file);
      return doReadModelFromInputStream(is);

    } catch (FileNotFoundException e) {
      throw new CmmnModelException("Cannot read model from file "+file+": file does not exist.");

    } finally {
      IoUtil.closeSilently(is);

    }
  }

  protected CmmnModelInstance doReadModelFromInputStream(InputStream is) {
    return cmmnParser.parseModelFromStream(is);
  }

  protected void doWriteModelToFile(File file, CmmnModelInstance modelInstance) {
    OutputStream os = null;
    try {
      os = new FileOutputStream(file);
      doWriteModelToOutputStream(os, modelInstance);
    }
    catch (FileNotFoundException e) {
      throw new CmmnModelException("Cannot write model to file "+file+": file does not exist.");
    } finally {
      IoUtil.closeSilently(os);
    }
  }

  protected void doWriteModelToOutputStream(OutputStream os, CmmnModelInstance modelInstance) {
    // validate DOM document
    doValidateModel(modelInstance);
    // write XML
    IoUtil.writeDocumentToOutputStream(modelInstance.getDocument(), os);
  }

  protected String doConvertToString(CmmnModelInstance modelInstance) {
    // validate DOM document
    doValidateModel(modelInstance);
    // convert to XML string
    return IoUtil.convertXmlDocumentToString(modelInstance.getDocument());
  }

  protected void doValidateModel(CmmnModelInstance modelInstance) {
    cmmnParser.validateModel(modelInstance.getDocument());
  }

  protected CmmnModelInstance doCreateEmptyModel() {
    return cmmnParser.getEmptyModel();
  }

  protected void doRegisterTypes(ModelBuilder modelBuilder) {
    ArtifactImpl.registerType(modelBuilder);
    ApplicabilityRuleImpl.registerType(modelBuilder);
    AssociationImpl.registerType(modelBuilder);
    BindingRefinementExpressionImpl.registerType(modelBuilder);
    BodyImpl.registerType(modelBuilder);
    CaseFileImpl.registerType(modelBuilder);
    CaseFileItemDefinitionImpl.registerType(modelBuilder);
    CaseFileItemImpl.registerType(modelBuilder);
    CaseFileItemOnPartImpl.registerType(modelBuilder);
    CaseFileItemStartTriggerImpl.registerType(modelBuilder);
    CaseFileItemTransitionStandardEventImpl.registerType(modelBuilder);
    CaseFileModelImpl.registerType(modelBuilder);
    CaseImpl.registerType(modelBuilder);
    CaseParameterImpl.registerType(modelBuilder);
    CasePlanModel.registerType(modelBuilder);
    CaseRoleImpl.registerType(modelBuilder);
    CaseRolesImpl.registerType(modelBuilder);
    CaseRefExpressionImpl.registerType(modelBuilder);
    CaseTaskImpl.registerType(modelBuilder);
    ChildrenImpl.registerType(modelBuilder);
    CmmnElementImpl.registerType(modelBuilder);
    ConditionExpressionImpl.registerType(modelBuilder);
    CriterionImpl.registerType(modelBuilder);
    DecisionImpl.registerType(modelBuilder);
    DecisionParameterImpl.registerType(modelBuilder);
    DecisionRefExpressionImpl.registerType(modelBuilder);
    DecisionTaskImpl.registerType(modelBuilder);
    DefaultControlImpl.registerType(modelBuilder);
    DefinitionsImpl.registerType(modelBuilder);
    DiscretionaryItemImpl.registerType(modelBuilder);
    DocumentationImpl.registerType(modelBuilder);
    EntryCriterionImpl.registerType(modelBuilder);
    EventImpl.registerType(modelBuilder);
    EventListenerImpl.registerType(modelBuilder);
    ExitCriterionImpl.registerType(modelBuilder);
    ExpressionImpl.registerType(modelBuilder);
    ExtensionElementsImpl.registerType(modelBuilder);
    HumanTaskImpl.registerType(modelBuilder);
    IfPartImpl.registerType(modelBuilder);
    ImportImpl.registerType(modelBuilder);
    InputCaseParameterImpl.registerType(modelBuilder);
    InputProcessParameterImpl.registerType(modelBuilder);
    InputsCaseParameterImpl.registerType(modelBuilder);
    InputDecisionParameterImpl.registerType(modelBuilder);
    InputProcessParameterImpl.registerType(modelBuilder);
    ItemControlImpl.registerType(modelBuilder);
    ManualActivationRuleImpl.registerType(modelBuilder);
    MilestoneImpl.registerType(modelBuilder);
    ModelElementInstanceImpl.registerType(modelBuilder);
    OnPartImpl.registerType(modelBuilder);
    OutputCaseParameterImpl.registerType(modelBuilder);
    OutputProcessParameterImpl.registerType(modelBuilder);
    OutputsCaseParameterImpl.registerType(modelBuilder);
    OutputDecisionParameterImpl.registerType(modelBuilder);
    OutputProcessParameterImpl.registerType(modelBuilder);
    ParameterImpl.registerType(modelBuilder);
    ParameterMappingImpl.registerType(modelBuilder);
    PlanFragmentImpl.registerType(modelBuilder);
    PlanItemControlImpl.registerType(modelBuilder);
    PlanItemDefinitionImpl.registerType(modelBuilder);
    PlanItemImpl.registerType(modelBuilder);
    PlanItemOnPartImpl.registerType(modelBuilder);
    PlanItemStartTriggerImpl.registerType(modelBuilder);
    PlanItemTransitionStandardEventImpl.registerType(modelBuilder);
    PlanningTableImpl.registerType(modelBuilder);
    ProcessImpl.registerType(modelBuilder);
    ProcessParameterImpl.registerType(modelBuilder);
    ProcessRefExpressionImpl.registerType(modelBuilder);
    ProcessTaskImpl.registerType(modelBuilder);
    PropertyImpl.registerType(modelBuilder);
    RelationshipImpl.registerType(modelBuilder);
    RepetitionRuleImpl.registerType(modelBuilder);
    RequiredRuleImpl.registerType(modelBuilder);
    RoleImpl.registerType(modelBuilder);
    SentryImpl.registerType(modelBuilder);
    SourceImpl.registerType(modelBuilder);
    StageImpl.registerType(modelBuilder);
    StartTriggerImpl.registerType(modelBuilder);
    TableItemImpl.registerType(modelBuilder);
    TargetImpl.registerType(modelBuilder);
    TaskImpl.registerType(modelBuilder);
    TextAnnotationImpl.registerType(modelBuilder);
    TextImpl.registerType(modelBuilder);
    TimerEventImpl.registerType(modelBuilder);
    TimerEventListenerImpl.registerType(modelBuilder);
    TransformationExpressionImpl.registerType(modelBuilder);
    TimerExpressionImpl.registerType(modelBuilder);
    TransformationExpressionImpl.registerType(modelBuilder);
    UserEventImpl.registerType(modelBuilder);
    UserEventListenerImpl.registerType(modelBuilder);

    /** camunda extensions */
    CamundaCaseExecutionListenerImpl.registerType(modelBuilder);
    CamundaExpressionImpl.registerType(modelBuilder);
    CamundaFieldImpl.registerType(modelBuilder);
    CamundaInImpl.registerType(modelBuilder);
    CamundaOutImpl.registerType(modelBuilder);
    CamundaScriptImpl.registerType(modelBuilder);
    CamundaStringImpl.registerType(modelBuilder);
    CamundaTaskListenerImpl.registerType(modelBuilder);
    CamundaVariableListenerImpl.registerType(modelBuilder);
    CamundaVariableOnPartImpl.registerType(modelBuilder);
    CamundaVariableTransitionEventImpl.registerType(modelBuilder);
  }

  /**
   * @return the {@link Model} instance to use
   */
  public Model getCmmnModel() {
    return cmmnModel;
  }

  public ModelBuilder getCmmnModelBuilder() {
    return cmmnModelBuilder;
  }

  /**
   * @param cmmnModel the cmmnModel to set
   */
  public void setCmmnModel(Model cmmnModel) {
    this.cmmnModel = cmmnModel;
  }

}
