/**
 * @fileoverview Makes the mock backend behave like a network: every call takes
 * a moment, and any call can be made to fail on demand so the error states are
 * reachable without breaking anything.
 */

import { JanoError } from '@/api/types';
import type { Endpoint } from '@/api/endpoints';
import { JanoErrorCode } from '@/core/errors';

const DEFAULT_LATENCY_MS = 300;

let latencyMs = DEFAULT_LATENCY_MS;
let failingEndpoint: Endpoint | null = null;

/**
 * Sets how long every mock call takes. Tests set this to zero.
 * @param ms - The delay in milliseconds.
 */
export const setMockLatency = (ms: number): void => {
  latencyMs = ms;
};

/**
 * Forces one endpoint to fail, to exercise the error state.
 * @param endpoint - The endpoint to break, or null to clear.
 */
export const setMockFailure = (endpoint: Endpoint | null): void => {
  failingEndpoint = endpoint;
};

/**
 * Waits for the configured latency.
 * @returns {Promise<void>} - Resolves once the delay has passed.
 */
export const delay = (): Promise<void> =>
  latencyMs === 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, latencyMs));

/**
 * Throws when the given endpoint has been switched to failing.
 * @param endpoint - The endpoint being called.
 */
export const throwIfForced = (endpoint: Endpoint): void => {
  if (endpoint === failingEndpoint) {
    throw new JanoError({ code: JanoErrorCode.VisitUnknown, visitId: '-' });
  }
};
