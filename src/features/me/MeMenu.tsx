/**
 * @fileoverview The Me menu.
 *
 * Tapping Me does not open a screen. The current screen fades out behind a
 * white scrim and five rows rise into place from the bottom, one after
 * another, over the tab bar's Me button.
 *
 * Only Consultation History goes anywhere. The other four are listed because
 * the reference screens list them, and they say so by being disabled rather
 * than by looking live and doing nothing.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/iconRegistry';
import styles from '@/features/me/MeMenu.module.css';
import { useMeMenu } from '@/navigation/MeMenuContext';
import { routes } from '@/navigation/routes';

type MenuItem = {
  icon: IconName;
  isAvailable: boolean;
  label: string;
};

const ITEMS: MenuItem[] = [
  { icon: 'prescriptions', isAvailable: false, label: 'Prescriptions' },
  { icon: 'history', isAvailable: true, label: 'Consultation History' },
  {
    icon: 'profile',
    isAvailable: false,
    label: 'Patient Profile & Health History',
  },
  {
    icon: 'scan',
    isAvailable: false,
    label: 'Digitize My Prescription & Results',
  },
  { icon: 'settings', isAvailable: false, label: 'Settings' },
];

/**
 * The menu that expands upward over a faded view of the current screen.
 * @returns {React.JSX.Element | null} - The menu, or nothing when closed.
 */
export const MeMenu = (): React.JSX.Element | null => {
  const { close, isOpen } = useMeMenu();
  const navigate = useNavigate();

  // Escape closes it, the way a dismissable overlay is expected to behave.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    /**
     * Closes the menu on Escape.
     * @param event - The keyboard event.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, isOpen]);

  if (!isOpen) {
    return null;
  }

  /**
   * Opens Consultation History, which is the one item that works.
   */
  const openHistory = (): void => {
    close();
    navigate(routes.consultationHistory);
  };

  return (
    <div className={styles.root} data-testid="me-menu">
      <button
        aria-label="Close menu"
        className={styles.scrim}
        onClick={close}
        type="button"
      />

      <ul className={styles.items}>
        {ITEMS.map((item, index) => (
          <li
            className={styles.item}
            key={item.label}
            style={{ '--index': index } as React.CSSProperties}
          >
            <button
              className={styles.row}
              data-testid={`me-menu-${item.label}`}
              disabled={!item.isAvailable}
              onClick={item.isAvailable ? openHistory : undefined}
              type="button"
            >
              <span className={styles.disc}>
                <Icon name={item.icon} size={22} />
              </span>
              <span className={`t-section-title ${styles.label}`}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
