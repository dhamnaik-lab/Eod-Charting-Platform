import {
  CORPORATE_ACTION_WORKFLOW_STAGES,
  type CorporateActionWorkflowStage,
} from '../corporateActionWorkflow';

export interface CorporateActionWorkspaceCounts {
  fetched: number;
  loaded: number;
  needsReview: number;
  conflicts: number;
  ready: number;
}

interface CorporateActionWorkflowHeaderProps {
  activeStage: CorporateActionWorkflowStage;
  counts: CorporateActionWorkspaceCounts;
}

const STAGE_LABELS: Readonly<Record<CorporateActionWorkflowStage, string>> = {
  fetch: 'Fetch Data',
  load: 'Load',
  review: 'Review',
  approve: 'Approve',
};

function countForStage(
  stage: CorporateActionWorkflowStage,
  counts: CorporateActionWorkspaceCounts,
): number {
  if (stage === 'fetch') return counts.fetched;
  if (stage === 'load') return counts.loaded;
  if (stage === 'review') return counts.needsReview + counts.conflicts;
  return counts.ready;
}

export function CorporateActionWorkflowHeader({
  activeStage,
  counts,
}: CorporateActionWorkflowHeaderProps) {
  const activeIndex = CORPORATE_ACTION_WORKFLOW_STAGES.indexOf(activeStage);

  return (
    <nav
      className="corporate-action-workflow-header"
      aria-label="Corporate Action workflow"
    >
      <ol className="corporate-action-workflow-steps">
        {CORPORATE_ACTION_WORKFLOW_STAGES.map((stage, index) => {
          const state =
            index < activeIndex ? 'complete' : index === activeIndex ? 'current' : 'locked';

          return (
            <li
              key={stage}
              className="corporate-action-workflow-step"
              data-stage={stage}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              aria-disabled={state === 'locked' ? true : undefined}
            >
              <span className="corporate-action-workflow-step-index">
                {index + 1}
              </span>
              <span className="corporate-action-workflow-step-copy">
                <span className="corporate-action-workflow-step-label">
                  {STAGE_LABELS[stage]}
                </span>
                <span className="corporate-action-workflow-step-count">
                  {countForStage(stage, counts)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
