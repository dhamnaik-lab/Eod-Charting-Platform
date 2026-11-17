import type { Dispatch, SetStateAction } from 'react';
import type { MarketMoversFilterSettings } from './marketMoversTypes';
import { marketMoversStyles } from './marketMoversStyles';

type FilterCriteria = Pick<
  MarketMoversFilterSettings,
  'minPrice' | 'minVolume' | 'excludeCorporateActionWarnings'
>;

export function normalizeMarketMoversFilterDraft(draft: MarketMoversFilterSettings): FilterCriteria {
  return {
    minPrice: Math.max(0, Number(draft.minPrice) || 0),
    minVolume: Math.max(0, Math.floor(Number(draft.minVolume) || 0)),
    excludeCorporateActionWarnings: draft.excludeCorporateActionWarnings,
  };
}

interface MarketMoversFilterControlsProps {
  draftSettings: MarketMoversFilterSettings;
  onDraftSettingsChange: Dispatch<SetStateAction<MarketMoversFilterSettings>>;
  onCancel: () => void;
  onApply: () => void;
}

export function MarketMoversFilterControls({
  draftSettings,
  onDraftSettingsChange,
  onCancel,
  onApply,
}: MarketMoversFilterControlsProps) {
  return (
    <>
      <strong>Market Movers Filters</strong>
      <label style={marketMoversStyles.filterLabel}>
        Minimum close price
        <input
          type="number"
          min={0}
          value={draftSettings.minPrice}
          onChange={(event) =>
            onDraftSettingsChange((current) => ({
              ...current,
              minPrice: Number(event.target.value),
            }))
          }
          style={marketMoversStyles.numberInput}
        />
      </label>
      <label style={marketMoversStyles.filterLabel}>
        Minimum volume
        <input
          type="number"
          min={0}
          value={draftSettings.minVolume}
          onChange={(event) =>
            onDraftSettingsChange((current) => ({
              ...current,
              minVolume: Number(event.target.value),
            }))
          }
          style={marketMoversStyles.numberInput}
        />
      </label>
      <label style={{ ...marketMoversStyles.filterLabel, flexDirection: 'row' }}>
        <input
          type="checkbox"
          checked={draftSettings.excludeCorporateActionWarnings}
          onChange={(event) =>
            onDraftSettingsChange((current) => ({
              ...current,
              excludeCorporateActionWarnings: event.target.checked,
            }))
          }
        />
        Exclude warned corporate actions
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" style={marketMoversStyles.iconButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" style={marketMoversStyles.primaryButton} onClick={onApply}>
          Apply
        </button>
      </div>
    </>
  );
}
