/**
 * @fileoverview Turns the provided sample JSON into typed data, and generates
 * the bookable slots a real backend would hold in a table.
 */

import type { Reading, Typical } from '@/core/rangeStatus';
import type {
  Booth,
  BoothFunctionKey,
  Metric,
  MetricKey,
  Patient,
  Slot,
} from '@/core/types';

import sampleData from './sample-data.json';

export const SLOT_LENGTH_MS = 30 * 60 * 1000;
export const DAYS_OF_SLOTS = 3;

export const patient: Patient = sampleData.patient;

export const booths: Booth[] = sampleData.booths as Booth[];

export const boothFunctions = sampleData.boothFunctions as Record<
  BoothFunctionKey,
  string
>;

export const metrics: Metric[] = sampleData.metrics.map((metric) => ({
  explain: metric.explain,
  flower: metric.flower,
  key: metric.key as MetricKey,
  label: metric.label,
  typical: metric.typical as Typical,
  unit: metric.unit,
}));

/** The readings that existed before the patient ever opened the app. */
export const seededHistory: Record<MetricKey, Reading[]> =
  sampleData.metrics.reduce(
    (history, metric) => ({
      ...history,
      [metric.key]: metric.history as Reading[],
    }),
    {} as Record<MetricKey, Reading[]>,
  );

/**
 * Reads `08:00-20:00` into minutes from midnight.
 * @param hours - The booth's opening hours.
 * @returns {{ closeMinutes: number; openMinutes: number }} - The two bounds.
 */
const parseHours = (
  hours: string,
): { closeMinutes: number; openMinutes: number } => {
  const [open, close] = hours.split('-');
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);

    return h * 60 + m;
  };

  return { closeMinutes: toMinutes(close), openMinutes: toMinutes(open) };
};

/**
 * A stable pseudo-random number for an id, so "unavailable" slots stay
 * unavailable across reloads without being stored.
 * @param seed - Any string.
 * @returns {number} - A number in [0, 1).
 */
const hashToUnitInterval = (seed: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000;
};

/** Roughly one slot in five is already taken by someone else. */
const UNAVAILABLE_SHARE = 0.2;

/**
 * Builds every slot a booth offers over the next few days.
 *
 * Slot ids are derived from the booth and the start time, so the same slot
 * keeps its identity across reloads without being persisted.
 *
 * @param now - The current time, in epoch milliseconds.
 * @returns {Slot[]} - Every slot, oldest first.
 */
export const generateSlots = (now: number): Slot[] => {
  const slots: Slot[] = [];
  const startOfToday = new Date(now);

  startOfToday.setHours(0, 0, 0, 0);

  booths.forEach((booth) => {
    const { closeMinutes, openMinutes } = parseHours(booth.hours);

    for (let day = 0; day < DAYS_OF_SLOTS; day += 1) {
      const dayStart = startOfToday.getTime() + day * 24 * 60 * 60 * 1000;

      for (
        let minutes = openMinutes;
        minutes + SLOT_LENGTH_MS / 60000 <= closeMinutes;
        minutes += SLOT_LENGTH_MS / 60000
      ) {
        const startsAt = dayStart + minutes * 60 * 1000;

        if (startsAt <= now) {
          continue;
        }

        const id = `slt_${booth.id}_${startsAt}`;

        slots.push({
          boothId: booth.id,
          endsAt: startsAt + SLOT_LENGTH_MS,
          id,
          isAvailable: hashToUnitInterval(id) >= UNAVAILABLE_SHARE,
          startsAt,
        });
      }
    }
  });

  return slots.sort((a, b) => a.startsAt - b.startsAt);
};
