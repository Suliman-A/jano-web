/**
 * @fileoverview The way back from a pushed screen.
 *
 * The tab bar has no back affordance — all four circles are destinations — so
 * every screen that is pushed on top of a tab carries its own.
 */

import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/atoms/Icon';
import styles from '@/navigation/BackLink.module.css';

type BackLinkProps = {
  /** Where to go when there is no history to go back to, such as a deep link. */
  fallback: string;
  text?: string;
};

/**
 * Renders a back control.
 * @param props - Where to land if history is empty.
 * @returns {React.JSX.Element} - The control.
 */
export const BackLink = ({
  fallback,
  text = 'Back',
}: BackLinkProps): React.JSX.Element => {
  const navigate = useNavigate();

  return (
    <button
      className={styles.back}
      onClick={() =>
        window.history.length > 1 ? navigate(-1) : navigate(fallback)
      }
      type="button"
    >
      <span className={styles.chevron}>
        <Icon name="chevron" size={16} />
      </span>
      {text}
    </button>
  );
};
