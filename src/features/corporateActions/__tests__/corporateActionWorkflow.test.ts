import { describe, expect, it } from 'vitest';
import {
  CORPORATE_ACTION_EVENT_STATUSES,
  CORPORATE_ACTION_EVENT_STATUS_LABELS,
  CORPORATE_ACTION_WORKFLOW_STAGES,
  buildCorporateActionWorkflowModel,
  deriveCorporateActionWorkflowStage,
  isCorporateActionStatusApprovalCandidate,
  type CorporateActionWorkflowFacts,
} from '../corporateActionWorkflow';

const baseFacts = (): CorporateActionWorkflowFacts => ({
  fetchRetryRequired: false,
  hasFetchedBatchPendingLoad: false,
  loadState: 'idle',
  hasProcessedBatchPendingReview: false,
  reviewCheckpointCompleted: false,
  remainingReadyCount: 0,
  approvalState: 'idle',
});

describe('Corporate Action workflow model', () => {
  it('exposes the approved four-stage order and five user-facing statuses', () => {
    expect(CORPORATE_ACTION_WORKFLOW_STAGES).toEqual(['fetch', 'load', 'review', 'approve']);
    expect(CORPORATE_ACTION_EVENT_STATUSES).toEqual([
      'READY',
      'NEEDS_REVIEW',
      'CONFLICT',
      'APPROVED',
      'ALREADY_PROCESSED',
    ]);
    expect(CORPORATE_ACTION_EVENT_STATUS_LABELS).toEqual({
      READY: 'Ready',
      NEEDS_REVIEW: 'Needs Review',
      CONFLICT: 'Conflict',
      APPROVED: 'Approved',
      ALREADY_PROCESSED: 'Already Processed',
    });
  });

  it('starts at Fetch when there is no pending workflow work', () => {
    expect(deriveCorporateActionWorkflowStage(baseFacts())).toEqual({
      currentStage: 'fetch',
      resumeReason: 'FETCH_REQUIRED',
    });
  });

  it('keeps an incomplete Fetch at Fetch for retry', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        fetchRetryRequired: true,
      }),
    ).toEqual({
      currentStage: 'fetch',
      resumeReason: 'FETCH_RETRY_REQUIRED',
    });
  });

  it('resumes at Load when fetched data is waiting to be loaded', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        hasFetchedBatchPendingLoad: true,
      }),
    ).toEqual({
      currentStage: 'load',
      resumeReason: 'LOAD_PENDING',
    });
  });

  it('resumes an interrupted Load without returning control to the user', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        loadState: 'interrupted',
      }),
    ).toEqual({
      currentStage: 'load',
      resumeReason: 'LOAD_RESUME_REQUIRED',
    });
  });

  it('requires Review after processing even when there are zero Ready events', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        loadState: 'complete',
        hasProcessedBatchPendingReview: true,
        remainingReadyCount: 0,
      }),
    ).toEqual({
      currentStage: 'review',
      resumeReason: 'REVIEW_REQUIRED',
    });
  });

  it('continues to Approve after the Review checkpoint when Ready events remain', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        loadState: 'complete',
        hasProcessedBatchPendingReview: true,
        reviewCheckpointCompleted: true,
        remainingReadyCount: 531,
      }),
    ).toEqual({
      currentStage: 'approve',
      resumeReason: 'APPROVAL_REQUIRED',
    });
  });

  it('resumes a partial approval before any other idle-stage work', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        fetchRetryRequired: true,
        approvalState: 'partial',
        remainingReadyCount: 3,
      }),
    ).toEqual({
      currentStage: 'approve',
      resumeReason: 'APPROVAL_RESUME_REQUIRED',
    });
  });

  it('starts a new Fetch cycle after Review when no Ready events remain', () => {
    expect(
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        loadState: 'complete',
        hasProcessedBatchPendingReview: true,
        reviewCheckpointCompleted: true,
        remainingReadyCount: 0,
        approvalState: 'complete',
      }),
    ).toEqual({
      currentStage: 'fetch',
      resumeReason: 'CYCLE_COMPLETE',
    });
  });

  it('marks prior stages complete and future stages locked', () => {
    expect(
      buildCorporateActionWorkflowModel({
        ...baseFacts(),
        loadState: 'complete',
        hasProcessedBatchPendingReview: true,
      }).stages,
    ).toEqual([
      { id: 'fetch', label: 'Fetch Data', state: 'complete' },
      { id: 'load', label: 'Load', state: 'complete' },
      { id: 'review', label: 'Review', state: 'current' },
      { id: 'approve', label: 'Approve', state: 'locked' },
    ]);
  });

  it('treats only READY as an approval candidate in the user-facing model', () => {
    expect(isCorporateActionStatusApprovalCandidate('READY')).toBe(true);
    expect(isCorporateActionStatusApprovalCandidate('NEEDS_REVIEW')).toBe(false);
    expect(isCorporateActionStatusApprovalCandidate('CONFLICT')).toBe(false);
    expect(isCorporateActionStatusApprovalCandidate('APPROVED')).toBe(false);
    expect(isCorporateActionStatusApprovalCandidate('ALREADY_PROCESSED')).toBe(false);
  });

  it('fails closed on an invalid negative Ready count', () => {
    expect(() =>
      deriveCorporateActionWorkflowStage({
        ...baseFacts(),
        remainingReadyCount: -1,
      }),
    ).toThrow('remainingReadyCount must be a non-negative integer');
  });
});
