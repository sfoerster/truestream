/**
 * Compute a weighted moving average with recency bias.
 * More recent values receive proportionally higher weight when recencyBias > 0.
 *
 * @param values - Array of numeric values to average
 * @param windowSize - Number of most recent values to consider
 * @param recencyBias - Bias toward recent values (0.0 = uniform, 1.0 = max recency bias)
 * @returns The weighted average, or 0 if no values
 */
export function weightedMovingAverage(
  values: number[],
  windowSize: number,
  recencyBias: number,
): number {
  if (values.length === 0) return 0;

  const window = values.slice(-windowSize);
  const n = window.length;

  if (n === 1) return window[0];

  const bias = Math.max(0, Math.min(1, recencyBias));

  let weightSum = 0;
  let valueSum = 0;

  for (let i = 0; i < n; i++) {
    const position = i / (n - 1);
    const weight = 1 + bias * (2 * position - 1);
    weightSum += weight;
    valueSum += window[i] * weight;
  }

  return valueSum / weightSum;
}

/**
 * Check whether the last N consecutive values are all above or below a threshold.
 *
 * @param values - Array of numeric values
 * @param n - Number of consecutive values to check (from the end)
 * @param threshold - The threshold to compare against
 * @param direction - Whether values must be 'above' or 'below' the threshold
 * @returns true if the last n values all satisfy the condition
 */
export function consecutiveThreshold(
  values: number[],
  n: number,
  threshold: number,
  direction: 'above' | 'below',
): boolean {
  if (values.length < n) return false;

  const tail = values.slice(-n);

  if (direction === 'above') {
    return tail.every((v) => v > threshold);
  } else {
    return tail.every((v) => v < threshold);
  }
}
