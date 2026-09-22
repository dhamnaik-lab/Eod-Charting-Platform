import type { CorporateActionEventIdentity } from '@/platform';

export function formatCorporateActionEventIdentityLabel(
  identity: CorporateActionEventIdentity | null | undefined,
): string {
  if (!identity?.resolved || !identity.eventSymbol) {
    return '';
  }
  return `Event ${identity.exchange}:${identity.eventSymbol}`;
}

export function formatCorporateActionEventIdentityTitle(
  identity: CorporateActionEventIdentity | null | undefined,
): string {
  if (!identity?.resolved) {
    return 'No separate historical event identity is stored; raw source identity is used.';
  }
  const transition =
    identity.transitionOldSymbol && identity.transitionNewSymbol
      ? `${identity.transitionOldSymbol} → ${identity.transitionNewSymbol}`
      : 'transition unavailable';
  const effective = identity.transitionEffectiveDate ?? 'date unavailable';
  return `Historical event identity ${identity.exchange}:${identity.eventSymbol ?? '-'}; ${transition}; effective ${effective}. Raw source identity remains unchanged.`;
}

export function formatCorporateActionEventIsin(eventIsin: string | null | undefined): string {
  return eventIsin ?? 'Not independently established';
}
