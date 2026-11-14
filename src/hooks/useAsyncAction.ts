/**
 * @fileoverview Runs a call against the mock backend and exposes the loading
 * and error state a button needs.
 */

import { useCallback, useRef, useState } from 'react';

import { JanoError } from '@/api/types';
import type { JanoFailure } from '@/core/errors';

type AsyncActionState<T> = {
  error: Error | null;
  /** Present when the backend refused for a known reason. */
  failure: JanoFailure | null;
  isLoading: boolean;
  reset: () => void;
  result: T | null;
  run: (...args: never[]) => Promise<T | null>;
};

/**
 * Wraps an async call with loading and error state.
 * @param action - The call to run.
 * @returns {AsyncActionState<T>} - The call plus what the UI needs to show.
 */
export const useAsyncAction = <T, A extends unknown[]>(
  action: (...args: A) => Promise<T>,
): Omit<AsyncActionState<T>, 'run'> & {
  run: (...args: A) => Promise<T | null>;
} => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const actionRef = useRef(action);

  actionRef.current = action;

  const run = useCallback(async (...args: A): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const value = await actionRef.current(...args);

      setResult(value);

      return value;
    } catch (caught) {
      setError(caught as Error);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback((): void => {
    setError(null);
    setResult(null);
  }, []);

  return {
    error,
    failure: error instanceof JanoError ? error.failure : null,
    isLoading,
    reset,
    result,
    run,
  };
};
