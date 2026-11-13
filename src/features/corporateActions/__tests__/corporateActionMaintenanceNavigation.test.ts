import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useUiStore } from '@/store/uiStore';

describe('Corporate Actions entry points', () => {
  it('requests one window and reuses its open state on a repeated command', () => {
    const initial = useUiStore.getState();
    try {
      useUiStore.setState({ corporateActionOpen: false });
      useUiStore.getState().openCorporateAction();
      useUiStore.getState().openCorporateAction();
      expect(useUiStore.getState().corporateActionOpen).toBe(true);
      expect(useUiStore.getState().corporateActionOpenRequestCount).toBe(initial.corporateActionOpenRequestCount + 2);
      expect(useUiStore.getState()).not.toHaveProperty('openCorporateActionMaintenance');
      useUiStore.getState().closeCorporateAction();
      expect(useUiStore.getState().corporateActionOpen).toBe(false);
    } finally {
      useUiStore.setState({
        corporateActionOpen: initial.corporateActionOpen,
        corporateActionOpenRequestCount: initial.corporateActionOpenRequestCount,
      });
    }
  });

  it('keeps only the existing Corporate Actions entry active in Command Palette and menu router', () => {
    const palette = readFileSync(resolve(process.cwd(), 'src/components/CommandPalette.tsx'), 'utf8');
    const router = readFileSync(
      resolve(process.cwd(), 'src/features/app/menuCommandRouter.ts'),
      'utf8',
    );

    expect(palette).toContain('Corporate Actions / Identity');
    expect(palette).toContain('openCorporateAction()');
    expect(palette).not.toContain('Corporate Action Maintenance');
    expect(palette).not.toContain('openCorporateActionMaintenance()');

    expect(router).toContain('menu:openCorporateAction');
    expect(router).toContain('openCorporateAction()');
    expect(router).not.toContain('menu:openCorporateActionMaintenance');
    expect(router).not.toContain('openCorporateActionMaintenance()');
  });

  it('keeps only the existing Corporate Actions shell-menu entry active', () => {
    const main = readFileSync(resolve(process.cwd(), 'src-tauri-shell/src/main.rs'), 'utf8');

    expect(main).toContain('menu:openCorporateAction');
    expect(main).toContain('Corporate Actions / Identity');
    expect(main).not.toContain('openCorporateActionMaintenance');
    expect(main).not.toContain('Corporate Action Maintenance');
  });
});