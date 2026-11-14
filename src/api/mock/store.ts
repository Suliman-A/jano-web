/**
 * @fileoverview The mock backend's database.
 *
 * One state object, replaced rather than mutated so `useSyncExternalStore` can
 * compare by identity. Screens subscribe to it directly, which is why a visit
 * finished at the booth shows up on the Farm with no refresh.
 */

import type { Result } from '@/core/result';
import type { Booking, Pass, Visit } from '@/core/types';

const STORAGE_KEY = 'jano.store.v1';
const STORAGE_VERSION = 1;

export type StoragePort = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type StoreState = {
  bookings: Record<string, Booking>;
  passes: Record<string, Pass>;
  /** Slots claimed by a booking, on top of the ones the seed marks taken. */
  takenSlotIds: string[];
  visits: Record<string, Visit>;
};

type PersistedState = StoreState & { version: number };

const emptyState = (): StoreState => ({
  bookings: {},
  passes: {},
  takenSlotIds: [],
  visits: {},
});

let state: StoreState = emptyState();
let storage: StoragePort | null = null;
let clock: () => number = () => Date.now();
let hydration: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const listeners = new Set<() => void>();

/**
 * Points the store at a storage backend and a clock.
 *
 * Tests pass an in-memory port so the persistence tests exercise the real
 * serialise and parse round-trip, and a fixed clock so nothing reads real time.
 *
 * @param options - The storage port and clock to use.
 */
export const configureStore = (options: {
  clock?: () => number;
  storage?: StoragePort | null;
}): void => {
  if (options.storage !== undefined) {
    storage = options.storage;
  }

  if (options.clock) {
    clock = options.clock;
  }
};

/**
 * The current time, according to the injected clock.
 * @returns {number} - Epoch milliseconds.
 */
export const now = (): number => clock();

/**
 * Reads the current state.
 * @returns {StoreState} - The state object, which is never mutated in place.
 */
export const getState = (): StoreState => state;

/**
 * Subscribes to every change.
 * @param listener - Called after each committed change.
 * @returns {() => void} - Unsubscribes.
 */
export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Serialises writes, because two overlapping saves to one key can land out of
 * order and lose the newer state.
 */
const persist = (): void => {
  if (!storage) {
    return;
  }

  const snapshot: PersistedState = { ...state, version: STORAGE_VERSION };
  const body = JSON.stringify(snapshot);

  writeQueue = writeQueue.then(() =>
    storage ? storage.setItem(STORAGE_KEY, body) : Promise.resolve(),
  );
};

/**
 * Loads saved state. A blob from an older version, or corrupt JSON, is dropped
 * rather than crashing the app.
 * @returns {Promise<void>} - Resolves once the state is in memory.
 */
const hydrate = async (): Promise<void> => {
  if (!storage) {
    return;
  }

  const body = await storage.getItem(STORAGE_KEY);

  if (!body) {
    return;
  }

  try {
    const parsed = JSON.parse(body) as PersistedState;

    if (parsed.version !== STORAGE_VERSION) {
      return;
    }

    state = {
      bookings: parsed.bookings ?? {},
      passes: parsed.passes ?? {},
      takenSlotIds: parsed.takenSlotIds ?? [],
      visits: parsed.visits ?? {},
    };
  } catch {
    // A corrupt blob is not worth a crash; start from the seed instead.
  }
};

/**
 * Loads saved state exactly once, however many callers ask.
 *
 * Without the memo, StrictMode's double mount and Fast Refresh each start their
 * own load, and the one that finishes last overwrites anything booked between
 * them.
 *
 * @returns {Promise<void>} - Resolves once the store is ready.
 */
export const ready = (): Promise<void> => {
  hydration ??= hydrate();

  return hydration;
};

/**
 * Applies a change in one step: either the whole change lands and is saved and
 * announced, or nothing happens at all.
 * @param mutate - Produces the next state and a return value, or a failure.
 * @returns {Result<T>} - What the mutation returned, or why it was refused.
 */
export const transact = <T>(
  mutate: (current: StoreState) => Result<{ next: StoreState; value: T }>,
): Result<T> => {
  const result = mutate(state);

  if (!result.ok) {
    return result;
  }

  state = result.value.next;
  persist();
  listeners.forEach((listener) => listener());

  return { ok: true, value: result.value.value };
};

/**
 * Clears everything, including the memoised load. Tests call this between
 * cases, because Jest's `clearMocks` does not reset module state.
 */
export const resetStore = (): void => {
  state = emptyState();
  hydration = null;
  writeQueue = Promise.resolve();
  listeners.clear();
};
