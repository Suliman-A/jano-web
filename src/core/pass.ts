/**
 * @fileoverview The check-in pass: the string that goes into the QR code, and
 * the checks a booth can run on it without talking to a server.
 *
 * The code is readable on purpose rather than base64: a pass you can print in
 * a document, paste into the booth simulator and read in a test failure is
 * easier to reason about, and encoding it would hide nothing — the payload is
 * deliberately not secret.
 *
 *     jano.1.bkg_7fa2.bth_ayala.pt_demo_001.jti_4d9c1e.1763131200000
 *
 * It carries no name and no readings: a QR code is photographable, so the
 * booth resolves the patient id over its own channel.
 */

import { JanoErrorCode } from '@/core/errors';
import { err, ok, type Result } from '@/core/result';
import type { PassPayload } from '@/core/types';

export const PASS_PREFIX = 'jano';
export const PASS_VERSION = '1';
const FIELD_SEPARATOR = '.';
const FIELD_COUNT = 7;

/**
 * Renders a pass as the string that goes into the QR code.
 * @param payload - The pass fields to encode.
 * @returns {string} - The scannable code.
 */
export const encodePass = (payload: PassPayload): string =>
  [
    PASS_PREFIX,
    PASS_VERSION,
    payload.bookingId,
    payload.boothId,
    payload.patientId,
    payload.jti,
    String(payload.expiresAt),
  ].join(FIELD_SEPARATOR);

/**
 * Reads a scanned code back into pass fields.
 *
 * Shape and version only — it says nothing about whether the pass is still
 * valid, which is what {@link verifyPass} is for.
 *
 * @param raw - The scanned or pasted string.
 * @returns {Result<PassPayload>} - The fields, or why the code is unreadable.
 */
export const decodePass = (raw: string): Result<PassPayload> => {
  const fields = raw.trim().split(FIELD_SEPARATOR);

  if (fields.length !== FIELD_COUNT || fields.some((field) => field === '')) {
    return err({ code: JanoErrorCode.PassMalformed });
  }

  const [prefix, version, bookingId, boothId, patientId, jti, expiresAtRaw] =
    fields;

  if (prefix !== PASS_PREFIX) {
    return err({ code: JanoErrorCode.PassMalformed });
  }

  if (version !== PASS_VERSION) {
    return err({ code: JanoErrorCode.PassBadVersion, version });
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isInteger(expiresAt)) {
    return err({ code: JanoErrorCode.PassMalformed });
  }

  return ok({ bookingId, boothId, expiresAt, jti, patientId });
};

type VerifyOptions = {
  now: number;
  scanningBoothId: string;
};

/**
 * Runs every check a booth can make from the code alone — no store, no
 * network. A booth on poor mobile data can still refuse a stale pass or one
 * meant for another Temple.
 *
 * Whether the pass was already used cannot be answered here: that is not in
 * the characters, and is checked against the store at check-in.
 *
 * @param raw - The scanned or pasted string.
 * @param options - The scanning booth and the current time.
 * @returns {Result<PassPayload>} - The fields, or the first failed check.
 */
export const verifyPass = (
  raw: string,
  options: VerifyOptions,
): Result<PassPayload> => {
  const decoded = decodePass(raw);

  if (!decoded.ok) {
    return decoded;
  }

  const payload = decoded.value;

  if (payload.expiresAt <= options.now) {
    return err({
      code: JanoErrorCode.PassExpired,
      expiresAt: payload.expiresAt,
      now: options.now,
    });
  }

  if (payload.boothId !== options.scanningBoothId) {
    return err({
      code: JanoErrorCode.PassWrongBooth,
      passBoothId: payload.boothId,
      scanningBoothId: options.scanningBoothId,
    });
  }

  return ok(payload);
};
