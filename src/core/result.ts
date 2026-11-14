/**
 * @fileoverview A tiny Result type. The rules layer returns failures instead of
 * throwing, so callers have to deal with them and tests can assert on a code.
 */

import type { JanoFailure } from '@/core/errors';

export type Result<T> =
  { ok: true; value: T } | { error: JanoFailure; ok: false };

/**
 * Wraps a successful value.
 * @param value - The value to wrap.
 * @returns {Result<T>} - A successful result.
 */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/**
 * Wraps a failure.
 * @param error - What went wrong, and why.
 * @returns {Result<T>} - A failed result.
 */
export const err = <T>(error: JanoFailure): Result<T> => ({
  error,
  ok: false,
});
