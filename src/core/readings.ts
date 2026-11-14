/**
 * @fileoverview Builds what one flower on the Farm shows: the full history for
 * a metric, its most recent real measurement, and whether that sits inside the
 * typical range.
 */

import { rangeStatus, type Reading, type Status } from '@/core/rangeStatus';
import type { Metric, VisitReading } from '@/core/types';

export type MetricSeries = {
  /** Every reading, oldest first. Empty for a metric never measured. */
  history: Reading[];
  /** The most recent reading that carries a usable number, if any. */
  latest: Reading | null;
  metric: Metric;
  status: Status;
};

/**
 * Tells whether a reading carries a number the card can display.
 *
 * A reading with a `null` value is a measurement the booth attempted and could
 * not take. It stays in the history, but it is not the number we show.
 *
 * @param reading - The reading to inspect.
 * @returns {boolean} - True when something was actually measured.
 */
export const hasMeasurement = (reading: Reading): boolean =>
  typeof reading.value === 'number' ||
  (typeof reading.systolic === 'number' &&
    typeof reading.diastolic === 'number');

/**
 * Orders readings oldest first, regardless of how they arrived.
 * @param readings - The readings to order.
 * @returns {Reading[]} - A new, sorted array.
 */
const byDate = (readings: Reading[]): Reading[] =>
  [...readings].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

/**
 * Assembles one metric's series from its seeded history plus anything recorded
 * during visits.
 * @param metric - The metric being assembled.
 * @param seeded - The history that shipped with the patient record.
 * @param visitReadings - Every reading recorded at a booth, for any metric.
 * @returns {MetricSeries} - What the flower card needs to render.
 */
export const buildSeries = (
  metric: Metric,
  seeded: Reading[],
  visitReadings: VisitReading[],
): MetricSeries => {
  const recorded = visitReadings
    .filter((reading) => reading.metricKey === metric.key)
    .map(({ metricKey: _metricKey, ...reading }) => reading);

  const history = byDate([...seeded, ...recorded]);
  const measured = history.filter(hasMeasurement);

  return {
    history,
    latest: measured.length > 0 ? measured[measured.length - 1] : null,
    metric,
    status: rangeStatus(history, metric.typical),
  };
};
