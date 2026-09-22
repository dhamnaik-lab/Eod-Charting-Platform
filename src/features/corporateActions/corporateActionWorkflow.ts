export const CORPORATE_ACTION_WORKFLOW_STAGES = ['fetch', 'load', 'review', 'approve'] as const;

export type CorporateActionWorkflowStage = (typeof CORPORATE_ACTION_WORKFLOW_STAGES)[number];

export const CORPORATE_ACTION_EVENT_STATUSES = [
  'READY',
  'NEEDS_REVIEW',
  'CONFLICT',
  'APPROVED',
  'ALREADY_PROCESSED',
] as const;

export type CorporateActionEventStatus = (typeof CORPORATE_ACTION_EVENT_STATUSES)[number];

export const CORPORATE_ACTION_EVENT_STATUS_LABELS: Readonly<Record<CorporateActionEventStatus, string>> = {
  READY: 'Ready',
  NEEDS_REVIEW: 'Needs Review',
  CONFLICT: 'Conflict',
  APPROVED: 'Approved',
  ALREADY_PROCESSED: 'Already Processed',
};

export type CorporateActionLoadState = 'idle' | 'processing' | 'interrupted' | 'complete';
export type CorporateActionApprovalState = 'idle' | 'processing' | 'partial' | 'complete';

export interface CorporateActionWorkflowFacts {
  fetchRetryRequired: boolean;
  hasFetchedBatchPendingLoad: boolean;
  loadState: CorporateActionLoadState;
  hasProcessedBatchPendingReview: boolean;
  reviewCheckpointCompleted: boolean;
  remainingReadyCount: number;
  approvalState: CorporateActionApprovalState;
}

export type CorporateActionWorkflowResumeReason =
  | 'FETCH_REQUIRED'
  | 'FETCH_RETRY_REQUIRED'
  | 'LOAD_PENDING'
  | 'LOAD_RESUME_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_RESUME_REQUIRED'
  | 'CYCLE_COMPLETE';

export type CorporateActionWorkflowStageState = 'complete' | 'current' | 'locked';

export interface CorporateActionWorkflowStageView {
  id: CorporateActionWorkflowStage;
  label: string;
  state: CorporateActionWorkflowStageState;
}

export interface CorporateActionWorkflowModel {
  currentStage: CorporateActionWorkflowStage;
  resumeReason: CorporateActionWorkflowResumeReason;
  stages: readonly CorporateActionWorkflowStageView[];
}

const STAGE_LABELS: Readonly<Record<CorporateActionWorkflowStage, string>> = {
  fetch: 'Fetch Data',
  load: 'Load',
  review: 'Review',
  approve: 'Approve',
};

function assertWorkflowFacts(facts: CorporateActionWorkflowFacts): void {
  if (!Number.isInteger(facts.remainingReadyCount) || facts.remainingReadyCount < 0) {
    throw new Error('remainingReadyCount must be a non-negative integer');
  }
}

export function deriveCorporateActionWorkflowStage(
  facts: CorporateActionWorkflowFacts,
): Pick<CorporateActionWorkflowModel, 'currentStage' | 'resumeReason'> {
  assertWorkflowFacts(facts);

  if (facts.approvalState === 'processing' || facts.approvalState === 'partial') {
    return {
      currentStage: 'approve',
      resumeReason: 'APPROVAL_RESUME_REQUIRED',
    };
  }

  if (facts.loadState === 'processing' || facts.loadState === 'interrupted') {
    return {
      currentStage: 'load',
      resumeReason: 'LOAD_RESUME_REQUIRED',
    };
  }

  if (facts.fetchRetryRequired) {
    return {
      currentStage: 'fetch',
      resumeReason: 'FETCH_RETRY_REQUIRED',
    };
  }

  if (facts.hasFetchedBatchPendingLoad) {
    return {
      currentStage: 'load',
      resumeReason: 'LOAD_PENDING',
    };
  }

  if (facts.hasProcessedBatchPendingReview && !facts.reviewCheckpointCompleted) {
    return {
      currentStage: 'review',
      resumeReason: 'REVIEW_REQUIRED',
    };
  }

  if (facts.reviewCheckpointCompleted && facts.remainingReadyCount > 0) {
    return {
      currentStage: 'approve',
      resumeReason: 'APPROVAL_REQUIRED',
    };
  }

  return {
    currentStage: 'fetch',
    resumeReason: facts.reviewCheckpointCompleted ? 'CYCLE_COMPLETE' : 'FETCH_REQUIRED',
  };
}

export function buildCorporateActionWorkflowModel(
  facts: CorporateActionWorkflowFacts,
): CorporateActionWorkflowModel {
  const { currentStage, resumeReason } = deriveCorporateActionWorkflowStage(facts);
  const currentIndex = CORPORATE_ACTION_WORKFLOW_STAGES.indexOf(currentStage);

  return {
    currentStage,
    resumeReason,
    stages: CORPORATE_ACTION_WORKFLOW_STAGES.map((id, index) => ({
      id,
      label: STAGE_LABELS[id],
      state: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'locked',
    })),
  };
}

export function isCorporateActionStatusApprovalCandidate(status: CorporateActionEventStatus): boolean {
  return status === 'READY';
}
