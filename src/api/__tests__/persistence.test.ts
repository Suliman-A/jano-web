/**
 * @fileoverview Tests that the app survives a restart.
 * @see {@link ../mock/store.ts}
 */

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { setMockLatency } from '@/api/mock/latency';
import {
  configureStore,
  getState,
  ready,
  resetStore,
  type StoragePort,
} from '@/api/mock/store';
import type { JanoError } from '@/api/types';
import { JanoErrorCode } from '@/core/errors';
import {
  BOOTH_AYALA_ID,
  createMemoryStorage,
  createTestClock,
  FIXED_NOW,
  MINUTE_MS,
  PATIENT_ID,
} from '@/core/__fixtures__/jano.fixtures';
import type { Slot, Visit } from '@/core/types';

const STORAGE_KEY = 'jano.store.v1';

let clock: ReturnType<typeof createTestClock>;
let storage: StoragePort & { entries: Record<string, string> };

/**
 * Starts the backend from empty, keeping the storage the caller gives it.
 * @param existing - Storage to reuse, simulating a relaunch.
 */
const setUpBackend = (
  existing?: StoragePort & { entries: Record<string, string> },
): void => {
  resetStore();
  clock = createTestClock(FIXED_NOW);
  storage = existing ?? createMemoryStorage();
  configureStore({ clock: clock.now, storage });
  setMockLatency(0);
};

/**
 * Books a slot and checks the patient in, so there is state worth keeping.
 * @returns {Promise<{ code: string; visit: Visit }>} - The pass and visit.
 */
const givenACheckedInVisit = async (): Promise<{
  code: string;
  visit: Visit;
}> => {
  const slots = (await request(Endpoint.Slots, {
    boothId: BOOTH_AYALA_ID,
  })) as Slot[];
  const slot = slots.find((candidate) => candidate.isAvailable)!;

  const { visit } = await request(Endpoint.Book, {
    patientId: PATIENT_ID,
    slotId: slot.id,
  });
  const { code } = await request(Endpoint.Pass, { visitId: visit.id });

  clock.set(slot.startsAt + MINUTE_MS);
  await request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code });

  return { code, visit };
};

/**
 * Drains the store's write queue so the save has landed.
 * @returns {Promise<void>} - Resolves once writes have flushed.
 */
const flushWrites = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

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
 * @see {@link ready}
 *
 * security cases:
 * - should fail a pass that was used before the app was restarted
 *
 * success cases:
 * - should successfully restore a booked visit after a restart
 *
 * failure cases:
 * - should fail quietly and reseed when the saved state is corrupt
 * - should fail quietly and reseed when the saved state is from an old version
 * - should successfully load only once when asked concurrently
 */
describe('persistence', () => {
  beforeEach(() => {
    setUpBackend();
  });

  describe('security cases', () => {
    it('should fail a pass that was used before the app was restarted', async () => {
      // Arrange
      const { code } = await givenACheckedInVisit();
      const slotStart = clock.now();

      await flushWrites();

      setUpBackend(storage);
      clock.set(slotStart);

      // Act
      const error = await captureFailure(() =>
        request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code }),
      );

      // Assert
      expect(error.failure.code).toBe(JanoErrorCode.PassUsed);
    });
  });

  describe('success cases', () => {
    it('should successfully restore a booked visit after a restart', async () => {
      // Arrange
      const { visit } = await givenACheckedInVisit();

      await flushWrites();
      setUpBackend(storage);

      // Act
      const visits = (await request(Endpoint.Visits, {
        patientId: PATIENT_ID,
      })) as Visit[];

      // Assert
      expect(visits).toHaveLength(1);
      expect(visits[0].id).toBe(visit.id);
      expect(visits[0].status).toBe('checked_in');
    });

    it('should successfully load only once when asked concurrently', async () => {
      // Arrange
      const getItem = vi.spyOn(storage, 'getItem');

      // Act
      await Promise.all([ready(), ready(), ready()]);

      // Assert
      expect(getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure cases', () => {
    it('should fail quietly and reseed when the saved state is corrupt', async () => {
      // Arrange
      storage.entries[STORAGE_KEY] = '{ not json at all';
      setUpBackend(storage);

      // Act
      await ready();

      // Assert
      expect(getState().visits).toEqual({});
    });

    it('should fail quietly and reseed when the saved state is from an old version', async () => {
      // Arrange
      storage.entries[STORAGE_KEY] = JSON.stringify({
        bookings: {},
        passes: {},
        takenSlotIds: ['slt_old'],
        version: 0,
        visits: {},
      });
      setUpBackend(storage);

      // Act
      await ready();

      // Assert
      expect(getState().takenSlotIds).toEqual([]);
    });
  });
});
