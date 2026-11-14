/**
 * @fileoverview Every reason the booth or the booking flow can refuse
 * something. Tests assert on these codes, so rewording a message can never
 * break a test and a rejection for the wrong reason can never pass one.
 */

import type { VisitEventType, VisitStatus } from '@/core/types';

export enum JanoErrorCode {
  /** The booth is not accepting visits right now. */
  BoothUnavailable = 'booth_unavailable',
  /** Presented too early or after the slot ended. */
  CheckInWindowClosed = 'check_in_window_closed',
  /** The visit is not in a status that allows this step. */
  IllegalTransition = 'illegal_transition',
  /** The code uses a format this booth does not understand. */
  PassBadVersion = 'pass_bad_version',
  /** The code is not a Jano pass, or is truncated. */
  PassMalformed = 'pass_malformed',
  /** The pass was scanned once already. */
  PassUsed = 'pass_used',
  /** The pass is past its expiry. */
  PassExpired = 'pass_expired',
  /** The pass belongs to another patient. */
  PassWrongPatient = 'pass_wrong_patient',
  /** No such pass on record. */
  PassUnknown = 'pass_unknown',
  /** The pass was issued for a different booth. */
  PassWrongBooth = 'pass_wrong_booth',
  /** Someone else took the slot first. */
  SlotTaken = 'slot_taken',
  /** No such slot. */
  SlotUnknown = 'slot_unknown',
  /** A reading arrived for a metric the booth does not measure. */
  UnknownMetric = 'unknown_metric',
  /** No such visit on record. */
  VisitUnknown = 'visit_unknown',
}

export type JanoFailure =
  | {
      boothId: string;
      boothStatus: string;
      code: JanoErrorCode.BoothUnavailable;
    }
  | {
      code: JanoErrorCode.CheckInWindowClosed;
      closesAt: number;
      now: number;
      opensAt: number;
    }
  | {
      code: JanoErrorCode.IllegalTransition;
      event: VisitEventType;
      from: VisitStatus;
    }
  | { code: JanoErrorCode.PassBadVersion; version: string }
  | { code: JanoErrorCode.PassMalformed }
  | {
      code: JanoErrorCode.PassUsed;
      jti: string;
      usedAt: number;
      usedByBoothId: string;
    }
  | { code: JanoErrorCode.PassExpired; expiresAt: number; now: number }
  | {
      code: JanoErrorCode.PassWrongPatient;
      expectedPatientId: string;
      passPatientId: string;
    }
  | { code: JanoErrorCode.PassUnknown; jti: string }
  | {
      code: JanoErrorCode.PassWrongBooth;
      passBoothId: string;
      scanningBoothId: string;
    }
  | { code: JanoErrorCode.SlotTaken; slotId: string }
  | { code: JanoErrorCode.SlotUnknown; slotId: string }
  | { code: JanoErrorCode.UnknownMetric; metricKey: string }
  | { code: JanoErrorCode.VisitUnknown; visitId: string };

const MESSAGES: Record<JanoErrorCode, string> = {
  [JanoErrorCode.BoothUnavailable]: 'This Temple is closed for maintenance.',
  [JanoErrorCode.CheckInWindowClosed]: 'This pass is not valid at this time.',
  [JanoErrorCode.IllegalTransition]: 'That step is not possible right now.',
  [JanoErrorCode.PassBadVersion]: 'This pass uses an unsupported format.',
  [JanoErrorCode.PassMalformed]: 'This is not a Jano pass.',
  [JanoErrorCode.PassUsed]: 'This pass has already been used.',
  [JanoErrorCode.PassExpired]: 'This pass has expired.',
  [JanoErrorCode.PassWrongPatient]: 'This pass belongs to another patient.',
  [JanoErrorCode.PassUnknown]: 'This pass is not on record.',
  [JanoErrorCode.PassWrongBooth]: 'This pass is for a different Temple.',
  [JanoErrorCode.SlotTaken]: 'That time has just been taken.',
  [JanoErrorCode.SlotUnknown]: 'That time is no longer offered.',
  [JanoErrorCode.UnknownMetric]: 'This Temple cannot measure that.',
  [JanoErrorCode.VisitUnknown]: 'That visit is not on record.',
};

/**
 * Turns a failure into the sentence the booth screen shows.
 * @param failure - The failure to describe.
 * @returns {string} - A patient-readable message.
 */
export const failureMessage = (failure: JanoFailure): string =>
  MESSAGES[failure.code];
