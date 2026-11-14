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
  MINUTE_MS,
  SLOT_ENDS_AT,
  SLOT_STARTS_AT,
} from '@/core/__fixtures__/jano.fixtures';
import { JanoErrorCode } from '@/core/errors';
import type { VisitEventType, VisitStatus } from '@/core/types';
import { applyVisitEvent, CHECK_IN_LEAD_MS } from '@/core/visitMachine';

const TERMINAL_STATUSES: VisitStatus[] = ['cancelled', 'completed', 'no_show'];
const EVERY_EVENT: VisitEventType[] = [
  'CANCEL',
  'CHECK_IN',
  'CHECK_OUT',
  'EXPIRE',
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
 * - should successfully check in at the earliest moment the window opens
 * - should successfully record a reading and stay checked in
 * - should successfully complete a checked-in visit on check-out
 * - should successfully cancel a visit before its slot starts
 * - should successfully mark a visit as a no-show once the slot has passed
 *
 * failure cases:
 * - should fail when checking out before checking in
 * - should fail when checking out a visit that is already completed
 * - should fail when recording a reading before check-in
 * - should fail when cancelling after check-in
 * - should fail when checking in before the window opens
 * - should fail when checking in after the slot has ended
 * - should fail when expiring a visit whose slot is still running
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

      it('should successfully check in at the earliest moment the window opens', () => {
        // Arrange
        const visit = makeVisit();
        const opensAt = SLOT_STARTS_AT - CHECK_IN_LEAD_MS;

        // Act
        const result = applyVisitEvent(visit, {
          at: opensAt,
          boothId: BOOTH_AYALA_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('checked_in');
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

      it('should successfully cancel a visit before its slot starts', () => {
        // Arrange
        const visit = makeVisit();
        const beforeSlot = SLOT_STARTS_AT - MINUTE_MS;

        // Act
        const result = applyVisitEvent(visit, {
          at: beforeSlot,
          type: 'CANCEL',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('cancelled');
        expect(result.ok && result.value.cancelledAt).toBe(beforeSlot);
      });

      it('should successfully mark a visit as a no-show once the slot has passed', () => {
        // Arrange
        const visit = makeVisit();

        // Act
        const result = applyVisitEvent(visit, {
          at: SLOT_ENDS_AT + MINUTE_MS,
          type: 'EXPIRE',
        });

        // Assert
        expect(result.ok && result.value.status).toBe('no_show');
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

      it('should fail when cancelling after check-in', () => {
        // Arrange
        const visit = makeVisit({ status: 'checked_in' });

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'CANCEL',
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.IllegalTransition,
            event: 'CANCEL',
            from: 'checked_in',
          },
          ok: false,
        });
      });

      it('should fail when checking in before the window opens', () => {
        // Arrange
        const visit = makeVisit();

        // Act
        const result = applyVisitEvent(visit, {
          at: SLOT_STARTS_AT - CHECK_IN_LEAD_MS - 1,
          boothId: BOOTH_AYALA_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe(
          JanoErrorCode.CheckInWindowClosed,
        );
      });

      it('should fail when checking in after the slot has ended', () => {
        // Arrange
        const visit = makeVisit();

        // Act
        const result = applyVisitEvent(visit, {
          at: SLOT_ENDS_AT + 1,
          boothId: BOOTH_AYALA_ID,
          type: 'CHECK_IN',
        });

        // Assert
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe(
          JanoErrorCode.CheckInWindowClosed,
        );
      });

      it('should fail when expiring a visit whose slot is still running', () => {
        // Arrange
        const visit = makeVisit();

        // Act
        const result = applyVisitEvent(visit, {
          at: DURING_SLOT,
          type: 'EXPIRE',
        });

        // Assert
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe(
          JanoErrorCode.CheckInWindowClosed,
        );
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
