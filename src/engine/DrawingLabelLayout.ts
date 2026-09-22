export type DrawingLabelSide = 'left' | 'right' | 'center';
export type DrawingLabelVerticalPlacement = 'center' | 'above' | 'below';

export interface DrawingLevelLabelBoxInput {
  anchorX: number;
  anchorY: number;
  textWidth: number;
  plotWidth: number;
  plotHeight: number;
  preferredSide?: DrawingLabelSide;
  gap?: number;
  paddingX?: number;
  boxHeight?: number;
  margin?: number;
  verticalPlacement?: DrawingLabelVerticalPlacement;
  verticalGap?: number;
}

export interface DrawingLevelLabelBox {
  left: number;
  top: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Places a compact level/value label next to its geometric anchor while keeping
 * the full label inside the drawable plot. If the preferred side would clip,
 * the opposite side is tried before the box is clamped as a last resort.
 */
export function computeDrawingLevelLabelBox(input: DrawingLevelLabelBoxInput): DrawingLevelLabelBox {
  const paddingX = input.paddingX ?? 5;
  const height = input.boxHeight ?? 18;
  const margin = input.margin ?? 3;
  const gap = input.gap ?? 4;
  const side = input.preferredSide ?? 'left';
  const verticalPlacement = input.verticalPlacement ?? 'center';
  const verticalGap = input.verticalGap ?? 3;
  const width = Math.max(1, Math.ceil(input.textWidth) + paddingX * 2);
  const minLeft = margin;
  const maxLeft = Math.max(input.plotWidth - margin - width, minLeft);

  const leftOfAnchor = input.anchorX - gap - width;
  const rightOfAnchor = input.anchorX + gap;
  const centeredOnAnchor = input.anchorX - width / 2;
  const fits = (left: number): boolean => left >= minLeft && left <= maxLeft;

  let left: number;
  if (side === 'center') {
    left = centeredOnAnchor;
  } else if (side === 'left') {
    left = fits(leftOfAnchor) ? leftOfAnchor : (fits(rightOfAnchor) ? rightOfAnchor : leftOfAnchor);
  } else {
    left = fits(rightOfAnchor) ? rightOfAnchor : (fits(leftOfAnchor) ? leftOfAnchor : rightOfAnchor);
  }

  left = clamp(left, minLeft, maxLeft);
  const minTop = margin;
  const maxTop = Math.max(input.plotHeight - margin - height, minTop);
  const aboveAnchor = input.anchorY - verticalGap - height;
  const belowAnchor = input.anchorY + verticalGap;
  const centeredVertically = input.anchorY - height / 2;
  const fitsVertically = (top: number): boolean => top >= minTop && top <= maxTop;
  const desiredTop = verticalPlacement === 'above'
    ? (fitsVertically(aboveAnchor) ? aboveAnchor : (fitsVertically(belowAnchor) ? belowAnchor : aboveAnchor))
    : verticalPlacement === 'below'
      ? (fitsVertically(belowAnchor) ? belowAnchor : (fitsVertically(aboveAnchor) ? aboveAnchor : belowAnchor))
      : centeredVertically;
  const top = clamp(desiredTop, minTop, maxTop);

  return {
    left,
    top,
    width,
    height,
    textX: left + paddingX,
    textY: top + height / 2,
  };
}


export interface InlineHorizontalLabelLayoutInput {
  leftX: number;
  rightX: number;
  textWidth: number;
  textPadding?: number;
  minVisibleSegment?: number;
}

export interface InlineHorizontalLabelLayout {
  textX: number;
  gapLeft: number;
  gapRight: number;
  leftSegment: { startX: number; endX: number } | null;
  rightSegment: { startX: number; endX: number } | null;
}

/**
 * Reserves a centered gap in a horizontal drawing line so text can sit on the
 * level without the stroke running through the glyphs ("--- text ---").
 */
export function computeInlineHorizontalLabelLayout(
  input: InlineHorizontalLabelLayoutInput,
): InlineHorizontalLabelLayout {
  const left = Math.min(input.leftX, input.rightX);
  const right = Math.max(input.leftX, input.rightX);
  const textPadding = input.textPadding ?? 7;
  const minVisibleSegment = input.minVisibleSegment ?? 4;
  const textX = (left + right) / 2;
  const halfGap = Math.max(0, input.textWidth / 2 + textPadding);
  const gapLeft = clamp(textX - halfGap, left, right);
  const gapRight = clamp(textX + halfGap, left, right);

  return {
    textX,
    gapLeft,
    gapRight,
    leftSegment: gapLeft - left >= minVisibleSegment ? { startX: left, endX: gapLeft } : null,
    rightSegment: right - gapRight >= minVisibleSegment ? { startX: gapRight, endX: right } : null,
  };
}
