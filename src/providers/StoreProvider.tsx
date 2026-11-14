/**
 * @fileoverview Points the store at browser storage and holds the app back
 * until anything saved has been loaded.
 *
 * The store takes an injected `StoragePort`, so this is the only file that
 * knows what platform it is on: on the web that is `localStorage`, wrapped to
 * match the port's promise-based shape.
 */

import { useEffect, useState } from 'react';

import { configureStore, ready } from '@/api/mock/store';

configureStore({
  storage: {
    getItem: async (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Private browsing and blocked storage both throw here. The app still
        // works, it just forgets the visit between reloads.
        return null;
      }
    },
    setItem: async (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Nothing to do: the visit stays in memory for this session.
      }
    },
  },
});

/**
 * Renders its children once the saved state is in memory.
 * @param props - The app tree.
 * @returns {React.JSX.Element | null} - The tree, or nothing while loading.
 */
export const StoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element | null => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    ready().finally(() => {
      if (isCurrent) {
        setIsReady(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return isReady ? <>{children}</> : null;
};
