/**
 * @fileoverview Tests for rangeStatus.
 * @see {@link ../rangeStatus.ts}
 */

import {
  BLOOD_PRESSURE_TYPICAL,
  DATE_AUGUST,
  DATE_OCTOBER,
  DATE_SEPTEMBER,
  DIASTOLIC_BELOW,
  makeBloodPressureReading,
  makeReading,
  PULSE_MAX,
  PULSE_MIN,
  RANGED_TYPICAL,
  SYSTOLIC_BELOW,
} from '@/core/__fixtures__/jano.fixtures';
import { rangeStatus } from '@/core/rangeStatus';

const IN_RANGE_PULSE = 72;
const ABOVE_RANGE_PULSE = 128;
const BELOW_RANGE_PULSE = 44;

/**
 * @see {@link rangeStatus}
 *
 * success cases:
 * - should successfully report a value inside a two-sided range as in range
 * - should successfully report a value over the maximum as above
 * - should successfully report a value under the minimum as below
 * - should successfully treat the boundary values as in range
 * - should successfully pick the latest reading by date rather than by position
 * - should successfully report blood pressure under both bounds as in range
 * - should successfully report blood pressure as above when only the diastolic
 *   is high
 * - should successfully treat a systolic equal to the bound as above
 * - should successfully skip a failed measurement and judge the last real one
 *
 * failure cases:
 * - should fail to judge a metric whose history is empty
 * - should fail to judge a metric that has no typical range
 * - should fail to judge a metric whose only reading has a null value
 * - should fail to judge blood pressure when the diastolic is missing
 */
describe('rangeStatus', () => {
  describe('two-sided ranges', () => {
    describe('success cases', () => {
      it('should successfully report a value inside a two-sided range as in range', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, IN_RANGE_PULSE)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });

      it('should successfully report a value over the maximum as above', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, ABOVE_RANGE_PULSE)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('above');
      });

      it('should successfully report a value under the minimum as below', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, BELOW_RANGE_PULSE)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('below');
      });

      it('should successfully treat the maximum boundary value as in range', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, PULSE_MAX)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });

      it('should successfully treat the minimum boundary value as in range', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, PULSE_MIN)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });

      it('should successfully pick the latest reading by date rather than by position', () => {
        // Arrange — the out-of-range reading is last in the array but older.
        const history = [
          makeReading(DATE_OCTOBER, IN_RANGE_PULSE),
          makeReading(DATE_AUGUST, ABOVE_RANGE_PULSE),
        ];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });

      it('should successfully skip a failed measurement and judge the last real one', () => {
        // Arrange — the booth failed to weigh the patient on the latest visit.
        const history = [
          makeReading(DATE_SEPTEMBER, IN_RANGE_PULSE),
          makeReading(DATE_OCTOBER, null),
        ];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });
    });

    describe('failure cases', () => {
      it('should fail to judge a metric whose history is empty', () => {
        // Act
        const status = rangeStatus([], RANGED_TYPICAL);

        // Assert
        expect(status).toBe('none');
      });

      it('should fail to judge a metric that has no typical range', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, IN_RANGE_PULSE)];

        // Act
        const status = rangeStatus(history, null);

        // Assert
        expect(status).toBe('none');
      });

      it('should fail to judge a metric whose only reading has a null value', () => {
        // Arrange
        const history = [makeReading(DATE_OCTOBER, null)];

        // Act
        const status = rangeStatus(history, RANGED_TYPICAL);

        // Assert
        expect(status).toBe('none');
      });
    });
  });

  describe('blood pressure', () => {
    describe('success cases', () => {
      it('should successfully report blood pressure under both bounds as in range', () => {
        // Arrange
        const history = [makeBloodPressureReading(DATE_OCTOBER, 112, 74)];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('in');
      });

      it('should successfully report blood pressure as above when only the diastolic is high', () => {
        // Arrange — the systolic alone would read as in range.
        const history = [makeBloodPressureReading(DATE_OCTOBER, 118, 95)];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('above');
      });

      it('should successfully treat a systolic equal to the bound as above', () => {
        // Arrange — the bound is named "systolicBelow", so 120 is not below it.
        const history = [
          makeBloodPressureReading(DATE_OCTOBER, SYSTOLIC_BELOW, 70),
        ];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('above');
      });

      it('should successfully treat a diastolic equal to the bound as above', () => {
        // Arrange
        const history = [
          makeBloodPressureReading(DATE_OCTOBER, 110, DIASTOLIC_BELOW),
        ];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('above');
      });
    });

    describe('failure cases', () => {
      it('should fail to judge blood pressure when the diastolic is missing', () => {
        // Arrange
        const history = [makeBloodPressureReading(DATE_OCTOBER, 112, null)];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('none');
      });

      it('should fail to judge blood pressure when the systolic is zero and unmeasured', () => {
        // Arrange — a falsy but present systolic must not fall through to the
        // single-value branch.
        const history = [makeReading(DATE_OCTOBER, IN_RANGE_PULSE)];

        // Act
        const status = rangeStatus(history, BLOOD_PRESSURE_TYPICAL);

        // Assert
        expect(status).toBe('none');
      });
    });
  });
});
