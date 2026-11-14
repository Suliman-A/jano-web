/**
 * @fileoverview The loading, error and empty states a screen needs, in one
 * place, so no screen writes its own spinner or swallows an error.
 *
 * It renders nothing at all once there is data, which is why screens can put
 * it above their content unconditionally.
 */

import { EmptyState } from '@/components/molecules/EmptyState';
import styles from '@/components/molecules/AsyncState.module.css';

type AsyncStateProps = {
  emptyMessage?: string;
  emptyTitle?: string;
  error?: Error | null;
  isEmpty?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  onRetry?: () => void;
};

/**
 * Renders whichever of loading, error or empty applies.
 * @param props - The query's state.
 * @returns {React.JSX.Element | null} - The block, or nothing.
 */
export const AsyncState = ({
  emptyMessage = '',
  emptyTitle = 'Nothing here yet',
  error = null,
  isEmpty = false,
  isLoading = false,
  loadingText = 'Loading…',
  onRetry,
}: AsyncStateProps): React.JSX.Element | null => {
  if (isLoading) {
    return (
      <div aria-live="polite" className={styles.block}>
        <span className={styles.spinner} />
        <p className="t-caption c-muted">{loadingText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.block} ${styles.error}`} role="alert">
        <p className="t-label c-danger">Something went wrong</p>
        <p className="t-caption c-muted">{error.message}</p>
        {onRetry ? (
          <button className={styles.retry} onClick={onRetry} type="button">
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  return null;
};
