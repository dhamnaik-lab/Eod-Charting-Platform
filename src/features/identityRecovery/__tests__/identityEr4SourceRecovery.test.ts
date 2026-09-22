import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DESKTOP_TYPES = resolve(process.cwd(), 'src/types/desktop.ts');
const PLATFORM_TYPES = resolve(process.cwd(), 'src/platform/types.ts');
const TAURI_DESKTOP = resolve(process.cwd(), 'src/platform/tauriDesktop.ts');
const DATABASE_RS = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
const MAIN_RS = resolve(process.cwd(), 'src-tauri-shell/src/main.rs');
const SETTINGS_RS = resolve(process.cwd(), 'src-tauri-shell/src/database/settings.rs');
const VERSION_HISTORY_RS = resolve(
  process.cwd(),
  'src-tauri-shell/src/database/official_source_version_history.rs',
);
const CANDIDATE_REVIEW_RS = resolve(
  process.cwd(),
  'src-tauri-shell/src/database/official_source_candidate_review.rs',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Identity ER4-B source version ledger and manual compatibility', () => {
  it('wires the authority read and reviewed save commands while preserving later promotion separation', () => {
    const desktop = read(DESKTOP_TYPES);
    const platform = read(PLATFORM_TYPES);
    const tauri = read(TAURI_DESKTOP);
    const database = read(DATABASE_RS);
    const main = read(MAIN_RS);

    for (const command of [
      'get_official_source_configuration_authority',
      'save_official_source_urls_reviewed',
    ]) {
      expect(main).toContain(command);
    }
    expect(database).toContain('get_official_source_configuration_authority');
    expect(database).toContain('save_official_source_urls_reviewed');
    expect(desktop).toContain('getOfficialSourceConfigurationAuthority():');
    expect(desktop).toContain('saveOfficialSourceUrlsReviewed(');
    expect(platform).toContain("'getOfficialSourceConfigurationAuthority'");
    expect(platform).toContain("'saveOfficialSourceUrlsReviewed'");
    expect(tauri).toContain("tauriInvoke('get_official_source_configuration_authority')");
    expect(tauri).toContain("tauriInvoke('save_official_source_urls_reviewed'");
  });

  it('freezes all three ER4 ledger tables and blocks the generic setting bypass', () => {
    const backend = read(VERSION_HISTORY_RS);
    const settings = read(SETTINGS_RS);

    expect(backend).toContain('CREATE TABLE IF NOT EXISTS official_source_url_versions');
    expect(backend).toContain('CREATE TABLE IF NOT EXISTS official_source_url_current');
    expect(backend).toContain('CREATE TABLE IF NOT EXISTS official_source_review_events');
    expect(backend).toContain('BEGIN IMMEDIATE TRANSACTION');
    expect(settings).toContain('OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE');
  });

  it('keeps the existing Official Source URLs workflow while routing through reviewed saves', () => {
    const source = read(DATABASE_TOOLS);
    const load = sliceBetween(
      source,
      'const loadOfficialSourceUrls = async',
      'useEffect(() =>',
    );
    const save = sliceBetween(
      source,
      'const saveOfficialSourceUrls = async',
      'const resetOfficialSourceUrls',
    );
    const dialog = sliceBetween(
      source,
      'const renderOfficialSourceUrlDialog = () =>',
      'const renderIdentityInfoDialog',
    );

    expect(load).toContain('api.getOfficialSourceConfigurationAuthority()');
    expect(save).toContain('api.saveOfficialSourceUrlsReviewed({');
    expect(save).not.toContain('api.setSetting');
    expect(save).toContain("setOfficialSourceHealthReport(null)");
    expect(save).toContain('Official source URLs changed. Run Check Source Health again.');
    expect(save).toContain('Saved. Future downloads will use these URLs.');
    expect(save).toContain('Official source URLs saved.');
    expect(dialog).toContain('Official Source URLs');
    expect(dialog).toContain('Reset Defaults');
    expect(dialog).toContain('Apply URLs');
  });

  it('retains ER4-A review authority in the final ER4 source', () => {
    const review = read(CANDIDATE_REVIEW_RS);
    expect(review).toContain('ER4_CONFIG_V1');
    expect(review).toContain('ER4_VALIDATION_V1');
    expect(review).toContain('ER4_REVIEW_V1');
  });
});


describe('Identity ER4-C operator candidate review and durable non-mutating decisions', () => {
  it('wires discovery, decision and history commands alongside later promotion', () => {
    const desktop = read(DESKTOP_TYPES);
    const platform = read(PLATFORM_TYPES);
    const tauri = read(TAURI_DESKTOP);
    const database = read(DATABASE_RS);
    const main = read(MAIN_RS);

    for (const command of [
      'find_official_source_replacement_candidates',
      'record_official_source_candidate_decision',
      'list_official_source_history',
    ]) {
      expect(main).toContain(command);
      expect(database).toContain(command);
    }
    expect(desktop).toContain('findOfficialSourceReplacementCandidates(');
    expect(desktop).toContain('recordOfficialSourceCandidateDecision(');
    expect(desktop).toContain('listOfficialSourceHistory(');
    expect(platform).toContain("'findOfficialSourceReplacementCandidates'");
    expect(platform).toContain("'recordOfficialSourceCandidateDecision'");
    expect(platform).toContain("'listOfficialSourceHistory'");
    expect(tauri).toContain("tauriInvoke('find_official_source_replacement_candidates'");
    expect(tauri).toContain("tauriInvoke('record_official_source_candidate_decision'");
    expect(tauri).toContain("tauriInvoke('list_official_source_history'");
  });

  it('exposes candidate discovery only through the exact five NSE health mappings', () => {
    const source = read(DATABASE_TOOLS);
    const mapping = sliceBetween(
      source,
      'function getEr4RecoveryRequestForHealthResult(',
      'function buildCorporateActionRefreshNote',
    );
    for (const sourceId of [
      'NSE_EQUITY_MASTER',
      'NSE_SME_MASTER',
      'NSE_SYMBOL_CHANGE',
      'NSE_COMPANY_NAME_CHANGE',
      'NSE_DELISTED_WORKBOOK',
    ]) {
      expect(mapping).toContain(sourceId);
    }
    expect(mapping).not.toContain('NSE_DELISTED_LANDING');
    expect(mapping).not.toContain('BSE_LIST_SCRIPS');
    expect(mapping).toContain("result.exchange !== 'NSE'");
    expect(source).toContain('Find Official Replacement Candidates');
  });

  it('shows all frozen classifications and preserves Keep/Reject decisions after promotion is added', () => {
    const source = read(DATABASE_TOOLS);

    for (const classification of [
      'DISCOVERED_NOT_PROMOTED',
      'VALIDATED_CANDIDATE_NOT_PROMOTED',
      'INDETERMINATE_CANDIDATE',
      'REJECTED_CANDIDATE',
    ]) {
      expect(source).toContain(classification);
    }
    expect(source).toContain('Keep Current URL');
    expect(source).toContain('Reject Candidate');
    expect(source).toContain('Rejection note');
  });

  it('clears stale review state and reloads source authority without auto-retrying', () => {
    const source = read(DATABASE_TOOLS);
    const decision = sliceBetween(
      source,
      'const recordOfficialSourceCandidateDecision = async',
      'const resetOfficialSourceUrls',
    );

    expect(decision).toContain("message.includes('ER4_STALE_REJECTED')");
    expect(decision).toContain('setOfficialSourceCandidateResult(null)');
    expect(decision).toContain('setOfficialSourceHistory([])');
    expect(decision).toContain('await loadOfficialSourceUrls()');
    expect(decision).not.toContain('findOfficialReplacementCandidates(');
  });

  it('retains the manual Official Source URLs dialog alongside candidate history UI', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain('Official Source URLs');
    expect(source).toContain('Apply URLs');
    expect(source).toContain('Source version / review history');
    expect(source).toContain('api.listOfficialSourceHistory({ sourceKey })');
  });
});


describe('Identity ER4-D explicit stale-fenced promotion', () => {
  it('wires reviewed promotion and exact post-health without I3/I4 coupling', () => {
    const desktop = read(DESKTOP_TYPES);
    const platform = read(PLATFORM_TYPES);
    const tauri = read(TAURI_DESKTOP);
    const database = read(DATABASE_RS);
    const main = read(MAIN_RS);
    const review = read(CANDIDATE_REVIEW_RS);

    expect(database).toContain('promote_official_source_candidate_reviewed');
    expect(main).toContain('promote_official_source_candidate_reviewed');
    expect(desktop).toContain('promoteOfficialSourceCandidateReviewed(');
    expect(platform).toContain("'promoteOfficialSourceCandidateReviewed'");
    expect(tauri).toContain("tauriInvoke('promote_official_source_candidate_reviewed'");
    expect(review).not.toContain('apply_nse_current_universe_sync(');
    expect(review).not.toContain('apply_nse_historical_identity_archive(');
  });

  it('shows Approve Replacement only for validated promotable candidates with explicit warning', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain('Approve Replacement');
    expect(source).toContain("candidate.classification === 'VALIDATED_CANDIDATE_NOT_PROMOTED'");
    expect(source).toContain('This changes only the configured official source URL.');
    expect(source).toContain('It does not import data or execute I3/I4 Apply.');
  });
});


describe('Identity ER4-E reviewed rollback and post-health retry', () => {
  it('wires rollback review, rollback apply and health retry commands', () => {
    const desktop = read(DESKTOP_TYPES);
    const platform = read(PLATFORM_TYPES);
    const tauri = read(TAURI_DESKTOP);
    const database = read(DATABASE_RS);
    const main = read(MAIN_RS);

    for (const command of [
      'create_official_source_rollback_review',
      'apply_official_source_rollback_reviewed',
      'retry_official_source_post_health',
    ]) {
      expect(database).toContain(command);
      expect(main).toContain(command);
    }
    expect(desktop).toContain('createOfficialSourceRollbackReview(');
    expect(desktop).toContain('applyOfficialSourceRollbackReviewed(');
    expect(desktop).toContain('retryOfficialSourcePostHealth(');
    expect(platform).toContain("'createOfficialSourceRollbackReview'");
    expect(platform).toContain("'applyOfficialSourceRollbackReviewed'");
    expect(platform).toContain("'retryOfficialSourcePostHealth'");
    expect(tauri).toContain("tauriInvoke('create_official_source_rollback_review'");
    expect(tauri).toContain("tauriInvoke('apply_official_source_rollback_reviewed'");
    expect(tauri).toContain("tauriInvoke('retry_official_source_post_health'");
  });

  it('shows explicit rollback and retry controls without automatic rollback', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain('Review Rollback');
    expect(source).toContain('Apply Reviewed Rollback');
    expect(source).toContain('Retry Health Check');
    expect(source).not.toContain('autoRollback');
    expect(source).not.toContain('automatic rollback');
  });

  it('renders immutable history evidence and gates rollback to prior eligible NSE versions', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain('version {entry.versionId}');
    expect(source).toContain('Parent version: {entry.parentVersionId ??');
    expect(source).toContain('Candidate SHA-256: {entry.candidateContentSha256 ??');
    expect(source).toContain('Post-health: {entry.postHealthStatus}');
    expect(source).toContain("selectedCandidateAuthority?.exchange === 'NSE'");
    expect(source).toContain('selectedCandidateAuthority.candidatePromotionEligible');
  });

  it('requires explicit rollback confirmation and preserves history/I3-I4 separation', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain('This creates a new ROLLBACK source version using the selected historical URL.');
    expect(source).toContain('It preserves history and does not execute I3/I4 Apply.');
    expect(source).toContain('no second rollback was automatic');
    expect(source).not.toContain('autoRollback');
  });

});
