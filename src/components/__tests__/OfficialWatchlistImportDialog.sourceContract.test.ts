import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OfficialWatchlistImportDialog W1.3 source contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/OfficialWatchlistImportDialog.tsx'), 'utf8');

  it('shows loading/retry states and clears selections when source payload changes', () => {
    expect(source).toContain('Loading constituents…');
    expect(source).toContain('Retry');
    expect(source).toContain('setSelectedGroupIds(new Set())');
    expect(source).toContain('setPreviewGroupId(null)');
  });

  it('gates import on ready payload and avoids synchronous catalog member preview binding', () => {
    expect(source).toContain("sourceDataState.status !== 'ready'");
    expect(source).not.toContain('groups.find((group) => group.id === previewGroupId)');
    expect(source).toContain('group.memberCount');
  });
});
