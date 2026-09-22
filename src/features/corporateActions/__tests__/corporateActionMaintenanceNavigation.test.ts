import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useUiStore } from '@/store/uiStore';

describe('Corporate Action Maintenance navigation foundation', () => {
  it('keeps Normal and Maintenance global contexts independently open and closable', () => {
    const initial = useUiStore.getState();
    const normalCount = initial.corporateActionOpenRequestCount;
    const maintenanceCount = initial.corporateActionMaintenanceOpenRequestCount;

    try {
      useUiStore.setState({
        corporateActionOpen: false,
        corporateActionMaintenanceOpen: false,
      });

      useUiStore.getState().openCorporateAction();
      expect(useUiStore.getState().corporateActionOpen).toBe(true);
      expect(useUiStore.getState().corporateActionMaintenanceOpen).toBe(false);
      expect(useUiStore.getState().corporateActionOpenRequestCount).toBe(normalCount + 1);

      useUiStore.getState().openCorporateActionMaintenance();
      expect(useUiStore.getState().corporateActionOpen).toBe(true);
      expect(useUiStore.getState().corporateActionMaintenanceOpen).toBe(true);
      expect(useUiStore.getState().corporateActionMaintenanceOpenRequestCount).toBe(
        maintenanceCount + 1,
      );

      useUiStore.getState().closeCorporateActionMaintenance();
      expect(useUiStore.getState().corporateActionOpen).toBe(true);
      expect(useUiStore.getState().corporateActionMaintenanceOpen).toBe(false);

      useUiStore.getState().closeCorporateAction();
      expect(useUiStore.getState().corporateActionOpen).toBe(false);
    } finally {
      useUiStore.setState({
        corporateActionOpen: initial.corporateActionOpen,
        corporateActionOpenRequestCount: initial.corporateActionOpenRequestCount,
        corporateActionMaintenanceOpen: initial.corporateActionMaintenanceOpen,
        corporateActionMaintenanceOpenRequestCount:
          initial.corporateActionMaintenanceOpenRequestCount,
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