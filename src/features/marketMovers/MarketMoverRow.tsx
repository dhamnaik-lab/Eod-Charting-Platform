import React, { useEffect, useRef, useState } from 'react';
import type { NormalizedMoverRecord } from './marketMoversTypes';
import { marketMoversStyles } from './marketMoversStyles';

interface MarketMoverRowProps {
  record: NormalizedMoverRecord;
  index: number;
  selected: boolean;
  metric: 'change' | 'volume';
  onSelect: (record: NormalizedMoverRecord) => void;
  onOpenActive: (record: NormalizedMoverRecord) => void;
  onOpenNewTab: (record: NormalizedMoverRecord) => void;
  onContextMenu?: (event: React.MouseEvent, record: NormalizedMoverRecord) => void;
}

export function MarketMoverRow({
  record,
  index,
  selected,
  metric,
  onSelect,
  onOpenActive,
  onOpenNewTab,
  onContextMenu,
}: MarketMoverRowProps) {
  const [hovered, setHovered] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  const handleClick = () => {
    onSelect(record);
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onOpenActive(record);
    }, 220);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onSelect(record);
    onOpenNewTab(record);
  };

  const positive = record.changePercent >= 0;
  return (
    <div
      id={`market-mover-row-${index}`}
      data-market-mover-index={index}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      style={{
        ...marketMoversStyles.row,
        ...(hovered ? marketMoversStyles.rowHovered : null),
        ...(selected ? marketMoversStyles.rowSelected : null),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect(record);
        onContextMenu?.(event, record);
      }}
    >
      <div style={marketMoversStyles.symbolCol}>
        <span style={marketMoversStyles.symbolText} title={`${record.exchange}:${record.symbol}`}>
          {record.symbol}
          {record.corporateActionWarning ? (
            <span
              style={{ ...marketMoversStyles.badge, ...marketMoversStyles.warningBadge }}
              title={record.corporateActionWarning}
            >
              CA
            </span>
          ) : null}
        </span>
        <span style={marketMoversStyles.exchangeText}>{record.exchange}</span>
      </div>
      <div style={marketMoversStyles.priceCol}>₹{record.close.toFixed(2)}</div>
      <div
        style={{
          ...marketMoversStyles.changeCol,
          ...(metric === 'volume'
            ? marketMoversStyles.volumeCol
            : positive
              ? marketMoversStyles.greenText
              : marketMoversStyles.redText),
        }}
      >
        {metric === 'volume'
          ? record.volumeRatio20 !== null
            ? `${record.volumeRatio20.toFixed(1)}x`
            : record.volume.toLocaleString('en-IN')
          : `${positive ? '+' : ''}${record.changePercent.toFixed(2)}%`}
      </div>
    </div>
  );
}
