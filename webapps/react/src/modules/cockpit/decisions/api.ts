import { skipToken, useQuery } from '@tanstack/react-query';
import { ApiError, engineUrl, request } from '../../../shared/api/client';

/** A decision definition as the engine REST API returns it. */
export interface DecisionDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  tenantId: string | null;
  deploymentId: string;
  resource: string;
  historyTimeToLive: number | null;
  decisionRequirementsDefinitionId: string | null;
}

/** An input or output of an evaluation (values of custom objects stay serialized). */
export interface DecisionValue {
  id: string;
  clauseId: string | null;
  clauseName: string | null;
  /** outputs only */
  ruleId?: string | null;
  variableName?: string | null;
  type: string;
  value: unknown;
  valueInfo?: Record<string, unknown>;
}

/** An evaluation of a decision, from the history. */
export interface DecisionInstance {
  id: string;
  decisionDefinitionId: string;
  decisionDefinitionKey: string;
  decisionDefinitionName: string | null;
  evaluationTime: string;
  tenantId: string | null;
  processDefinitionId: string | null;
  processDefinitionKey: string | null;
  processInstanceId: string | null;
  caseDefinitionKey: string | null;
  caseInstanceId: string | null;
  activityId: string | null;
  activityInstanceId: string | null;
  decisionRequirementsDefinitionId: string | null;
  removalTime: string | null;
  inputs?: DecisionValue[];
  outputs?: DecisionValue[];
}

const definitionUrl = (engine: string, id: string, path = '') => engineUrl(engine, `/decision-definition/${encodeURIComponent(id)}${path}`);

export function useDecisionDefinition(engine: string, id: string | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'decision-definition', id],
    queryFn: !id ? skipToken : () => request<DecisionDefinition>(definitionUrl(engine, id)),
  });
}

/** The DMN XML of a definition; it never changes. */
export function useDecisionXml(engine: string, id: string | undefined) {
  return useQuery({
    queryKey: ['decision-definition-xml', engine, id],
    staleTime: Infinity,
    queryFn: !id ? skipToken : async () => (await request<{ dmnXml: string }>(definitionUrl(engine, id, '/xml'))).dmnXml,
  });
}

/** All versions of a decision definition (same key and tenant), newest first. */
export function useDecisionVersions(engine: string, definition: DecisionDefinition | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'decision-definition-versions', definition?.key, definition?.tenantId],
    queryFn: !definition
      ? skipToken
      : () =>
          request<DecisionDefinition[]>(engineUrl(engine, '/decision-definition'), {
            query: {
              key: definition.key,
              sortBy: 'version',
              sortOrder: 'desc',
              ...(definition.tenantId ? { tenantIdIn: definition.tenantId } : { withoutTenantId: true }),
            },
          }),
  });
}

/** One evaluation with its inputs and outputs; binary values are not fetched, objects not deserialized. */
export function useDecisionInstance(engine: string, id: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'decision-instance', id],
    queryFn: async () => {
      const [instance] = await request<DecisionInstance[]>(engineUrl(engine, '/history/decision-instance'), {
        query: {
          decisionInstanceId: id,
          includeInputs: true,
          includeOutputs: true,
          disableBinaryFetching: true,
          disableCustomObjectDeserialization: true,
          maxResults: 1,
        },
      });
      if (!instance) {
        throw new ApiError(404, `No decision instance with ID ${id}`);
      }
      return instance;
    },
  });
}
