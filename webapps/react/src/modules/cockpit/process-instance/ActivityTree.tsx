import { useState } from 'react';
import { FeatureFlags, Search, TreeNode, TreeView } from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { activityOf, childrenOf, treeIdOf, type ActivityInstance } from './api';

interface ActivityTreeProps {
  root: ActivityInstance;
  /** activity id → name, from the BPMN XML */
  names: Map<string, string>;
  /** tree ids (see treeIdOf) of the selected nodes */
  selected: string[];
  /** an activity instance was clicked; `add` with Ctrl/Cmd */
  onSelect: (node: ActivityInstance, add: boolean) => void;
}

/**
 * The running activity instances of a process instance as a tree; selecting
 * nodes filters the tabs. The field above it shows only the instances whose
 * name has the text, with the scopes they are in (the quick filter of the
 * classic Cockpit).
 */
export function ActivityTree({ root, names, selected, onSelect }: ActivityTreeProps) {
  const { t } = useTranslation('cockpit');
  const [filter, setFilter] = useState('');
  const label = (node: ActivityInstance) => node.activityName || names.get(activityOf(node)) || node.activityId;
  const wanted = filter.trim().toLowerCase();
  const matches = (node: ActivityInstance): boolean =>
    !wanted || (label(node) ?? '').toLowerCase().includes(wanted) || childrenOf(node).some(matches);

  const render = (node: ActivityInstance) => {
    const children = childrenOf(node).filter(matches);
    return (
      <TreeNode
        key={treeIdOf(node)}
        id={treeIdOf(node)}
        defaultIsExpanded
        label={
          <span className="cz-tree-node" title={node.id}>
            {!!node.incidents?.length && <WarningFilled className="cz-tree-node__incident" aria-label={t('PLUGIN_ACTIVITY_INSTANCE_OPEN_INCIDENTS')} />}
            {label(node)}
          </span>
        }
        onSelect={(event) => onSelect(node, event.ctrlKey || event.metaKey)}
      >
        {children.length ? children.map(render) : undefined}
      </TreeNode>
    );
  };

  // The selection follows the URL (diagram clicks change it too), so the tree runs controlled.
  return (
    <>
      <Search
        id="cz-activity-tree-filter"
        size="sm"
        labelText={t('QUICK_FILTER_TOOLTIP_FILTERS_ACTIVITY')}
        placeholder={t('QUICK_FILTER_TOOLTIP_FILTERS_ACTIVITY')}
        closeButtonLabelText={t('QUICK_FILTER_TOOLTIP_CLICK_HERE')}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <FeatureFlags enableTreeviewControllable>
        <TreeView label={t('PROCESS_INSTANCE_TOOLTIP_ACTIVITY_INSTANCE_TREE')} hideLabel size="xs" selected={selected} multiselect>
          {matches(root) ? render(root) : null}
        </TreeView>
      </FeatureFlags>
    </>
  );
}
