import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { CorporateActionWorkspace } from '../workspace/CorporateActionWorkspace';
import { CorporateActionWorkflowHeader } from '../workspace/CorporateActionWorkflowHeader';

const counts = {
  fetched: 12,
  loaded: 10,
  needsReview: 2,
  conflicts: 1,
  ready: 7,
};

describe('Corporate Action full-page workspace shell', () => {
  it('mounts one selected section and keeps the other sections in the same navigation', () => {
    const html = renderToStaticMarkup(
      <CorporateActionWorkspace section="identity" busy={false} onSectionChange={() => undefined}>
        <button type="button">Preview Changes</button>
      </CorporateActionWorkspace>,
    );
    expect(html).toContain('aria-current="page">Identity &amp; History');
    expect(html).toContain('>Actions</button>');
    expect(html).toContain('>History &amp; Reports</button>');
    expect(html).toContain('>Maintenance</button>');
    expect(html).toContain('>Preview Changes</button>');
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
  });

  it('renders Review as the single current step after completed Fetch and Load', () => {
    const html = renderToStaticMarkup(
      <CorporateActionWorkflowHeader activeStage="review" counts={counts} />,
    );

    expect((html.match(/aria-current="step"/g) ?? [])).toHaveLength(1);
    expect(html).toMatch(/data-stage="fetch"[^>]*data-state="complete"/);
    expect(html).toMatch(/data-stage="load"[^>]*data-state="complete"/);
    expect(html).toMatch(
      /data-stage="review"[^>]*data-state="current"[^>]*aria-current="step"/,
    );
    expect(html).toMatch(
      /data-stage="approve"[^>]*data-state="locked"[^>]*aria-disabled="true"/,
    );
  });

  it('routes Corporate Actions through the managed workspace without recreating chart tab or sheet state', () => {
    const rootApp = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');

    expect(rootApp).toContain('<LazyDatabaseToolsDialogs />');
    expect(rootApp).toContain('corporateActionOpen ||');
    expect(rootApp).not.toContain('LazyCorporateActionWorkspace');

    const wasOpen = useUiStore.getState().corporateActionOpen;
    const chartTabsBefore = useChartStore.getState().chartTabs;
    const activeChartTabIdBefore = useChartStore.getState().activeChartTabId;

    try {
      useUiStore.getState().openCorporateAction();

      expect(useUiStore.getState().corporateActionOpen).toBe(true);
      expect(useChartStore.getState().chartTabs).toBe(chartTabsBefore);
      expect(useChartStore.getState().activeChartTabId).toBe(activeChartTabIdBefore);

      useUiStore.getState().closeCorporateAction();

      expect(useUiStore.getState().corporateActionOpen).toBe(false);
      expect(useChartStore.getState().chartTabs).toBe(chartTabsBefore);
      expect(useChartStore.getState().activeChartTabId).toBe(activeChartTabIdBefore);
    } finally {
      useUiStore.setState({ corporateActionOpen: wasOpen });
    }
  });
});
