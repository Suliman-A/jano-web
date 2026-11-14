/**
 * @fileoverview Tests for booking a slot and issuing its pass.
 * @see {@link ../mock/backend.ts}
 */

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { setMockLatency } from '@/api/mock/latency';
import { configureStore, resetStore, type StoragePort } from '@/api/mock/store';
import type { JanoError } from '@/api/types';
import { JanoErrorCode } from '@/core/errors';
import {
  BOOTH_AYALA_ID,
  createMemoryStorage,
  createTestClock,
  FIXED_NOW,
  PATIENT_ID,
} from '@/core/__fixtures__/jano.fixtures';
import type { Slot } from '@/core/types';

const BOOTH_IN_MAINTENANCE_ID = 'bth_ortigas';

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
 * Finds the first slot a booth is actually offering.
 * @param boothId - The booth to ask.
 * @returns {Promise<Slot>} - The first available slot.
 */
const firstAvailableSlot = async (boothId: string): Promise<Slot> => {
  const slots = (await request(Endpoint.Slots, { boothId })) as Slot[];

  return slots.find((slot) => slot.isAvailable)!;
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
 * success cases:
 * - should successfully create a booking, a scheduled visit and a pass together
 * - should successfully issue a pass that expires when the slot ends
 * - should successfully take the slot out of circulation once booked
 * - should successfully offer only future slots
 *
 * failure cases:
 * - should fail when the slot has already been booked
 * - should fail when the slot does not exist
 * - should fail to offer any slot at a booth in maintenance
 */
describe('booking', () => {
  beforeEach(() => {
    setUpBackend();
  });

  describe('success cases', () => {
    it('should successfully create a booking, a scheduled visit and a pass together', async () => {
      // Arrange
      const slot = await firstAvailableSlot(BOOTH_AYALA_ID);

      // Act
      const result = await request(Endpoint.Book, {
        patientId: PATIENT_ID,
        slotId: slot.id,
      });

      // Assert
      expect(result.visit.status).toBe('scheduled');
      expect(result.visit.bookingId).toBe(result.booking.id);
      expect(result.pass.bookingId).toBe(result.booking.id);
      expect(result.pass.usedAt).toBeNull();
    });

    it('should successfully issue a pass that expires when the slot ends', async () => {
      // Arrange
      const slot = await firstAvailableSlot(BOOTH_AYALA_ID);

      // Act
      const result = await request(Endpoint.Book, {
        patientId: PATIENT_ID,
        slotId: slot.id,
      });

      // Assert
      expect(result.pass.expiresAt).toBe(slot.endsAt);
    });

    it('should successfully take the slot out of circulation once booked', async () => {
      // Arrange
      const slot = await firstAvailableSlot(BOOTH_AYALA_ID);

      // Act
      await request(Endpoint.Book, {
        patientId: PATIENT_ID,
        slotId: slot.id,
      });

      // Assert
      const slots = (await request(Endpoint.Slots, {
        boothId: BOOTH_AYALA_ID,
      })) as Slot[];

      expect(
        slots.find((candidate) => candidate.id === slot.id)!.isAvailable,
      ).toBe(false);
    });

    it('should successfully offer only future slots', async () => {
      // Act
      const slots = (await request(Endpoint.Slots, {
        boothId: BOOTH_AYALA_ID,
      })) as Slot[];

      // Assert
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((slot) => slot.startsAt > FIXED_NOW)).toBe(true);
    });
  });

  describe('failure cases', () => {
    it('should fail when the slot has already been booked', async () => {
      // Arrange
      const slot = await firstAvailableSlot(BOOTH_AYALA_ID);

      await request(Endpoint.Book, {
        patientId: PATIENT_ID,
        slotId: slot.id,
      });

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.Book, { patientId: PATIENT_ID, slotId: slot.id }),
      );

      // Assert
      expect(error.failure).toEqual({
        code: JanoErrorCode.SlotTaken,
        slotId: slot.id,
      });
    });

    it('should fail when the slot does not exist', async () => {
      // Act
      const error = await captureFailure(() =>
        request(Endpoint.Book, {
          patientId: PATIENT_ID,
          slotId: 'slt_nonexistent',
        }),
      );

      // Assert
      expect(error.failure).toEqual({
        code: JanoErrorCode.SlotUnknown,
        slotId: 'slt_nonexistent',
      });
    });

    it('should fail to offer any slot at a booth in maintenance', async () => {
      // Act
      const slots = (await request(Endpoint.Slots, {
        boothId: BOOTH_IN_MAINTENANCE_ID,
      })) as Slot[];

      // Assert
      expect(slots.every((slot) => !slot.isAvailable)).toBe(true);
    });
  });
});
