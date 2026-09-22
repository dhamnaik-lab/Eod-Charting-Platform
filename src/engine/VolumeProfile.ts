import type { OHLCBar, VolumeProfileBucket } from './types';

export function computeVolumeProfile(
  bars: OHLCBar[],
  startIndex: number,
  endIndex: number,
  bucketCount: number,
): VolumeProfileBucket[] {
  const visibleBars = bars.slice(
    Math.max(0, startIndex),
    Math.min(bars.length, endIndex + 1)
  );

  if (visibleBars.length === 0) {
    return [];
  }

  // Find price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const bar of visibleBars) {
    if (bar.low < minPrice) minPrice = bar.low;
    if (bar.high > maxPrice) maxPrice = bar.high;
  }

  if (minPrice === Infinity || maxPrice === -Infinity || minPrice === maxPrice) {
    return [];
  }

  // Initialize buckets
  const bucketSize = (maxPrice - minPrice) / bucketCount;
  const buckets: VolumeProfileBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      priceBottom: minPrice + i * bucketSize,
      priceTop: minPrice + (i + 1) * bucketSize,
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      isPOC: false,
    });
  }

  // Distribute volume
  for (const bar of visibleBars) {
    const isUpBar = bar.close >= bar.open;
    const barVolume = bar.volume;
    
    // Find intersecting buckets
    const startBucketIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((bar.low - minPrice) / bucketSize)));
    const endBucketIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((bar.high - minPrice) / bucketSize)));
    
    const bucketsCountForBar = endBucketIdx - startBucketIdx + 1;
    const volumePerBucket = barVolume / bucketsCountForBar;

    for (let i = startBucketIdx; i <= endBucketIdx; i++) {
      if (isUpBar) {
        buckets[i].buyVolume += volumePerBucket;
      } else {
        buckets[i].sellVolume += volumePerBucket;
      }
      buckets[i].totalVolume += volumePerBucket;
    }
  }

  // Find Point of Control (POC)
  let maxVol = -1;
  let pocIdx = -1;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].totalVolume > maxVol) {
      maxVol = buckets[i].totalVolume;
      pocIdx = i;
    }
  }
  
  if (pocIdx !== -1) {
    buckets[pocIdx].isPOC = true;
  }

  return buckets;
}
