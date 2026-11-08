import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBar } from '@/components/StatusBar';
import { useChartStore } from '@/store/chartStore';

const initialError = useChartStore.getState().workspaceAutosaveError;

afterEach(() => {
  useChartStore.setState({ workspaceAutosaveError: initialError });
});

describe('B07 workspace autosave error visibility', () => {
  it('shows a persistent accessible status while a background save is failing', () => {
    useChartStore.setState({ workspaceAutosaveError: 'Settings database is locked' });
    const markup = renderToStaticMarkup(createElement(StatusBar));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Workspace save failed');
    expect(markup).toContain('Settings database is locked');
    expect(markup).toContain('retrying');
  });

  it('removes only the workspace error status after a confirmed recovery', () => {
    useChartStore.setState({ workspaceAutosaveError: null });
    const markup = renderToStaticMarkup(createElement(StatusBar));
    expect(markup).not.toContain('Workspace save failed');
    expect(markup).toContain('No DB');
    expect(markup).toContain('IST');
  });
});
