/**
 * @fileoverview What a screen shows when it has nothing to show: a reason and,
 * where there is one, the thing to do about it.
 */

import styles from '@/components/molecules/AsyncState.module.css';

type EmptyStateProps = {
  icon?: string;
  message: string;
  title: string;
};

/**
 * Renders an empty state.
 * @param props - What to say.
 * @returns {React.JSX.Element} - The block.
 */
export const EmptyState = ({
  icon,
  message,
  title,
}: EmptyStateProps): React.JSX.Element => (
  <div className={styles.block}>
    {icon ? (
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
    ) : null}
    <p className="t-label">{title}</p>
    <p className="t-caption c-muted">{message}</p>
  </div>
);
