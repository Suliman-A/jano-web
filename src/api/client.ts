/**
 * @fileoverview The one function every screen calls.
 *
 * Today it routes to the mock backend. Replacing the prototype's data with a
 * real server means changing this file and nothing else: the screens, the
 * rules and the tests all sit on either side of it.
 */

import type { Endpoint } from '@/api/endpoints';
import { mockRequest, type MockHandlers } from '@/api/mock/backend';

const USE_MOCKS = true;

/**
 * Stands in for the real transport, so the swap point is obvious.
 * @returns {Promise<never>} - Always rejects.
 */
const httpRequest = (): Promise<never> =>
  Promise.reject(
    new Error('No backend is wired up yet; the app runs on mock data.'),
  );

/**
 * Calls the backend.
 * @param endpoint - Which endpoint to call.
 * @param body - The request body for that endpoint.
 * @returns {Promise<ReturnType<MockHandlers[E]>>} - The response.
 */
export const request = async <E extends keyof MockHandlers>(
  endpoint: E,
  body: Parameters<MockHandlers[E]>[0],
): Promise<ReturnType<MockHandlers[E]>> =>
  USE_MOCKS ? mockRequest(endpoint, body) : httpRequest();

export type { Endpoint };
