/** Resource types of the authorization API with their i18n keys, in the order of the classic Admin. */
export const RESOURCE_TYPES: { id: number; label: string }[] = [
  { id: 0, label: 'AUTHORIZATION_APPLICATION' },
  { id: 1, label: 'AUTHORIZATION_USER' },
  { id: 2, label: 'AUTHORIZATION_GROUP' },
  { id: 3, label: 'AUTHORIZATION_GROUP_MEMBERSHIP' },
  { id: 4, label: 'AUTHORIZATION_AUTHORIZATION' },
  { id: 5, label: 'AUTHORIZATION_FILTER' },
  { id: 6, label: 'AUTHORIZATION_PROCESS_DEFINITION' },
  { id: 7, label: 'AUTHORIZATION_TASK' },
  { id: 8, label: 'AUTHORIZATION_PROCESS_INSTANCE' },
  { id: 9, label: 'AUTHORIZATION_DEPLOYMENT' },
  { id: 10, label: 'AUTHORIZATION_DECISION_DEFINITION' },
  { id: 11, label: 'AUTHORIZATION_TENANT' },
  { id: 12, label: 'AUTHORIZATION_TENANT_MEMBERSHIP' },
  { id: 13, label: 'AUTHORIZATION_BATCH' },
  { id: 14, label: 'AUTHORIZATION_DECISION_REQUIREMENTS_DEFINITION' },
  { id: 17, label: 'AUTHORIZATION_OPERATION_LOG' },
  { id: 19, label: 'AUTHORIZATION_HISTORIC_TASK' },
  { id: 20, label: 'AUTHORIZATION_HISTORIC_PROCESS_INSTANCE' },
  { id: 21, label: 'AUTHORIZATION_SYSTEM' },
];

/** The permissions that can be granted per resource type (as in the classic Admin). */
export const PERMISSIONS: Record<number, string[]> = {
  0: ['ACCESS'],
  1: ['READ', 'UPDATE', 'CREATE', 'DELETE'],
  2: ['READ', 'UPDATE', 'CREATE', 'DELETE'],
  3: ['CREATE', 'DELETE'],
  4: ['READ', 'UPDATE', 'CREATE', 'DELETE'],
  5: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
  6: [
    'READ',
    'UPDATE',
    'DELETE',
    'SUSPEND',
    'CREATE_INSTANCE',
    'READ_INSTANCE',
    'UPDATE_INSTANCE',
    'RETRY_JOB',
    'SUSPEND_INSTANCE',
    'DELETE_INSTANCE',
    'MIGRATE_INSTANCE',
    'READ_TASK',
    'UPDATE_TASK',
    'TASK_ASSIGN',
    'TASK_WORK',
    'READ_TASK_VARIABLE',
    'READ_HISTORY',
    'READ_HISTORY_VARIABLE',
    'DELETE_HISTORY',
    'READ_INSTANCE_VARIABLE',
    'UPDATE_INSTANCE_VARIABLE',
    'UPDATE_TASK_VARIABLE',
    'UPDATE_HISTORY',
  ],
  7: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'TASK_ASSIGN', 'TASK_WORK', 'UPDATE_VARIABLE', 'READ_VARIABLE'],
  8: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'RETRY_JOB', 'SUSPEND', 'UPDATE_VARIABLE'],
  9: ['CREATE', 'READ', 'DELETE'],
  10: ['READ', 'UPDATE', 'CREATE_INSTANCE', 'READ_HISTORY', 'DELETE_HISTORY'],
  11: ['READ', 'UPDATE', 'CREATE', 'DELETE'],
  12: ['CREATE', 'DELETE'],
  13: [
    'READ',
    'UPDATE',
    'CREATE',
    'DELETE',
    'READ_HISTORY',
    'DELETE_HISTORY',
    'CREATE_BATCH_MIGRATE_PROCESS_INSTANCES',
    'CREATE_BATCH_MODIFY_PROCESS_INSTANCES',
    'CREATE_BATCH_RESTART_PROCESS_INSTANCES',
    'CREATE_BATCH_DELETE_RUNNING_PROCESS_INSTANCES',
    'CREATE_BATCH_DELETE_FINISHED_PROCESS_INSTANCES',
    'CREATE_BATCH_DELETE_DECISION_INSTANCES',
    'CREATE_BATCH_SET_JOB_RETRIES',
    'CREATE_BATCH_SET_REMOVAL_TIME',
    'CREATE_BATCH_SET_EXTERNAL_TASK_RETRIES',
    'CREATE_BATCH_UPDATE_PROCESS_INSTANCES_SUSPEND',
    'CREATE_BATCH_SET_VARIABLES',
  ],
  14: ['READ'],
  17: ['READ', 'DELETE', 'UPDATE'],
  19: ['READ', 'READ_VARIABLE'],
  20: ['READ'],
  21: ['READ', 'SET', 'DELETE'],
};

/** Authorization types of the engine: GLOBAL applies to everybody (user "*"). */
export const AUTHORIZATION_TYPES: { id: number; label: string }[] = [
  { id: 0, label: 'AUTHORIZATION_GLOBAL' },
  { id: 1, label: 'AUTHORIZATION_ALLOW' },
  { id: 2, label: 'AUTHORIZATION_DENY' },
];

/** "ALL" when ALL is granted, "NONE" when nothing is, else the list. */
export function formatPermissions(permissions: string[]): string {
  if (permissions.includes('ALL')) {
    return 'ALL';
  }
  const granted = permissions.filter((permission) => permission !== 'NONE');
  return granted.length ? granted.join(', ') : 'NONE';
}

/** The single permissions a stored list stands for (ALL → every permission of the resource type). */
export function expandPermissions(permissions: string[], resourceType: number): string[] {
  const available = PERMISSIONS[resourceType] ?? [];
  return permissions.includes('ALL') ? available : permissions.filter((permission) => available.includes(permission));
}

/** What is stored for the chosen permissions: ALL when every one is chosen, NONE when none is. */
export function toStoredPermissions(chosen: string[], resourceType: number): string[] {
  const available = PERMISSIONS[resourceType] ?? [];
  if (chosen.length === 0) {
    return ['NONE'];
  }
  return available.every((permission) => chosen.includes(permission)) ? ['ALL'] : chosen;
}
