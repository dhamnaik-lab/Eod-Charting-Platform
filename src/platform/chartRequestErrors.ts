/** An obsolete read must never publish data or be mistaken for a source failure. */
export class ChartDataRequestSupersededError extends Error {
  constructor(message = 'Chart data request was superseded.') {
    super(message);
    this.name = 'ChartDataRequestSupersededError';
  }
}

/** Retry a still-owned read once, joining the newer read rather than forcing it out. */
export async function readLatestChartData<T>(
  read: (retry: boolean) => Promise<T>,
  isCurrent: () => boolean,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read(attempt > 0);
    } catch (error) {
      if (!(error instanceof ChartDataRequestSupersededError) || !isCurrent()) throw error;
      if (attempt === 0) continue;
      throw new Error('Chart data changed repeatedly during refresh. Please reload this chart.');
    }
  }
}
