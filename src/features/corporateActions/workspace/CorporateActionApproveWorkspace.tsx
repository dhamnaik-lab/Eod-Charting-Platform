import type { CorporateActionNormalApprovalResult } from '../workflow/corporateActionNormalWorkflowAdapter';

export interface CorporateActionApproveWorkspaceProps {
  readyEventCount: number;
  readyImportCount: number;
  running: boolean;
  result: CorporateActionNormalApprovalResult | null;
  onApproveAllReady: () => void;
}

export function CorporateActionApproveWorkspace({
  readyEventCount,
  readyImportCount,
  running,
  result,
  onApproveAllReady,
}: CorporateActionApproveWorkspaceProps) {
  const alreadyProcessed = result
    ? result.recheck.alreadyProcessedImportIds.length + result.alreadyApproved
    : 0;

  return (
    <div className="corporate-action-approve-workspace" data-corporate-action-approve>
      <div className="corporate-action-workspace-action-row">
        <button
          type="button"
          className="corporate-action-workspace-primary-action"
          disabled={running || readyImportCount === 0}
          onClick={onApproveAllReady}
        >
          {running ? 'APPROVING...' : `APPROVE ALL READY · ${readyImportCount}`}
        </button>
        <span>
          {readyEventCount} Ready economic event(s). An authoritative recheck runs immediately before approval; only imports that still qualify as Ready are submitted in existing backend-safe batches.
        </span>
      </div>

      {result ? (
        <section aria-label="Corporate Action approval result">
          <div className="corporate-action-workspace-summary">
            <div><span>Approved</span><strong>{result.approved}</strong></div>
            <div><span>Linked existing</span><strong>{result.linkedExisting}</strong></div>
            <div><span>Already processed</span><strong>{alreadyProcessed}</strong></div>
            <div><span>Failed</span><strong>{result.failed}</strong></div>
            <div><span>Remaining Ready</span><strong>{result.postRecheck.readyImportIds.length}</strong></div>
          </div>
          <p className="corporate-action-workspace-stage-note">{result.message}</p>
          {result.errors.length ? (
            <div className="corporate-action-review-evidence-message" aria-label="Approval failures">
              {result.errors.slice(0, 5).map((failure) => (
                <p key={failure.importId}>Import #{failure.importId}: {failure.message}</p>
              ))}
              {result.errors.length > 5 ? <p>+{result.errors.length - 5} more failure(s)</p> : null}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="corporate-action-workspace-stage-note">
          No approval is executed until you choose Approve All Ready. Identity, ISIN, and price exceptions remain outside the Normal workflow.
        </p>
      )}
    </div>
  );
}
