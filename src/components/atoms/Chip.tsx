/**
 * @fileoverview A pill. Used as a static badge, and as a toggle for the
 * Temple screen's function filters.
 */

import styles from '@/components/atoms/Chip.module.css';

type ChipProps = {
  className?: string;
  /** Draws the small leading dot the range pill has in the reference. */
  hasDot?: boolean;
  /** Only meaningful when `onClick` is given. */
  isSelected?: boolean;
  onClick?: () => void;
  text: string;
  tone?: 'brand' | 'neutral' | 'success' | 'warning';
};

/**
 * Renders a chip, as a toggle button when it is selectable.
 * @param props - Its label, tone and selected state.
 * @returns {React.JSX.Element} - The chip.
 */
export const Chip = ({
  className = '',
  hasDot = false,
  isSelected = false,
  onClick,
  text,
  tone = 'neutral',
}: ChipProps): React.JSX.Element => {
  const body = (
    <>
      {hasDot ? <span className={styles.dot} /> : null}
      {text}
    </>
  );

  if (onClick) {
    return (
      <button
        aria-pressed={isSelected}
        className={[
          styles.chip,
          styles.selectable,
          isSelected ? styles.selected : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        type="button"
      >
        {body}
      </button>
    );
  }

  return (
    <span className={[styles.chip, styles[tone], className].join(' ')}>
      {body}
    </span>
  );
};
