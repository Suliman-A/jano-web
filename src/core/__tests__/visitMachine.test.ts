/**
 * @fileoverview Tests for the visit lifecycle.
 * @see {@link ../visitMachine.ts}
 */

import {
  BOOTH_AYALA_ID,
  BOOTH_POBLACION_ID,
  DURING_SLOT,
  makeVisit,
  makeVisitReading,
} from '@/core/__fixtures__/jano.fixtures';
import { JanoErrorCode } from '@/core/errors';
import type { VisitEventType, VisitStatus } from '@/core/types';
import { applyVisitEvent } from '@/core/visitMachine';

const TERMINAL_STATUSES: VisitStatus[] = ['completed'];
const EVERY_EVENT: VisitEventType[] = [
  'CHECK_IN',
  'CHECK_OUT',
  'RECORD_READING',
];

/**
 * @see {@link applyVisitEvent}
 *
 * security cases:
 * - should fail when checking in at a booth the visit was not booked for
 *
 * success cases:
 * - should successfully check in a scheduled visit and stamp the time
 * - should successfully record a reading and stay checked in
 * - should successfully record several readings in order
 * - should successfully complete a checked-in visit on check-out
 * - should successfully complete a visit with no readings recorded
 *
 * failure cases:
 * - should fail when checking out before checking in
 * - should fail when checking out a visit that is already completed
 * - should fail when recording a reading before check-in
 * - should fail when checking in a visit that is already checked in
 * - should fail without mutating the visit it was given
 * - should fail for every event from every terminal status
 */
describe('visitMachine', () => {
  describe('applyVisitEvent', () => {
    describe('security cases', () => {
      it('should fail when checking in at a booth the visit was not booked for', () => {
        // Arrange
        const visit = makeVisit({ boothId: BOOTH_AYALA_ID });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          boothId: BOOTH_POBLACION_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.PassWrongBooth,
            passBoothId: BOOTH_AYALA_ID,
            scanningBoothId: BOOTH_POBLACION_ID,
          },
          ok: false,
        });
      });
    });

    describe('success cases', () => {
      it('should successfully check in a scheduled visit and stamp the time', () => {
        // Arrange
        const visit = makeVisit();

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          boothId: BOOTH_AYALA_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result.ok).toBe(true);
        expect(result.ok && result.value.status).toBe('checked_in');
        expect(result.ok && result.value.checkedInAt).toBe(DURING_SLOT);
      });

      it('should successfully record a reading and stay checked in', () => {
        // Arrange
        const visit = makeVisit({ status: 'checked_in' });
        const reading = makeVisitReading();

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          reading,
          type: 'RECORD_READING',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('checked_in');
        expect(result.ok && result.value.readings).toEqual([reading]);
      });

      it('should successfully record several readings in order', () => {
        // Arrange
        const first = makeVisitReading({ metricKey: 'pulse', value: 70 });
        const second = makeVisitReading({ metricKey: 'spo2', value: 98 });
        const checkedIn = makeVisit({
          readings: [first],
          status: 'checked_in',
        });

        // Act
        const result = applyVisitEvent(checkedIn, {
          at: DURING_SLOT,
          reading: second,
          type: 'RECORD_READING',
        });

        // Assert
        expect(result.ok && result.value.readings).toEqual([first, second]);
      });

      it('should successfully complete a checked-in visit on check-out', () => {
        // Arrange
        const visit = makeVisit({ status: 'checked_in' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'CHECK_OUT',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('completed');
        expect(result.ok && result.value.checkedOutAt).toBe(DURING_SLOT);
      });

      it('should successfully complete a visit with no readings recorded', () => {
        // Arrange — a patient who walks out before the devices are used.
        const visit = makeVisit({ readings: [], status: 'checked_in' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'CHECK_OUT',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('completed');
      });
    });

    describe('failure cases', () => {
      it('should fail when checking out before checking in', () => {
        // Arrange
        const visit = makeVisit({ status: 'scheduled' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'CHECK_OUT',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.IllegalTransition,
            event: 'CHECK_OUT',
            from: 'scheduled',
          },
          ok: false,
        });
      });

      it('should fail when checking out a visit that is already completed', () => {
        // Arrange
        const visit = makeVisit({ status: 'completed' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'CHECK_OUT',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.IllegalTransition,
            event: 'CHECK_OUT',
            from: 'completed',
          },
          ok: false,
        });
      });

      it('should fail when recording a reading before check-in', () => {
        // Arrange
        const visit = makeVisit({ status: 'scheduled' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          reading: makeVisitReading(),
          type: 'RECORD_READING',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.IllegalTransition,
            event: 'RECORD_READING',
            from: 'scheduled',
          },
          ok: false,
        });
      });

      it('should fail when checking in a visit that is already checked in', () => {
        // Arrange
        const visit = makeVisit({ status: 'checked_in' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          boothId: BOOTH_AYALA_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.IllegalTransition,
            event: 'CHECK_IN',
            from: 'checked_in',
          },
          ok: false,
        });
      });

      it('should fail without mutating the visit it was given', () => {
        // Arrange
        const visit = makeVisit({ status: 'scheduled' });
        const before = JSON.stringify(visit);

        // Act
        applyVisitEvent(visit, { at: DURING_SLOT, type: 'CHECK_OUT' });

        // Assert
        expect(JSON.stringify(visit)).toBe(before);
      });

      describe.each(TERMINAL_STATUSES)('from %s', (status) => {
        it.each(EVERY_EVENT)(
          'should fail for the %s event',
          (event: VisitEventType) => {
            // Arrange
            const visit = makeVisit({ status });

            // Act
            const result = applyVisitEvent(visit, {
              at: DURING_SLOT,
              boothId: BOOTH_AYALA_ID,
              reading: makeVisitReading(),
              type: event,
            } as never);

            // Assert
            expect(result).toEqual({
              error: {
                code: JanoErrorCode.IllegalTransition,
                event,
                from: status,
              },
              ok: false,
            });
          },
        );
      });
    });
  });
});
