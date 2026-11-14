/**
 * @fileoverview The one button shape the app uses, in a filled and a quiet
 * variant. It owns its own busy state so no screen has to invent one.
 */

import styles from '@/components/atoms/Button.module.css';

type ButtonProps = {
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
  text: string;
  tone?: 'primary' | 'secondary';
};

/**
 * A full-width action button.
 * @param props - Its label, handler and state.
 * @returns {React.JSX.Element} - The button.
 */
export const Button = ({
  disabled = false,
  isLoading = false,
  onClick,
  text,
  tone = 'primary',
}: ButtonProps): React.JSX.Element => (
  <button
    aria-busy={isLoading}
    className={`${styles.button} ${tone === 'secondary' ? styles.secondary : ''}`}
    disabled={disabled || isLoading}
    onClick={onClick}
    type="button"
  >
    {isLoading ? <span className={styles.spinner} /> : null}
    {text}
  </button>
);
