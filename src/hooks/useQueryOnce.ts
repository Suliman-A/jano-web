/**
 * @fileoverview Loads something from the mock backend when a screen mounts,
 * and again whenever the store changes.
 *
 * The subscription is what removes the manual refresh: the booth simulator
 * commits a change, the store notifies, and every mounted screen reloads.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribe } from '@/api/mock/store';

type QueryState<T> = {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Fetches on mount, on demand, and on every committed store change.
 * @param fetcher - The call to run.
 * @param deps - Values that should trigger a refetch when they change.
 * @returns {QueryState<T>} - The data and its loading and error state.
 */
export const useQueryOnce = <T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  fetcherRef.current = fetcher;

  const refetch = useCallback((): void => {
    setTick((current) => current + 1);
  }, []);

  // Collapsed to one string rather than spread into the dependency array:
  // React requires that array to keep the same length on every render, and
  // spreading a caller's list cannot guarantee it.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);

    fetcherRef
      .current()
      .then((value) => {
        if (isCurrent) {
          setData(value);
          setError(null);
        }
      })
      .catch((caught: Error) => {
        if (isCurrent) {
          setError(caught);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, depsKey]);

  // The listener only ever bumps a counter, so it captures nothing that can
  // go stale.
  useEffect(() => subscribe(refetch), [refetch]);

  return { data, error, isLoading, refetch };
};
