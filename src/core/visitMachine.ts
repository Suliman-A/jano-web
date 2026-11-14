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

/**
 * How early a patient may check in before their slot starts.
 *
 * Two hours is generous for a real booth, where fifteen minutes would be
 * normal. It is deliberate: the prototype has no way to travel in time, so a
 * tight window would make the flow impossible to demonstrate without waiting
 * for the slot to come round. The rule itself is unchanged — presenting a pass
 * outside the window is still refused, and still tested both ways.
 */
export const CHECK_IN_LEAD_MS = 2 * 60 * 60 * 1000;

export type VisitEvent =
  | { at: number; boothId: string; type: 'CHECK_IN' }
  | { at: number; reading: VisitReading; type: 'RECORD_READING' }
  | { at: number; type: 'CANCEL' }
  | { at: number; type: 'CHECK_OUT' }
  | { at: number; type: 'EXPIRE' };

/**
 * Every legal move, as data. An event missing from a status's row is refused,
 * so adding a status without deciding its transitions fails closed.
 */
export const TRANSITIONS: Readonly<
  Record<VisitStatus, Partial<Record<VisitEventType, VisitStatus>>>
> = {
  cancelled: {},
  checked_in: { CHECK_OUT: 'completed', RECORD_READING: 'checked_in' },
  completed: {},
  no_show: {},
  scheduled: { CANCEL: 'cancelled', CHECK_IN: 'checked_in', EXPIRE: 'no_show' },
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
 * The window during which a pass may be presented at the booth.
 * @param visit - The visit to measure.
 * @returns {{ closesAt: number; opensAt: number }} - The window bounds.
 */
const checkInWindow = (
  visit: Visit,
): { closesAt: number; opensAt: number } => ({
  closesAt: visit.scheduledUntil,
  opensAt: visit.scheduledFor - CHECK_IN_LEAD_MS,
});

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

  const { closesAt, opensAt } = checkInWindow(visit);

  if (event.type === 'CHECK_IN') {
    if (event.boothId !== visit.boothId) {
      return err({
        code: JanoErrorCode.PassWrongBooth,
        passBoothId: visit.boothId,
        scanningBoothId: event.boothId,
      });
    }

    if (event.at < opensAt || event.at > closesAt) {
      return err({
        closesAt,
        code: JanoErrorCode.CheckInWindowClosed,
        now: event.at,
        opensAt,
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

  if (event.type === 'CHECK_OUT') {
    return ok({ ...visit, checkedOutAt: event.at, status: next });
  }

  if (event.type === 'CANCEL') {
    if (event.at >= visit.scheduledFor) {
      return err({
        closesAt,
        code: JanoErrorCode.CheckInWindowClosed,
        now: event.at,
        opensAt,
      });
    }

    return ok({ ...visit, cancelledAt: event.at, status: next });
  }

  if (event.at <= visit.scheduledUntil) {
    return err({
      closesAt,
      code: JanoErrorCode.CheckInWindowClosed,
      now: event.at,
      opensAt,
    });
  }

  return ok({ ...visit, status: next });
};
