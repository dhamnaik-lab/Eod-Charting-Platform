import type { ScannerDefinition, ScannerPriority } from '@/plugins/scanner/types';

export type ScannerPriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type ScannerPrioritySort = 'category' | 'high-to-low' | 'low-to-high';

export interface ScannerPriorityDisplay {
  label: 'H' | 'M' | 'L';
  name: 'High' | 'Medium' | 'Low';
  color: string;
}

export function getScannerPriorityDisplay(priority: ScannerPriority): ScannerPriorityDisplay {
  if (priority === 1) return { label: 'H', name: 'High', color: '#2563eb' };
  if (priority === 2) return { label: 'M', name: 'Medium', color: '#16a34a' };
  return { label: 'L', name: 'Low', color: '#dc2626' };
}

export function filterAndSortScannerDefinitions(
  definitions: ScannerDefinition[],
  priorityFilter: ScannerPriorityFilter,
  prioritySort: ScannerPrioritySort,
): ScannerDefinition[] {
  const filtered = definitions.filter((definition) =>
    priorityFilter === 'all' || getScannerPriorityDisplay(definition.priority).name.toLowerCase() === priorityFilter,
  );
  if (prioritySort === 'category') return filtered;
  const direction = prioritySort === 'high-to-low' ? 1 : -1;
  return [...filtered].sort(
    (first, second) =>
      direction * (first.priority - second.priority) || first.name.localeCompare(second.name),
  );
}
