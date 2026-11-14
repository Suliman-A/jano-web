/**
 * @fileoverview Tests for the per-metric series behind each flower, and for
 * the booths whose location is unknown.
 * @see {@link ../readings.ts}
 * @see {@link ../booths.ts}
 */

import { distanceFrom, hasLocation, sortByDistance } from '@/core/booths';
import { buildSeries } from '@/core/readings';
import type { Metric, VisitReading } from '@/core/types';
import {
  DATE_AUGUST,
  DATE_OCTOBER,
  DATE_SEPTEMBER,
  makeReading,
  PULSE_MAX,
  PULSE_MIN,
  RANGED_TYPICAL,
} from '@/core/__fixtures__/jano.fixtures';
import type { Booth } from '@/core/types';

const MAKATI = { lat: 14.5547, lng: 121.0244 };

const PULSE_METRIC: Metric = {
  explain: 'How many times your heart beats in a minute while you rest.',
  flower: 'Tulip',
  key: 'pulse',
  label: 'Pulse rate',
  typical: RANGED_TYPICAL,
  unit: 'bpm',
};

const WEIGHT_METRIC: Metric = {
  explain: 'Your weight, measured on the booth scale.',
  flower: 'Sunflower',
  key: 'weight',
  label: 'Body weight',
  typical: null,
  unit: 'kg',
};

/**
 * Builds a booth with the location the test cares about.
 * @param overrides - Fields to change for the case under test.
 * @returns {Booth} - The booth.
 */
const makeBooth = (overrides: Partial<Booth> = {}): Booth => ({
  area: 'Makati',
  functions: ['basic'],
  hours: '08:00-20:00',
  id: 'bth_test',
  lat: 14.5547,
  lng: 121.0244,
  name: 'Test Booth',
  status: 'open',
  ...overrides,
});

/**
 * @see {@link buildSeries}
 *
 * success cases:
 * - should successfully build a dormant series for a metric never measured
 * - should successfully report no status for a metric with no typical range
 * - should successfully skip a failed measurement when picking the latest
 * - should successfully merge readings taken at a booth into the history
 * - should successfully order the history oldest first
 *
 * failure cases:
 * - should fail to place a booth with no coordinates on the map
 * - should fail to measure a distance to a booth with no coordinates
 * - should fail to sort an unlocated booth anywhere but last
 */
describe('readings', () => {
  describe('buildSeries', () => {
    describe('success cases', () => {
      it('should successfully build a dormant series for a metric never measured', () => {
        // Act
        const series = buildSeries(WEIGHT_METRIC, [], []);

        // Assert
        expect(series.history).toEqual([]);
        expect(series.latest).toBeNull();
        expect(series.status).toBe('none');
      });

      it('should successfully report no status for a metric with no typical range', () => {
        // Arrange
        const seeded = [makeReading(DATE_OCTOBER, 60.9)];

        // Act
        const series = buildSeries(WEIGHT_METRIC, seeded, []);

        // Assert
        expect(series.latest).toEqual(seeded[0]);
        expect(series.status).toBe('none');
      });

      it('should successfully skip a failed measurement when picking the latest', () => {
        // Arrange — the booth could not weigh the patient on the last visit.
        const seeded = [
          makeReading(DATE_SEPTEMBER, 61.8),
          makeReading(DATE_OCTOBER, null),
        ];

        // Act
        const series = buildSeries(WEIGHT_METRIC, seeded, []);

        // Assert
        expect(series.history).toHaveLength(2);
        expect(series.latest).toEqual(seeded[0]);
      });

      it('should successfully merge readings taken at a booth into the history', () => {
        // Arrange
        const seeded = [makeReading(DATE_AUGUST, PULSE_MIN)];
        const recorded: VisitReading[] = [
          { date: DATE_OCTOBER, metricKey: 'pulse', value: PULSE_MAX },
          { date: DATE_OCTOBER, metricKey: 'weight', value: 60 },
        ];

        // Act
        const series = buildSeries(PULSE_METRIC, seeded, recorded);

        // Assert — only this metric's readings, and the new one is latest.
        expect(series.history).toHaveLength(2);
        expect(series.latest?.value).toBe(PULSE_MAX);
      });

      it('should successfully order the history oldest first', () => {
        // Arrange
        const seeded = [
          makeReading(DATE_OCTOBER, 80),
          makeReading(DATE_AUGUST, 72),
        ];

        // Act
        const series = buildSeries(PULSE_METRIC, seeded, []);

        // Assert
        expect(series.history.map((reading) => reading.date)).toEqual([
          DATE_AUGUST,
          DATE_OCTOBER,
        ]);
      });
    });
  });

  describe('booths', () => {
    describe('failure cases', () => {
      it('should fail to place a booth with no coordinates on the map', () => {
        // Arrange
        const booth = makeBooth({ lat: null, lng: null });

        // Act
        const result = hasLocation(booth);

        // Assert
        expect(result).toBe(false);
      });

      it('should fail to measure a distance to a booth with no coordinates', () => {
        // Arrange
        const booth = makeBooth({ lat: null, lng: null });

        // Act
        const distance = distanceFrom(booth, MAKATI);

        // Assert — Infinity, never NaN, so comparisons still behave.
        expect(distance).toBe(Infinity);
        expect(Number.isNaN(distance)).toBe(false);
      });

      it('should fail to sort an unlocated booth anywhere but last', () => {
        // Arrange
        const unlocated = makeBooth({
          id: 'bth_rockwell',
          lat: null,
          lng: null,
        });
        const near = makeBooth({ id: 'bth_ayala' });
        const far = makeBooth({ id: 'bth_shaw', lat: 14.5814, lng: 121.0537 });

        // Act
        const sorted = sortByDistance([unlocated, far, near], MAKATI);

        // Assert
        expect(sorted.map((booth) => booth.id)).toEqual([
          'bth_ayala',
          'bth_shaw',
          'bth_rockwell',
        ]);
      });
    });
  });
});
