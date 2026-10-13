import { useMemo, useState } from 'react';
import { Button } from '@carbon/react';
import { Download, Edit, TrashCan, Upload } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../../shared/api/client';
import { formatDateTime } from '../../../../shared/format';
import { VARIABLE_OPERATORS, type CriterionType } from '../../../../shared/search/criteria';
import type { Column } from '../../../../shared/ui/ListTable';
import { SearchableList } from '../../../../shared/ui/SearchableList';
import { dataUrl, type VariableInstance } from '../../variables/api';
import { isBinary } from '../../variables/variable-draft';
import { DeleteVariableModal, EditVariableModal, UploadVariableModal } from '../../variables/VariableDialogs';
import type { InstanceTab, InstanceTabProps } from './registry';

const VARIABLE_CRITERIA: CriterionType[] = [
  { key: 'variableName', label: 'PLUGIN_VIEW_VARIABLE_TYPE_VARIABLE_NAME', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'activityInstanceIdIn', label: 'PLUGIN_VIEW_VARIABLE_ACTIVITY_INSTANCE_ID', kind: 'property', operators: ['eq'], valueType: 'list' },
  { key: 'variableValues', label: 'PLUGIN_VIEW_VARIABLE_VARIABLE_VALUE', kind: 'variable', operators: VARIABLE_OPERATORS },
];

// serialized values (objects, JSON, XML) are shown as they are stored
const LIST_QUERY = { deserializeValues: false };

// longer values are cut in the list (serialized ones shorter); the whole value is in the edit dialog
const PREVIEW_LENGTH = 100;
const CODE_PREVIEW_LENGTH = 40;

type Dialog = { kind: 'edit' | 'delete' | 'upload'; variable: VariableInstance } | null;

/** The variables of the instance, or of the selected activity instances; edited, deleted and uploaded in dialogs. */
function VariablesTab({ engine, instance, activityInstanceIds, activityInstanceNames, onActivityInstanceSelect, search, onSearchChange }: InstanceTabProps) {
  const { t, i18n } = useTranslation('cockpit');
  const [dialog, setDialog] = useState<Dialog>(null);
  const fixedQuery = useMemo(
    () => ({ processInstanceIdIn: [instance.id], activityInstanceIdIn: activityInstanceIds.length ? activityInstanceIds : undefined }),
    [instance.id, activityInstanceIds.join(',')],
  );

  const value = (variable: VariableInstance) => {
    if (variable.value === null || variable.value === undefined) {
      return isBinary(variable.type) ? null : <span className="cz-null">null</span>;
    }
    if (variable.type === 'Date') {
      return formatDateTime(String(variable.value), i18n.language);
    }
    const text = typeof variable.value === 'object' ? JSON.stringify(variable.value) : String(variable.value);
    const code = ['Object', 'Json', 'Xml'].includes(variable.type);
    const length = code ? CODE_PREVIEW_LENGTH : PREVIEW_LENGTH;
    return (
      <span className={code ? 'cz-variable-value cz-variable-value--code' : 'cz-variable-value'} title={text}>
        {text.length > length ? `${text.slice(0, length)}…` : text}
      </span>
    );
  };

  const columns: Column<VariableInstance>[] = [
    { key: 'name', header: t('PLUGIN_VARIABLE_NAME'), sortBy: 'variableName', render: (variable) => variable.name },
    {
      key: 'type',
      header: t('PLUGIN_VARIABLE_TYPE'),
      sortBy: 'variableType',
      render: (variable) => (
        <>
          {variable.type}
          {variable.type === 'Object' && typeof variable.valueInfo?.objectTypeName === 'string' && (
            <span className="cz-variable-object-type">{variable.valueInfo.objectTypeName}</span>
          )}
        </>
      ),
    },
    {
      key: 'value',
      header: t('PLUGIN_VARIABLE_VALUE'),
      render: (variable) =>
        variable.type === 'File' && typeof variable.valueInfo?.filename === 'string' ? variable.valueInfo.filename : value(variable),
    },
    {
      key: 'scope',
      header: t('PLUGIN_VARIABLE_SCOPE'),
      render: (variable) => (
        <Button
          kind="ghost"
          size="sm"
          className="cz-link-button"
          title={variable.activityInstanceId}
          onClick={() => onActivityInstanceSelect(variable.activityInstanceId)}
        >
          {activityInstanceNames.get(variable.activityInstanceId) ?? variable.activityInstanceId}
        </Button>
      ),
    },
    {
      key: 'action',
      header: t('PLUGIN_VARIABLE_ACTION'),
      render: (variable) => (
        <span className="cz-row-actions">
          {isBinary(variable.type) ? (
            <>
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={Download}
                iconDescription={t('REPOSITORY_DEPLOYMENT_DOWNLOAD_DOWNLOAD')}
                href={dataUrl(engine, variable)}
              />
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={Upload}
                iconDescription={t('VARIABLE_UPLOAD_MODAL_TITLE')}
                onClick={() => setDialog({ kind: 'upload', variable })}
              />
            </>
          ) : (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Edit}
              iconDescription={t('VARIABLE_INSPECT_CHANGE')}
              onClick={() => setDialog({ kind: 'edit', variable })}
            />
          )}
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={TrashCan}
            iconDescription={t('PLUGIN_VARIABLE_DELETE')}
            onClick={() => setDialog({ kind: 'delete', variable })}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <SearchableList<VariableInstance>
        scope={['cockpit', engine, 'list']}
        listUrl={engineUrl(engine, '/variable-instance')}
        countUrl={engineUrl(engine, '/variable-instance/count')}
        method="POST"
        listQuery={LIST_QUERY}
        namespace="cockpit"
        criteria={VARIABLE_CRITERIA}
        fixedQuery={fixedQuery}
        defaultSortBy="variableName"
        columns={columns}
        emptyText={t('PLUGIN_VARIABLE_NO_PROCESS_VARIABLES')}
        search={search}
        onSearchChange={onSearchChange}
      />
      {dialog?.kind === 'edit' && <EditVariableModal engine={engine} variable={dialog.variable} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && <DeleteVariableModal engine={engine} variable={dialog.variable} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'upload' && <UploadVariableModal engine={engine} variable={dialog.variable} onClose={() => setDialog(null)} />}
    </>
  );
}

export const tab: InstanceTab = {
  id: 'variables-tab',
  label: 'PLUGIN_VARIABLE_INSTANCES_LABEL',
  order: 10,
  component: VariablesTab,
};
