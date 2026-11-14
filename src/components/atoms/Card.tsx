/**
 * @fileoverview A surface with the app's padding, radius and hairline.
 *
 * With `onClick` it renders a real `button`, so it is reachable by keyboard
 * and announced as a control rather than as a div that happens to respond.
 */

import styles from '@/components/atoms/Card.module.css';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  onClick?: () => void;
  /** The pale lavender surface the reference screens use for the pass. */
  tinted?: boolean;
};

/**
 * Renders a card, as a button when it is tappable.
 * @param props - Its contents and whether it acts.
 * @returns {React.JSX.Element} - The card.
 */
export const Card = ({
  children,
  className = '',
  'data-testid': testId,
  onClick,
  tinted = false,
}: CardProps): React.JSX.Element => {
  const classNames = [
    styles.card,
    tinted ? styles.tinted : '',
    onClick ? styles.pressable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        className={classNames}
        data-testid={testId}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classNames} data-testid={testId}>
      {children}
    </div>
  );
};
