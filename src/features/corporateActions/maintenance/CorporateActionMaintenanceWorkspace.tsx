import type { ReactNode } from 'react';

export const CORPORATE_ACTION_MAINTENANCE_SECTIONS = [
  ['manual', 'Manual Actions'],
  ['fetch', 'Official Data Fetch / CSV Import'],
  ['history', 'Historical Backfill'],
  ['scan', 'Database Scan'],
  ['issues', 'Issue Resolution'],
  ['review', 'Specialist Review'],
] as const;

export type CorporateActionMaintenanceSection =
  (typeof CORPORATE_ACTION_MAINTENANCE_SECTIONS)[number][0];

interface CorporateActionMaintenanceWorkspaceProps {
  section: CorporateActionMaintenanceSection;
  onSectionChange: (section: CorporateActionMaintenanceSection) => void;
  busy: boolean;
  children: ReactNode;
}

export function CorporateActionMaintenanceWorkspace({
  section,
  onSectionChange,
  busy,
  children,
}: CorporateActionMaintenanceWorkspaceProps) {
  return (
    <>
      <nav className="corporate-action-section-nav" aria-label="Corporate Action Maintenance tools">
        {CORPORATE_ACTION_MAINTENANCE_SECTIONS.map(([id, label]) => (
          <button key={id} type="button" aria-current={section === id ? 'page' : undefined}
            disabled={busy && id !== section} onClick={() => onSectionChange(id)}>
            {label}
          </button>
        ))}
      </nav>
      {children}
    </>
  );
}
