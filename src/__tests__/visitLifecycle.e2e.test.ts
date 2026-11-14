/**
 * @fileoverview End-to-end: one visit, from booking to the Farm.
 *
 * This is the only test that proves the patient side updates without being
 * refreshed. Every other test still passes if the store stops notifying its
 * subscribers, because they all read the store directly.
 *
 * @see {@link ../api/mock/backend.ts}
 */

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { setMockLatency } from '@/api/mock/latency';
import {
  configureStore,
  resetStore,
  type StoragePort,
  subscribe,
} from '@/api/mock/store';
import type { MetricSeries } from '@/core/readings';
import type { Slot, Visit } from '@/core/types';
import {
  BOOTH_AYALA_ID,
  createMemoryStorage,
  createTestClock,
  FIXED_NOW,
  MINUTE_MS,
  PATIENT_ID,
} from '@/core/__fixtures__/jano.fixtures';

const PULSE_AT_THE_BOOTH = 77;

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
 * Stands in for a mounted patient screen: it reloads whenever the store says
 * something changed, exactly as `useQueryOnce` does, and never otherwise.
 * @param load - How the screen fetches its data.
 * @returns {{ latest: () => T | null; stop: () => void }} - The screen's view.
 */
const mountScreen = <T>(
  load: () => Promise<T>,
): { latest: () => T | null; stop: () => void } => {
  let latest: T | null = null;

  const refresh = (): void => {
    void load().then((value) => {
      latest = value;
    });
  };

  refresh();

  const unsubscribe = subscribe(refresh);

  return { latest: () => latest, stop: unsubscribe };
};

/**
 * Lets every pending store-driven reload settle.
 * @returns {Promise<void>} - Resolves on the next tick.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

/**
 * @see {@link request}
 *
 * success cases:
 * - should successfully carry a visit from booking to the patient's history
 *   and Farm without a manual refresh
 */
describe('visit lifecycle', () => {
  beforeEach(() => {
    setUpBackend();
  });

  describe('success cases', () => {
    it('should successfully carry a visit from booking to history and the Farm without a manual refresh', async () => {
      // Arrange — two patient screens are open and never touched again.
      const historyScreen = mountScreen<Visit[]>(() =>
        request(Endpoint.Visits, { patientId: PATIENT_ID }),
      );
      const farmScreen = mountScreen<MetricSeries[]>(() =>
        request(Endpoint.Farm, { patientId: PATIENT_ID }),
      );

      await settle();

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

      // Act — everything from here happens at the booth, not in the app.
      await request(Endpoint.CheckIn, { boothId: BOOTH_AYALA_ID, code });
      await request(Endpoint.RecordReading, {
        metricKey: 'pulse',
        value: PULSE_AT_THE_BOOTH,
        visitId: visit.id,
      });
      await request(Endpoint.CheckOut, { visitId: visit.id });

      await settle();

      // Assert — the patient screens show it, and nothing refetched them.
      const history = historyScreen.latest();
      const farm = farmScreen.latest();
      const pulse = farm?.find((series) => series.metric.key === 'pulse');

      expect(history?.find((item) => item.id === visit.id)?.status).toBe(
        'completed',
      );
      expect(pulse?.latest?.value).toBe(PULSE_AT_THE_BOOTH);

      historyScreen.stop();
      farmScreen.stop();
    });
  });
});
