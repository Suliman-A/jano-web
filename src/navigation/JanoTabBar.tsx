/**
 * @fileoverview The custom bottom navigation, matching the reference screens.
 *
 * Four circular tabs, not a row of equal ones: Me at the left and Jano at the
 * right sit a little higher than Farm and Temple, which are paired in the
 * middle. The active tab is filled; every circle is the same size whatever its
 * state, so tapping a tab never resizes anything and the row never shifts.
 *
 * Tapping Me does not navigate — it opens the Me menu over the current screen.
 */

import { useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/iconRegistry';
import styles from '@/navigation/JanoTabBar.module.css';
import { useMeMenu } from '@/navigation/MeMenuContext';
import { routes } from '@/navigation/routes';

type TabButtonProps = {
  icon: IconName;
  isActive: boolean;
  /** Me and Jano sit a little above the two middle tabs. */
  isLifted?: boolean;
  label: string;
  onClick: () => void;
};

/**
 * One circular tab button.
 * @param props - Its label, icon and state.
 * @returns {React.JSX.Element} - The button.
 */
const TabButton = ({
  icon,
  isActive,
  isLifted = false,
  label,
  onClick,
}: TabButtonProps): React.JSX.Element => (
  <button
    aria-current={isActive ? 'page' : undefined}
    className={[
      styles.button,
      isActive ? styles.active : '',
      isLifted ? styles.lifted : '',
    ]
      .filter(Boolean)
      .join(' ')}
    data-testid={`tab-${label}`}
    onClick={onClick}
    type="button"
  >
    <Icon name={icon} size={22} />
    <span className={`t-tab-label ${styles.label}`}>{label}</span>
  </button>
);

/**
 * Draws the whole bar.
 * @returns {React.JSX.Element} - The tab bar.
 */
export const JanoTabBar = (): React.JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meMenu = useMeMenu();

  /**
   * Goes to a tab, closing the Me menu on the way.
   * @param path - Where to go.
   */
  const go = (path: string): void => {
    meMenu.close();
    navigate(path);
  };

  /**
   * Whether a tab owns the current route. A pushed screen such as a booth's
   * detail keeps its parent tab lit, and nothing is lit while the Me menu is
   * open except Me itself.
   * @param path - The tab's root path.
   * @returns {boolean} - True when this tab is the active one.
   */
  const isActive = (path: string): boolean =>
    !meMenu.isOpen && pathname.startsWith(path);

  return (
    <nav aria-label="Main" className={styles.bar} data-testid="jano-tab-bar">
      <span aria-hidden="true" className={styles.wordmark}>
        Jano
      </span>

      <div className={styles.row}>
        <TabButton
          icon="tabMe"
          isActive={meMenu.isOpen || pathname.startsWith('/me')}
          isLifted
          label="Me"
          onClick={() => meMenu.toggle()}
        />

        <div className={styles.centre}>
          <TabButton
            icon="tabFarm"
            isActive={isActive(routes.farm)}
            label="Farm"
            onClick={() => go(routes.farm)}
          />
          <TabButton
            icon="tabTemple"
            isActive={isActive(routes.temple)}
            label="Temple"
            onClick={() => go(routes.temple)}
          />
        </div>

        <TabButton
          icon="tabJano"
          isActive={isActive(routes.jano)}
          isLifted
          label="Jano"
          onClick={() => go(routes.jano)}
        />
      </div>
    </nav>
  );
};
