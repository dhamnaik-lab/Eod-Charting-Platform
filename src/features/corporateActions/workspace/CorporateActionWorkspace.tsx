import type { ReactNode } from 'react';
import type { CorporateActionWorkflowStage } from '../corporateActionWorkflow';
import {
  CorporateActionWorkflowHeader,
  type CorporateActionWorkspaceCounts,
} from './CorporateActionWorkflowHeader';
import './corporateActionWorkspace.css';

export interface CorporateActionWorkspaceProps {
  activeStage: CorporateActionWorkflowStage;
  counts: CorporateActionWorkspaceCounts;
  onClose: () => void;
  stageContent?: ReactNode;
  statusContent?: ReactNode;
}

const CORPORATE_ACTION_SECTIONS = [
  ['actions', 'Actions'],
  ['identity', 'Identity & History'],
  ['reports', 'History & Reports'],
  ['maintenance', 'Maintenance'],
] as const;

export type CorporateActionSection = (typeof CORPORATE_ACTION_SECTIONS)[number][0];

interface UnifiedWorkspaceProps {
  section: CorporateActionSection;
  onSectionChange: (section: CorporateActionSection) => void;
  busy: boolean;
  children: ReactNode;
}

const STAGE_COPY: Readonly<
  Record<CorporateActionWorkflowStage, { title: string; description: string }>
> = {
  fetch: {
    title: 'Fetch Data',
    description: 'Fetch the routine latest official NSE and BSE coverage with existing cache and duplicate protection.',
  },
  load: {
    title: 'Load',
    description: 'Load the complete review queue and run existing deterministic validation and recommendation checks.',
  },
  review: {
    title: 'Review',
    description: 'Grouped economic-event review cards will be connected in a later workflow task.',
  },
  approve: {
    title: 'Approve',
    description: 'Final approval execution will be connected in a later workflow task.',
  },
};

export function CorporateActionWorkspace(props: CorporateActionWorkspaceProps | UnifiedWorkspaceProps) {
  if ('section' in props) {
    const { section, onSectionChange, busy, children } = props;
    const label = CORPORATE_ACTION_SECTIONS.find(([id]) => id === section)?.[1];
    return (
      <section className="corporate-action-workspace" data-corporate-action-workspace aria-label="Corporate Actions workspace">
        <nav className="corporate-action-section-nav" aria-label="Corporate Actions sections">
          {CORPORATE_ACTION_SECTIONS.map(([id, title]) => (
            <button key={id} type="button" aria-current={id === section ? 'page' : undefined}
              disabled={busy && id !== section} onClick={() => onSectionChange(id)}>
              {title}
            </button>
          ))}
        </nav>
        <section className="corporate-action-section-content" aria-label={label}>
          {children}
        </section>
      </section>
    );
  }
  return <CorporateActionStageWorkspace {...props} />;
}

function CorporateActionStageWorkspace({
  activeStage,
  counts,
  onClose,
  stageContent,
  statusContent,
}: CorporateActionWorkspaceProps) {
  const stageCopy = STAGE_COPY[activeStage];

  return (
    <section
      className="corporate-action-workspace"
      data-corporate-action-workspace
      aria-label="Corporate Actions"
    >
      <header className="corporate-action-workspace-topbar">
        <div className="corporate-action-workspace-heading">
          <span className="corporate-action-workspace-eyebrow">Database Tools</span>
          <h1>Corporate Actions</h1>
          <p>Fetch Data → Load → Review → Approve</p>
        </div>
        <button
          type="button"
          className="corporate-action-workspace-close"
          onClick={onClose}
          aria-label="Close Corporate Actions and return to chart workspace"
        >
          Close
        </button>
      </header>

      <CorporateActionWorkflowHeader activeStage={activeStage} counts={counts} />

      <main className="corporate-action-workspace-body">
        <section
          className="corporate-action-workspace-stage"
          data-stage-slot={activeStage}
          aria-labelledby="corporate-action-stage-title"
        >
          <div className="corporate-action-workspace-stage-copy">
            <span className="corporate-action-workspace-stage-kicker">Current step</span>
            <h2 id="corporate-action-stage-title">{stageCopy.title}</h2>
            <p>{stageCopy.description}</p>
          </div>

          {stageContent ? (
            <div className="corporate-action-workspace-stage-content">{stageContent}</div>
          ) : null}

          {statusContent}

          <div
            className="corporate-action-workspace-summary"
            aria-label="Corporate Action workflow counts"
          >
            <div>
              <span>Ready</span>
              <strong>{counts.ready}</strong>
            </div>
            <div>
              <span>Needs Review</span>
              <strong>{counts.needsReview}</strong>
            </div>
            <div>
              <span>Conflicts</span>
              <strong>{counts.conflicts}</strong>
            </div>
            <div>
              <span>Loaded</span>
              <strong>{counts.loaded}</strong>
            </div>
          </div>
        </section>
      </main>
    </section>
  );
}
