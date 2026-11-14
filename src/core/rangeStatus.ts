/**
 * @fileoverview Decides whether a metric's most recent reading sits inside its
 * typical range. Drives the "In typical range" pill on the Farm flower card.
 */

export type Reading = {
  date: string;
  value?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
};

/**
 * Either a two-sided range (`min`/`max`, e.g. pulse) or the one-sided blood
 * pressure shape (`systolicBelow`/`diastolicBelow`). `null` means the metric
 * has no published typical range at all, such as body weight.
 */
export type Typical = {
  min?: number;
  max?: number;
  systolicBelow?: number;
  diastolicBelow?: number;
} | null;

/** `none` means "cannot say", not "fine". */
export type Status = 'in' | 'above' | 'below' | 'none';

type BloodPressureTypical = {
  systolicBelow: number;
  diastolicBelow: number;
};

/** A reading that actually carries both blood pressure numbers. */
type BloodPressureReading = Reading & {
  diastolic: number;
  systolic: number;
};

/** A reading that actually carries a single measured value. */
type ValueReading = Reading & { value: number };

/**
 * Narrows a typical range to the blood pressure shape.
 * @param typical - The metric's typical range.
 * @returns {boolean} - True when both blood pressure bounds are present.
 */
const isBloodPressureTypical = (
  typical: NonNullable<Typical>,
): typical is BloodPressureTypical =>
  typeof typical.systolicBelow === 'number' &&
  typeof typical.diastolicBelow === 'number';

/**
 * Parses an ISO date into a sortable number.
 * @param date - An ISO date such as `2026-10-29`.
 * @returns {number} - Epoch milliseconds, or `-Infinity` when unparseable.
 */
const toTime = (date: string): number => {
  const time = Date.parse(date);

  return Number.isNaN(time) ? -Infinity : time;
};

/**
 * Picks the most recent reading that actually carries a usable measurement.
 *
 * Readings are not assumed to be in date order, and a reading whose value is
 * `null` (the booth tried and failed) is skipped rather than treated as zero —
 * so the status always describes the same number the card displays.
 *
 * The guard is a type predicate rather than a plain boolean, so the reading
 * that comes back is already narrowed and the caller needs no assertion to
 * read the number it just filtered for.
 *
 * @param history - Every reading recorded for the metric.
 * @param hasValue - Tells whether a reading carries the value we need.
 * @returns {T | null} - The reading to judge, or `null` when there is none.
 */
const latestUsable = <T extends Reading>(
  history: Reading[],
  hasValue: (reading: Reading) => reading is T,
): T | null =>
  history
    .filter(hasValue)
    .reduce<T | null>(
      (latest, reading) =>
        latest === null || toTime(reading.date) > toTime(latest.date)
          ? reading
          : latest,
      null,
    );

/**
 * Compares a metric's latest reading against its typical range.
 * @param history - Every reading recorded for the metric, in any order.
 * @param typical - The typical range, or `null` when the metric has none.
 * @returns {Status} - `none` whenever there is not enough information to judge.
 */
export const rangeStatus = (history: Reading[], typical: Typical): Status => {
  if (!typical) {
    return 'none';
  }

  if (isBloodPressureTypical(typical)) {
    const latest = latestUsable(
      history,
      (reading): reading is BloodPressureReading =>
        typeof reading.systolic === 'number' &&
        typeof reading.diastolic === 'number',
    );

    if (!latest) {
      return 'none';
    }

    const isAbove =
      latest.systolic >= typical.systolicBelow ||
      latest.diastolic >= typical.diastolicBelow;

    return isAbove ? 'above' : 'in';
  }

  const latest = latestUsable(
    history,
    (reading): reading is ValueReading => typeof reading.value === 'number',
  );

  if (!latest) {
    return 'none';
  }

  if (typeof typical.max === 'number' && latest.value > typical.max) {
    return 'above';
  }

  if (typeof typical.min === 'number' && latest.value < typical.min) {
    return 'below';
  }

  return 'in';
};
