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

export function CorporateActionWorkspace({
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
