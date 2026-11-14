/**
 * @fileoverview Test setup: resets the mock backend's module state before
 * every test. Vitest's `restoreMocks` does not reach module-level state, so
 * without this a store written by one test leaks into the next.
 */

import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

import { resetStore } from '@/api/mock/store';

beforeEach(() => {
  resetStore();
});
