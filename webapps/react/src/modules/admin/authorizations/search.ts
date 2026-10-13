import { RESOURCE_TYPES } from './permissions';

/** ?resource=<resource type>&page=<page>, as in the classic Admin (#/authorization?resource=6). */
export interface AuthorizationSearch {
  resource?: number;
  /** 1-based */
  page?: number;
}

export function validateAuthorizationSearch(search: Record<string, unknown>): AuthorizationSearch {
  const resource = Number(search.resource);
  const page = Number(search.page);
  return {
    resource: RESOURCE_TYPES.some((type) => type.id === resource) ? resource : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}
