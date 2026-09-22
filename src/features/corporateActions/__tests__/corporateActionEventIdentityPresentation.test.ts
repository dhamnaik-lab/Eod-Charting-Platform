import { describe, expect, it } from 'vitest';
import type { CorporateActionEventIdentity } from '@/platform';
import {
  formatCorporateActionEventIdentityLabel,
  formatCorporateActionEventIdentityTitle,
  formatCorporateActionEventIsin,
} from '../corporateActionEventIdentityPresentation';

const resolvedIdentity: CorporateActionEventIdentity = {
  importId: 22969,
  exchange: 'NSE',
  rawSymbol: 'NAVA',
  rawIsin: 'INE725A01022',
  eventSymbol: 'NBVENTURES',
  eventIsin: null,
  resolved: true,
  resolutionType: 'NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL',
  resolutionAuthority: 'V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH',
  chainId: 'CHAIN-3070AD0C1A094900',
  transitionOldSymbol: 'NBVENTURES',
  transitionNewSymbol: 'NAVA',
  transitionEffectiveDate: '2022-07-29',
  rawIdentitySourceRef: 'E:\\TA Projects\\Corporate Actions Raw\\NSE\\Identity\\SymbolChanges\\nse_identity_symbol_changes.csv',
  rawIdentitySourceSha256: '921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6',
  rawIdentitySourceLineNumber: 532,
  resolutionFingerprint: 'abc',
};

describe('corporateActionEventIdentityPresentation', () => {
  it('shows raw and event symbols separately when V1.14E resolved', () => {
    expect(formatCorporateActionEventIdentityLabel(resolvedIdentity)).toBe('Event NSE:NBVENTURES');
    expect(formatCorporateActionEventIdentityTitle(resolvedIdentity)).toContain(
      'NBVENTURES → NAVA',
    );
  });

  it('does not invent a historical ISIN label', () => {
    expect(formatCorporateActionEventIsin(null)).toBe('Not independently established');
  });

  it('does not add a second identity label for unresolved fallback rows', () => {
    expect(
      formatCorporateActionEventIdentityLabel({
        ...resolvedIdentity,
        resolved: false,
        eventSymbol: 'NAVA',
        eventIsin: 'INE725A01022',
        resolutionType: null,
        resolutionAuthority: null,
        chainId: null,
        transitionOldSymbol: null,
        transitionNewSymbol: null,
        transitionEffectiveDate: null,
        rawIdentitySourceRef: null,
        rawIdentitySourceSha256: null,
        rawIdentitySourceLineNumber: null,
        resolutionFingerprint: null,
      }),
    ).toBe('');
  });
});
