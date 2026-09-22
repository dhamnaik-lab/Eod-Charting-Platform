import { useState } from 'react';
import './corporateActionMaintenanceWorkspace.css';

export const CORPORATE_ACTION_MAINTENANCE_SECTIONS = [
  {
    id: 'manual-actions',
    label: 'Manual Actions',
    description: 'Manual Corporate Action and identity-history entry workflows.',
  },
  {
    id: 'identity-history',
    label: 'Identity & History',
    description: 'Instrument identity, symbol, name, ISIN, and historical identity maintenance.',
  },
  {
    id: 'official-data-fetch',
    label: 'Official Data Fetch',
    description: 'Specialist acquisition controls for official Corporate Action source data.',
  },
  {
    id: 'historical-backfill',
    label: 'Historical Backfill',
    description: 'Controlled historical Corporate Action discovery and backfill workflows.',
  },
  {
    id: 'database-scan',
    label: 'Database Scan',
    description: 'Database validation and anomaly-scan workflows.',
  },
  {
    id: 'issue-resolution',
    label: 'Issue Resolution',
    description: 'Specialist review, resolution, exception, and controlled-override workflows.',
  },
] as const;

type MaintenanceSectionId = (typeof CORPORATE_ACTION_MAINTENANCE_SECTIONS)[number]['id'];

export interface CorporateActionMaintenanceWorkspaceProps {
  onClose: () => void;
}

export function CorporateActionMaintenanceWorkspace({
  onClose,
}: CorporateActionMaintenanceWorkspaceProps) {
  const [activeSectionId, setActiveSectionId] =
    useState<MaintenanceSectionId>('manual-actions');

  const activeSection =
    CORPORATE_ACTION_MAINTENANCE_SECTIONS.find((section) => section.id === activeSectionId) ??
    CORPORATE_ACTION_MAINTENANCE_SECTIONS[0];

  return (
    <section
      className="ca-maintenance-workspace"
      data-corporate-action-maintenance-workspace
      aria-label="Corporate Action Maintenance workspace"
    >
      <header className="ca-maintenance-workspace__header">
        <div>
          <div className="ca-maintenance-workspace__eyebrow">Database Tools</div>
          <h1>Corporate Action Maintenance</h1>
          <p>
            Task 6A navigation foundation only. Maintenance business operations are intentionally
            not wired.
          </p>
        </div>

        <button
          type="button"
          className="ca-maintenance-workspace__close"
          onClick={onClose}
          aria-label="Close Corporate Action Maintenance and return to chart workspace"
        >
          Close
        </button>
      </header>

      <div className="ca-maintenance-workspace__body">
        <nav
          className="ca-maintenance-workspace__rail"
          aria-label="Corporate Action Maintenance sections"
        >
          {CORPORATE_ACTION_MAINTENANCE_SECTIONS.map((section) => {
            const active = section.id === activeSectionId;

            return (
              <button
                key={section.id}
                type="button"
                className="ca-maintenance-workspace__rail-item"
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveSectionId(section.id)}
              >
                {section.label}
              </button>
            );
          })}
        </nav>

        <main className="ca-maintenance-workspace__content">
          <div className="ca-maintenance-workspace__section-label">Maintenance section</div>
          <h2>{activeSection.label}</h2>
          <p>{activeSection.description}</p>

          <div className="ca-maintenance-workspace__foundation-note">
            <strong>Foundation only.</strong>
            <span>
              Business controls remain in the preserved legacy implementation until their approved
              characterization and parity tasks.
            </span>
          </div>
        </main>
      </div>
    </section>
  );
}