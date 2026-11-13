import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CORPORATE_ACTION_MAINTENANCE_SECTIONS,
  CorporateActionMaintenanceWorkspace,
} from '../maintenance/CorporateActionMaintenanceWorkspace';

describe('Corporate Actions maintenance workspace', () => {
  it('renders the selected business panel with all six maintenance tools in one navigation', () => {
    const html = renderToStaticMarkup(
      <CorporateActionMaintenanceWorkspace section="scan" busy={false} onSectionChange={() => undefined}>
        <button type="button">Run official database scan</button>
      </CorporateActionMaintenanceWorkspace>,
    );

    expect(CORPORATE_ACTION_MAINTENANCE_SECTIONS.map(([id]) => id)).toEqual([
      'manual', 'fetch', 'history', 'scan', 'issues', 'review',
    ]);
    expect(html).toContain('aria-current="page">Database Scan');
    expect(html).toContain('Run official database scan');
    expect(html).not.toContain('Foundation only');
    expect(html).not.toContain('role="dialog"');
  });

  it('prevents switching maintenance tools during a pending operation', () => {
    const html = renderToStaticMarkup(
      <CorporateActionMaintenanceWorkspace section="history" busy onSectionChange={() => undefined}>
        <p>Backfill in progress</p>
      </CorporateActionMaintenanceWorkspace>,
    );
    expect((html.match(/disabled=""/g) ?? [])).toHaveLength(5);
    expect(html).toContain('aria-current="page">Historical Backfill');
    expect(html).toContain('Backfill in progress');
  });
});
