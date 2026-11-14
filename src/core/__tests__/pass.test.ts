/**
 * @fileoverview Tests for encoding and checking a check-in pass.
 * @see {@link ../pass.ts}
 */

import {
  BOOKING_ID,
  BOOTH_AYALA_ID,
  BOOTH_POBLACION_ID,
  DURING_SLOT,
  JTI,
  makePassPayload,
  MINUTE_MS,
  PATIENT_ID,
  SLOT_ENDS_AT,
} from '@/core/__fixtures__/jano.fixtures';
import { JanoErrorCode } from '@/core/errors';
import { decodePass, encodePass, PASS_PREFIX, verifyPass } from '@/core/pass';

const PATIENT_NAME = 'Sophia Alvarez';
const MAX_QR_LENGTH = 200;

/**
 * @see {@link encodePass}
 * @see {@link decodePass}
 * @see {@link verifyPass}
 *
 * security cases:
 * - should successfully omit the patient name from the encoded pass
 * - should successfully omit every reading from the encoded pass
 *
 * success cases:
 * - should successfully round-trip a payload through encode and decode
 * - should successfully produce a code short enough for a QR
 * - should successfully accept an unexpired pass at its own booth
 * - should successfully accept a pass one millisecond before it expires
 *
 * failure cases:
 * - should fail to decode a code that is not a Jano pass
 * - should fail to decode a code with a missing field
 * - should fail to decode a code with an empty field
 * - should fail to decode a code with a non-numeric expiry
 * - should fail to decode a code using an unsupported version
 * - should fail to verify a pass at the exact millisecond it expires
 * - should fail to verify a pass issued for a different booth
 * - should fail to verify a wrong-booth pass before looking it up anywhere
 */
describe('pass', () => {
  describe('encodePass', () => {
    describe('security cases', () => {
      it('should successfully omit the patient name from the encoded pass', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const code = encodePass(payload);

        // Assert
        expect(code).not.toContain(PATIENT_NAME);
        expect(code).toContain(PATIENT_ID);
      });

      it('should successfully omit every reading from the encoded pass', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const code = encodePass(payload);

        // Assert — the code carries exactly seven fields and nothing clinical.
        expect(code.split('.')).toHaveLength(7);
      });
    });

    describe('success cases', () => {
      it('should successfully round-trip a payload through encode and decode', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const result = decodePass(encodePass(payload));

        // Assert
        expect(result).toEqual({ ok: true, value: payload });
      });

      it('should successfully produce a code short enough for a QR', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const code = encodePass(payload);

        // Assert
        expect(code.length).toBeLessThan(MAX_QR_LENGTH);
      });
    });
  });

  describe('decodePass', () => {
    describe('failure cases', () => {
      it('should fail to decode a code that is not a Jano pass', () => {
        // Act
        const result = decodePass('https://example.com/not-a-pass');

        // Assert
        expect(result).toEqual({
          error: { code: JanoErrorCode.PassMalformed },
          ok: false,
        });
      });

      it('should fail to decode a code with a missing field', () => {
        // Arrange
        const truncated = encodePass(makePassPayload())
          .split('.')
          .slice(0, -1)
          .join('.');

        // Act
        const result = decodePass(truncated);

        // Assert
        expect(result).toEqual({
          error: { code: JanoErrorCode.PassMalformed },
          ok: false,
        });
      });

      it('should fail to decode a code with an empty field', () => {
        // Arrange
        const code = [
          PASS_PREFIX,
          '1',
          BOOKING_ID,
          '',
          PATIENT_ID,
          JTI,
          String(SLOT_ENDS_AT),
        ].join('.');

        // Act
        const result = decodePass(code);

        // Assert
        expect(result).toEqual({
          error: { code: JanoErrorCode.PassMalformed },
          ok: false,
        });
      });

      it('should fail to decode a code with a non-numeric expiry', () => {
        // Arrange
        const code = [
          PASS_PREFIX,
          '1',
          BOOKING_ID,
          BOOTH_AYALA_ID,
          PATIENT_ID,
          JTI,
          'tomorrow',
        ].join('.');

        // Act
        const result = decodePass(code);

        // Assert
        expect(result).toEqual({
          error: { code: JanoErrorCode.PassMalformed },
          ok: false,
        });
      });

      it('should fail to decode a code using an unsupported version', () => {
        // Arrange
        const code = [
          PASS_PREFIX,
          '2',
          BOOKING_ID,
          BOOTH_AYALA_ID,
          PATIENT_ID,
          JTI,
          String(SLOT_ENDS_AT),
        ].join('.');

        // Act
        const result = decodePass(code);

        // Assert
        expect(result).toEqual({
          error: { code: JanoErrorCode.PassBadVersion, version: '2' },
          ok: false,
        });
      });
    });
  });

  describe('verifyPass', () => {
    describe('success cases', () => {
      it('should successfully accept an unexpired pass at its own booth', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const result = verifyPass(encodePass(payload), {
          now: DURING_SLOT,
          scanningBoothId: BOOTH_AYALA_ID,
        });

        // Assert
        expect(result).toEqual({ ok: true, value: payload });
      });

      it('should successfully accept a pass one millisecond before it expires', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const result = verifyPass(encodePass(payload), {
          now: SLOT_ENDS_AT - 1,
          scanningBoothId: BOOTH_AYALA_ID,
        });

        // Assert
        expect(result.ok).toBe(true);
      });
    });

    describe('failure cases', () => {
      it('should fail to verify a pass at the exact millisecond it expires', () => {
        // Arrange
        const payload = makePassPayload();

        // Act
        const result = verifyPass(encodePass(payload), {
          now: SLOT_ENDS_AT,
          scanningBoothId: BOOTH_AYALA_ID,
        });

        // Assert
        expect(result).toEqual({
          error: {
            code: JanoErrorCode.PassExpired,
            expiresAt: SLOT_ENDS_AT,
            now: SLOT_ENDS_AT,
          },
          ok: false,
        });
      });

      it('should fail to verify a pass issued for a different booth', () => {
        // Arrange
        const payload = makePassPayload({ boothId: BOOTH_AYALA_ID });

        // Act
        const result = verifyPass(encodePass(payload), {
          now: DURING_SLOT,
          scanningBoothId: BOOTH_POBLACION_ID,
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

      it('should fail to verify a wrong-booth pass before looking it up anywhere', () => {
        // Arrange — a pass id that exists in no store at all.
        const payload = makePassPayload({
          boothId: BOOTH_AYALA_ID,
          jti: 'jti_never_issued',
        });

        // Act
        const result = verifyPass(encodePass(payload), {
          now: DURING_SLOT,
          scanningBoothId: BOOTH_POBLACION_ID,
        });

        // Assert — the booth answers offline, so it is a wrong-booth failure
        // and not "unknown pass".
        expect(!result.ok && result.error.code).toBe(
          JanoErrorCode.PassWrongBooth,
        );
      });

      it('should fail to verify an expired pass before checking the booth', () => {
        // Arrange — expired and for another booth; expiry is checked first.
        const payload = makePassPayload({ boothId: BOOTH_AYALA_ID });

        // Act
        const result = verifyPass(encodePass(payload), {
          now: SLOT_ENDS_AT + MINUTE_MS,
          scanningBoothId: BOOTH_POBLACION_ID,
        });

        // Assert
        expect(!result.ok && result.error.code).toBe(JanoErrorCode.PassExpired);
      });
    });
  });
});
