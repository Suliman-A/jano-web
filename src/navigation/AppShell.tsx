/**
 * @fileoverview The frame every screen renders inside: the phone-width column,
 * the Me menu overlay, and the fixed bottom navigation.
 */

import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { MeMenu } from '@/features/me/MeMenu';
import { JanoTabBar } from '@/navigation/JanoTabBar';
import { useMeMenu } from '@/navigation/MeMenuContext';

/**
 * Renders the shell.
 * @returns {React.JSX.Element} - The app frame.
 */
export const AppShell = (): React.JSX.Element => {
  const { pathname } = useLocation();
  const { close } = useMeMenu();

  // A route change should never leave the menu hanging over the new screen,
  // including when the back button is what changed it.
  useEffect(() => {
    close();
  }, [close, pathname]);

  // Each screen starts at its own top, the way a pushed native screen does.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-frame">
      <Outlet />
      <MeMenu />
      <JanoTabBar />
    </div>
  );
};
