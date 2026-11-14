/**
 * @fileoverview Holds whether the Me menu is open.
 *
 * The tab bar opens it and the menu closes it, and they are siblings rather
 * than parent and child, so the state sits above both.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type MeMenuValue = {
  close: () => void;
  isOpen: boolean;
  toggle: () => void;
};

const MeMenuContext = createContext<MeMenuValue | null>(null);

/**
 * Provides the Me menu's open state.
 * @param props - The app tree.
 * @returns {React.JSX.Element} - The provider.
 */
export const MeMenuProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback((): void => setIsOpen(false), []);
  const toggle = useCallback((): void => setIsOpen((open) => !open), []);

  const value = useMemo(
    () => ({ close, isOpen, toggle }),
    [close, isOpen, toggle],
  );

  return (
    <MeMenuContext.Provider value={value}>{children}</MeMenuContext.Provider>
  );
};

/**
 * Reads the Me menu's open state.
 * @returns {MeMenuValue} - Whether it is open, and how to change that.
 */
export const useMeMenu = (): MeMenuValue => {
  const value = useContext(MeMenuContext);

  if (!value) {
    throw new Error('useMeMenu must be used inside a MeMenuProvider');
  }

  return value;
};
