import { describe, expect, it } from 'vitest';
import { expandPermissions, formatPermissions, toStoredPermissions } from './permissions';
import { validateAuthorizationSearch } from './search';

describe('authorization permissions', () => {
  it('shows ALL, NONE or the list', () => {
    expect(formatPermissions(['ALL', 'READ'])).toBe('ALL');
    expect(formatPermissions(['NONE'])).toBe('NONE');
    expect(formatPermissions(['READ', 'DELETE'])).toBe('READ, DELETE');
  });

  it('stores ALL when every permission of the resource type is chosen, NONE when none is', () => {
    // resource type 3 (group membership): CREATE, DELETE
    expect(toStoredPermissions(['DELETE', 'CREATE'], 3)).toEqual(['ALL']);
    expect(toStoredPermissions([], 3)).toEqual(['NONE']);
    expect(toStoredPermissions(['CREATE'], 3)).toEqual(['CREATE']);
  });

  it('expands ALL into the permissions of the resource type', () => {
    expect(expandPermissions(['ALL'], 3)).toEqual(['CREATE', 'DELETE']);
    expect(expandPermissions(['NONE'], 3)).toEqual([]);
  });

  it('reads the resource type and page from the URL', () => {
    expect(validateAuthorizationSearch({ resource: '6', page: 2 })).toEqual({ resource: 6, page: 2 });
    // 15/16/18 are no resource types of the Admin
    expect(validateAuthorizationSearch({ resource: 15 })).toEqual({ resource: undefined, page: undefined });
  });
});
