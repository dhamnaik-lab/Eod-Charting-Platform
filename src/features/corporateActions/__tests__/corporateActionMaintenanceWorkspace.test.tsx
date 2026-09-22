import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CORPORATE_ACTION_MAINTENANCE_SECTIONS,
  CorporateActionMaintenanceWorkspace,
} from '../maintenance/CorporateActionMaintenanceWorkspace';

const expectedSections = [
  'Manual Actions',
  'Identity & History',
  'Official Data Fetch',
  'Historical Backfill',
  'Database Scan',
  'Issue Resolution',
];

describe('Corporate Action Maintenance workspace foundation', () => {
  it('renders the exact six-section left rail with Manual Actions selected initially', () => {
    expect(CORPORATE_ACTION_MAINTENANCE_SECTIONS.map((section) => section.label)).toEqual(
      expectedSections,
    );

    const html = renderToStaticMarkup(
      <CorporateActionMaintenanceWorkspace onClose={() => undefined} />,
    );

    for (const label of expectedSections) {
      const staticMarkupLabel = label.replace('&', '&amp;');
      expect(html).toContain(staticMarkupLabel);
    }

    expect(html).toContain('data-corporate-action-maintenance-workspace');
    expect(html).toContain('Corporate Action Maintenance');
    expect(html).toContain('Task 6A navigation foundation only');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Manual Actions');
  });

  it('contains navigation/presentation only and no Maintenance business operation wiring', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/maintenance/CorporateActionMaintenanceWorkspace.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain("from '@/platform'");
    expect(source).not.toContain('fetchOfficialCorporateActions');
    expect(source).not.toContain('applyCorporateAction');
    expect(source).not.toContain('runCorporateActionScan');
    expect(source).not.toContain('resolveCorporateActionImport');
    expect(source).not.toContain('approveCorporateActionImport');
  });

  it('keeps the Maintenance reconstruction as donor-only code outside RootApp', () => {
    const root = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');
    const donor = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/maintenance/CorporateActionMaintenanceWorkspace.tsx',
      ),
      'utf8',
    );

    expect(root).not.toContain('LazyCorporateActionMaintenanceWorkspace');
    expect(root).not.toContain('CorporateActionMaintenanceWorkspace');
    expect(donor).toContain('Corporate Action Maintenance');
    expect(donor).toContain('Task 6A navigation foundation only');
  });
});