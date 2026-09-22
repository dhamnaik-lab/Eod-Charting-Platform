import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Corporate Action existing workflow recovery', () => {
  it('routes the preserved working CorporateActionDialog as the sole active Corporate Action surface', () => {
    const root = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');
    const databaseTools = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'),
      'utf8',
    );
    const palette = readFileSync(resolve(process.cwd(), 'src/components/CommandPalette.tsx'), 'utf8');
    const router = readFileSync(
      resolve(process.cwd(), 'src/features/app/menuCommandRouter.ts'),
      'utf8',
    );
    const main = readFileSync(resolve(process.cwd(), 'src-tauri-shell/src/main.rs'), 'utf8');

    expect(databaseTools).toContain('function CorporateActionDialog');
    expect(databaseTools).toContain('Manual Entry');
    expect(databaseTools).toContain('Identity Import');
    expect(databaseTools).toContain('Official Imports');
    expect(databaseTools).toContain('Scan Database');
    expect(databaseTools).toContain('Review Issues');
    expect(databaseTools).toContain('fetchOfficialCorporateActionsAndReload');
    expect(databaseTools).toContain('loadCorporateActionImportRows');
    expect(databaseTools).toContain("from '@/features/corporateActions/legacy/corporateActionImportOperations'");

    expect(root).toContain('<LazyDatabaseToolsDialogs />');
    expect(root).toContain('corporateActionOpen ||');
    expect(root).not.toContain('CorporateActionNormalWorkflowWorkspace');
    expect(root).not.toContain('LazyCorporateActionWorkspace');
    expect(root).not.toContain('LazyCorporateActionMaintenanceWorkspace');
    expect(root).not.toContain('CorporateActionManagedWindow');

    expect(palette).toContain('Corporate Actions / Identity');
    expect(palette).toContain('openCorporateAction()');
    expect(palette).not.toContain('Corporate Action Maintenance');
    expect(palette).not.toContain('openCorporateActionMaintenance()');

    expect(router).toContain('menu:openCorporateAction');
    expect(router).toContain('openCorporateAction()');
    expect(router).not.toContain('menu:openCorporateActionMaintenance');
    expect(router).not.toContain('openCorporateActionMaintenance()');

    expect(main).toContain('Corporate Actions / Identity');
    expect(main).toContain('menu:openCorporateAction');
    expect(main).not.toContain('Corporate Action Maintenance');
    expect(main).not.toContain('MENU_OPEN_CORPORATE_ACTION_MAINTENANCE');
    expect(main).not.toContain('menu:openCorporateActionMaintenance');
  });
});