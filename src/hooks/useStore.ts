/**
 * @fileoverview Subscribes a screen to the mock backend's store.
 *
 * This is what makes the patient side update the moment the booth simulator
 * finishes a visit: the store replaces its state object and notifies, React
 * re-renders, and no screen knows the other exists.
 */

import { useSyncExternalStore } from 'react';

import { getState, type StoreState, subscribe } from '@/api/mock/store';

/**
 * Reads a slice of the store and re-renders when it changes.
 *
 * The selector must return something already stored rather than a freshly
 * built array or object, or React sees a new value every render and loops.
 *
 * @param select - Picks the slice this screen cares about.
 * @returns {T} - The selected slice.
 */
export const useStore = <T>(select: (state: StoreState) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => select(getState()),
    () => select(getState()),
  );
