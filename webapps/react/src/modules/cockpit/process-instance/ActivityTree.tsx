import { FeatureFlags, TreeNode, TreeView } from '@carbon/react';
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

/** The running activity instances of a process instance as a tree; selecting nodes filters the tabs. */
export function ActivityTree({ root, names, selected, onSelect }: ActivityTreeProps) {
  const { t } = useTranslation('cockpit');
  const label = (node: ActivityInstance) => node.activityName || names.get(activityOf(node)) || node.activityId;

  const render = (node: ActivityInstance) => {
    const children = childrenOf(node);
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
    <FeatureFlags enableTreeviewControllable>
      <TreeView label={t('PROCESS_INSTANCE_TOOLTIP_ACTIVITY_INSTANCE_TREE')} hideLabel size="xs" selected={selected} multiselect>
        {render(root)}
      </TreeView>
    </FeatureFlags>
  );
}
