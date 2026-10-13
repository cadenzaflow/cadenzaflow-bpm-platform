import { describe, expect, it } from 'vitest';
import { mergeCalled } from './called';

const definition = (id: string, name: string, calledFromActivityIds: string[]) => ({ id, key: id, name, version: 1, calledFromActivityIds });

describe('mergeCalled', () => {
  it('marks definitions as running, referenced or both', () => {
    const rows = mergeCalled(
      [definition('review:1', 'Review', ['callReview'])],
      [definition('review:1', 'Review', ['callReview', 'callAgain']), definition('archive:1', 'Archive', ['callArchive'])],
      [],
    );
    expect(rows).toEqual([
      { ...definition('archive:1', 'Archive', ['callArchive']), state: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_REFERENCED_LABEL' },
      { ...definition('review:1', 'Review', ['callAgain', 'callReview']), state: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_RUNNING_AND_REFERENCED_LABEL' },
    ]);
  });

  it('keeps only referenced definitions called from the selected activities', () => {
    const rows = mergeCalled([], [definition('review:1', 'Review', ['callReview']), definition('archive:1', 'Archive', ['callArchive'])], ['callArchive']);
    expect(rows.map((row) => row.id)).toEqual(['archive:1']);
  });
});
