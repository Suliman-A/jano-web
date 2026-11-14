/**
 * @fileoverview The visit lifecycle. Pure: the current time arrives with the
 * event, nothing is mutated, and a refused step comes back as a failure rather
 * than a thrown error.
 */

import { JanoErrorCode } from '@/core/errors';
import { err, ok, type Result } from '@/core/result';
import type {
  Visit,
  VisitEventType,
  VisitReading,
  VisitStatus,
} from '@/core/types';

export type VisitEvent =
  | { at: number; boothId: string; type: 'CHECK_IN' }
  | { at: number; reading: VisitReading; type: 'RECORD_READING' }
  | { at: number; type: 'CHECK_OUT' };

/**
 * Every legal move, as data. An event missing from a status's row is refused,
 * so adding a status without deciding its transitions fails closed.
 */
export const TRANSITIONS: Readonly<
  Record<VisitStatus, Partial<Record<VisitEventType, VisitStatus>>>
> = {
  checked_in: { CHECK_OUT: 'completed', RECORD_READING: 'checked_in' },
  completed: {},
  scheduled: { CHECK_IN: 'checked_in' },
};

/**
 * Tells whether a step is allowed from a given status.
 * @param from - The visit's current status.
 * @param event - The step being attempted.
 * @returns {boolean} - True when the step is legal.
 */
export const canTransition = (
  from: VisitStatus,
  event: VisitEventType,
): boolean => TRANSITIONS[from][event] !== undefined;

/**
 * Applies one step of the lifecycle.
 * @param visit - The visit as it stands.
 * @param event - What the patient or the booth did, carrying its own time.
 * @returns {Result<Visit>} - The updated visit, or why the step was refused.
 */
export const applyVisitEvent = (
  visit: Visit,
  event: VisitEvent,
): Result<Visit> => {
  const next = TRANSITIONS[visit.status][event.type];

  if (next === undefined) {
    return err({
      code: JanoErrorCode.IllegalTransition,
      event: event.type,
      from: visit.status,
    });
  }

  if (event.type === 'CHECK_IN') {
    if (event.boothId !== visit.boothId) {
      return err({
        code: JanoErrorCode.PassWrongBooth,
        passBoothId: visit.boothId,
        scanningBoothId: event.boothId,
      });
    }

    return ok({ ...visit, checkedInAt: event.at, status: next });
  }

  if (event.type === 'RECORD_READING') {
    return ok({
      ...visit,
      readings: [...visit.readings, event.reading],
      status: next,
    });
  }

  return ok({ ...visit, checkedOutAt: event.at, status: next });
};
