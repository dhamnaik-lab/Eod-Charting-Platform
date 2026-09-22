import { describe, expect, it } from 'vitest';
import {
  filterAndSortScannerDefinitions,
  getScannerPriorityDisplay,
} from '@/plugins/scanner/scannerPriority';
import type { ScannerDefinition } from '@/plugins/scanner/types';

const definitions: ScannerDefinition[] = [
  definition('low', 'Low pattern', 3),
  definition('high', 'High pattern', 1),
  definition('medium', 'Medium pattern', 2),
];

describe('scanner priority presentation', () => {
  it('maps existing scanner priorities to visible accessible labels', () => {
    expect(getScannerPriorityDisplay(1)).toMatchObject({ label: 'H', name: 'High', color: '#2563eb' });
    expect(getScannerPriorityDisplay(2)).toMatchObject({ label: 'M', name: 'Medium', color: '#16a34a' });
    expect(getScannerPriorityDisplay(3)).toMatchObject({ label: 'L', name: 'Low', color: '#dc2626' });
  });

  it('filters priorities and keeps explicit high-to-low or low-to-high ordering', () => {
    expect(filterAndSortScannerDefinitions(definitions, 'high', 'category').map((definition) => definition.id)).toEqual(['high']);
    expect(filterAndSortScannerDefinitions(definitions, 'all', 'high-to-low').map((definition) => definition.id)).toEqual([
      'high',
      'medium',
      'low',
    ]);
    expect(filterAndSortScannerDefinitions(definitions, 'all', 'low-to-high').map((definition) => definition.id)).toEqual([
      'low',
      'medium',
      'high',
    ]);
  });
});

function definition(id: string, name: string, priority: 1 | 2 | 3): ScannerDefinition {
  return {
    id,
    name,
    categoryId: 'test',
    categoryName: 'Test',
    priority,
    scannerType: 'pattern',
    description: '',
    logicText: '',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: [],
    implementationStatus: 'ready_for_engine',
  };
}
