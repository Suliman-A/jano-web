/**
 * @fileoverview Tests for accepting and refusing a pass at a booth.
 * @see {@link ../mock/backend.ts}
 */

import {
  BOOTH_AYALA_ID,
  BOOTH_POBLACION_ID,
  createMemoryStorage,
  createTestClock,
  FIXED_NOW,
  makePass,
  makePassPayload,
  makeVisit,
  MINUTE_MS,
  VISIT_ID,
} from '@/core/__fixtures__/jano.fixtures';
import { Endpoint } from '@/api/endpoints';
import { setMockLatency } from '@/api/mock/latency';
import {
  configureStore,
  getState,
  resetStore,
  type StoragePort,
  transact,
} from '@/api/mock/store';
import { JanoError } from '@/api/types';
import { JanoErrorCode } from '@/core/errors';
import { encodePass } from '@/core/pass';
import { ok } from '@/core/result';
import type { Slot, Visit } from '@/core/types';
import { request } from '@/api/client';

const BOOTH_IN_MAINTENANCE_ID = 'bth_ortigas';
const PATIENT_ID = 'pt_demo_001';

let clock: ReturnType<typeof createTestClock>;
let storage: StoragePort;

/**
 * Starts the backend from empty with a clock the test controls.
 */
const setUpBackend = (): void => {
  resetStore();
  clock = createTestClock(FIXED_NOW);
  storage = createMemoryStorage();
  configureStore({ clock: clock.now, storage });
  setMockLatency(0);
};

/**
 * Books the first available slot at a booth and moves the clock into it.
 * @param boothId - Which booth to book.
 * @returns {Promise<{ code: string; visit: Visit }>} - The pass code and visit.
 */
const bookAndArrive = async (
  boothId: string = BOOTH_AYALA_ID,
): Promise<{ code: string; visit: Visit }> => {
  const slots = (await request(Endpoint.Slots, { boothId })) as Slot[];
  const slot = slots.find((candidate) => candidate.isAvailable)!;

  const { visit } = await request(Endpoint.Book, {
    patientId: PATIENT_ID,
    slotId: slot.id,
  });

  const { code } = await request(Endpoint.Pass, { visitId: visit.id });

  clock.set(slot.startsAt + MINUTE_MS);

  return { code, visit };
};

/**
 * Writes a booking, visit and unused pass straight into the store, through its
 * normal commit path, for a booth that cannot be booked through the app.
 * @param boothId - The booth the pass is issued for.
 * @returns {string} - The scannable code for that pass.
 */
const givenIssuedPassAt = (boothId: string): string => {
  const startsAt = clock.now() + 10 * MINUTE_MS;
  const payload = makePassPayload({
    boothId,
    expiresAt: startsAt + 30 * MINUTE_MS,
  });

  transact((state) =>
    ok({
      next: {
        ...state,
        bookings: {
          ...state.bookings,
          [payload.bookingId]: {
            boothId,
            createdAt: clock.now(),
            id: payload.bookingId,
            patientId: payload.patientId,
            slotId: 'slt_seeded',
            visitId: VISIT_ID,
          },
        },
        passes: {
          ...state.passes,
          [payload.jti]: makePass({
            bookingId: payload.bookingId,
            boothId,
            expiresAt: payload.expiresAt,
          }),
        },
        visits: {
          ...state.visits,
          [VISIT_ID]: makeVisit({
            bookingId: payload.bookingId,
            boothId,
            scheduledFor: startsAt,
            scheduledUntil: startsAt + 30 * MINUTE_MS,
            slotId: 'slt_seeded',
          }),
        },
      },
      value: null,
    }),
  );

  return encodePass(payload);
};

/**
 * Runs a call and returns the JanoError it threw.
 * @param call - The call expected to fail.
 * @returns {Promise<JanoError>} - The thrown error.
 */
const captureFailure = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (error) {
    return error as JanoError;
  }

  throw new Error('Expected the call to be refused, but it succeeded.');
};

/**
 * @see {@link request}
 *
 * security cases:
 * - should fail when the code names a different patient than the booking
 * - should not mark the pass used when check-in is refused
 * - should not check the visit in when check-in is refused
 *
 * success cases:
 * - should successfully check the patient in with a valid pass
 * - should successfully mark the pass used and record which booth used it
 *
 * failure cases:
 * - should fail when the pass has already been used
 * - should fail as already-used rather than illegal-transition on a re-scan
 * - should fail when the pass was issued for a different booth
 * - should fail as wrong-booth for a code that is in no store at all
 * - should fail when the booth went into maintenance after the booking
 * - should fail when the code is not a Jano pass
 */
describe('checkIn', () => {
  beforeEach(() => {
    setUpBackend();
  });

  describe('security cases', () => {
    it('should fail when the code names a different patient than the booking', async () => {
      // Arrange — a genuine pass whose patient field has been swapped.
      const { code } = await bookAndArrive();
      const [, , bookingId, boothId, , jti, expiresAt] = code.split('.');
      const tampered = encodePass(
        makePassPayload({
          bookingId,
          boothId,
          expiresAt: Number(expiresAt),
          jti,
          patientId: 'pt_someone_else',
        }),
      );

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code: tampered }),
      );

      // Assert
      expect(error.failure.code).toBe(JanoErrorCode.PassWrongPatient);
    });

    it('should not mark the pass used when check-in is refused', async () => {
      // Arrange
      const { code } = await bookAndArrive();

      // Act
      await captureFailure(() =>
        request(Endpoint.CheckIn, {
          boothId: BOOTH_POBLACION_ID,
          code,
        }),
      );

      // Assert
      const [pass] = Object.values(getState().passes);

      expect(pass.usedAt).toBeNull();
      expect(pass.usedByBoothId).toBeNull();
    });

    it('should not check the visit in when check-in is refused', async () => {
      // Arrange
      const { code, visit } = await bookAndArrive();

      // Act
      await captureFailure(() =>
        request(Endpoint.CheckIn, {
          boothId: BOOTH_POBLACION_ID,
          code,
        }),
      );

      // Assert
      expect(getState().visits[visit.id].status).toBe('scheduled');
      expect(getState().visits[visit.id].checkedInAt).toBeNull();
    });
  });

  describe('success cases', () => {
    it('should successfully check the patient in with a valid pass', async () => {
      // Arrange
      const { code, visit } = await bookAndArrive();

      // Act
      const result = await request(Endpoint.CheckIn, {
        boothId: BOOTH_AYALA_ID,
        code,
      });

      // Assert
      expect(result.visit.id).toBe(visit.id);
      expect(result.visit.status).toBe('checked_in');
      expect(getState().visits[visit.id].status).toBe('checked_in');
    });

    it('should successfully mark the pass used and record which booth used it', async () => {
      // Arrange
      const { code } = await bookAndArrive();

      // Act
      await request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code });

      // Assert
      const [pass] = Object.values(getState().passes);

      expect(pass.usedAt).not.toBeNull();
      expect(pass.usedByBoothId).toBe(BOOTH_AYALA_ID);
    });
  });

  describe('failure cases', () => {
    it('should fail when the pass has already been used', async () => {
      // Arrange
      const { code } = await bookAndArrive();

      await request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code });

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code }),
      );

      // Assert
      expect(error.failure.code).toBe(JanoErrorCode.PassUsed);
    });

    it('should fail as already-used rather than illegal-transition on a re-scan', async () => {
      // Arrange — after check-in the visit is also in a status that refuses
      // CHECK_IN, so both rules could fire. The pass check must win.
      const { code } = await bookAndArrive();

      await request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code });

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code }),
      );

      // Assert
      expect(error.failure.code).not.toBe(JanoErrorCode.IllegalTransition);
      expect(error.failure.code).toBe(JanoErrorCode.PassUsed);
    });

    it('should fail when the pass was issued for a different booth', async () => {
      // Arrange
      const { code } = await bookAndArrive(BOOTH_AYALA_ID);

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_POBLACION_ID, code }),
      );

      // Assert
      expect(error.failure).toEqual({
        code: JanoErrorCode.PassWrongBooth,
        passBoothId: BOOTH_AYALA_ID,
        scanningBoothId: BOOTH_POBLACION_ID,
      });
    });

    it('should fail as wrong-booth for a code that is in no store at all', async () => {
      // Arrange — never issued, so a store lookup would say "unknown pass".
      const code = encodePass(
        makePassPayload({
          boothId: BOOTH_AYALA_ID,
          expiresAt: FIXED_NOW + 60 * MINUTE_MS,
          jti: 'jti_never_issued',
        }),
      );

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_POBLACION_ID, code }),
      );

      // Assert — the booth answers from the code alone, before any lookup.
      expect(error.failure.code).toBe(JanoErrorCode.PassWrongBooth);
    });

    it('should fail when the booth went into maintenance after the booking', async () => {
      // Arrange — a booth cannot be booked while in maintenance, so the only
      // way to reach this rule is a pass issued before the booth closed.
      const code = givenIssuedPassAt(BOOTH_IN_MAINTENANCE_ID);

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, {
          boothId: BOOTH_IN_MAINTENANCE_ID,
          code,
        }),
      );

      // Assert
      expect(error.failure.code).toBe(JanoErrorCode.BoothUnavailable);
    });

    it('should fail when the code is not a Jano pass', async () => {
      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, {
          boothId: BOOTH_AYALA_ID,
          code: 'https://example.com/qr',
        }),
      );

      // Assert
      expect(error.failure.code).toBe(JanoErrorCode.PassMalformed);
    });
  });
});
