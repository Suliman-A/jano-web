/**
 * @fileoverview The column every screen is laid out in: the app's horizontal
 * padding, a consistent vertical rhythm, and enough room at the bottom that
 * the fixed tab bar never covers the last element.
 */

import styles from '@/components/atoms/Screen.module.css';

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

/**
 * Wraps a screen's contents.
 * @param props - The screen body.
 * @returns {React.JSX.Element} - The scrolling column.
 */
export const Screen = ({
  children,
  className = '',
  'data-testid': testId,
}: ScreenProps): React.JSX.Element => (
  <main className={`${styles.screen} ${className}`} data-testid={testId}>
    {children}
  </main>
);
