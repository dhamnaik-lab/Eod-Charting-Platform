import { describe, expect, it } from 'vitest';
import {
  normalizeScannerWorkspaceConfig,
  type ScannerWorkspaceConfig,
} from '../scannerWorkspace';

const DEFAULT_CONFIG: ScannerWorkspaceConfig = {
  exchange: 'NSE',
  universeSource: 'active-chart',
  selectedWatchlistIds: [],
  selectedScannerIds: [],
  lookbackBars: 800,
  maxSymbols: 100,
  executionMode: 'responsive',
  familyFilter: 'all',
  directionFilter: 'all',
  minScore: 0,
  recentOnly: true,
  activeSection: 'run',
  resultView: 'values',
  priorityFilter: 'all',
  prioritySort: 'category',
};

describe('scannerWorkspace normalization', () => {
  it('preserves activeSection: market-movers during normalization', () => {
    const raw = {
      activeSection: 'market-movers',
      exchange: 'NSE',
    };

    const normalized = normalizeScannerWorkspaceConfig(raw, DEFAULT_CONFIG);
    expect(normalized.activeSection).toBe('market-movers');
  });

  it('reverts invalid activeSection to default', () => {
    const raw = {
      activeSection: 'invalid-section-name',
    };

    const normalized = normalizeScannerWorkspaceConfig(raw, DEFAULT_CONFIG);
    expect(normalized.activeSection).toBe('run');
  });
});
