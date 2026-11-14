/**
 * @fileoverview Draws one icon from the registry at a given size.
 *
 * Icons are decorative here — every one of them sits next to its own label —
 * so they are hidden from assistive technology rather than announced twice.
 */

import { iconRegistry, type IconName } from '@/components/atoms/iconRegistry';

type IconProps = {
  /** Any CSS colour. Defaults to the inherited text colour. */
  color?: string;
  name: IconName;
  size?: number;
  strokeWidth?: number;
};

/**
 * Renders an icon.
 * @param props - Which icon, and how big.
 * @returns {React.JSX.Element} - The icon.
 */
export const Icon = ({
  color = 'currentColor',
  name,
  size = 20,
  strokeWidth = 1.9,
}: IconProps): React.JSX.Element => {
  const Glyph = iconRegistry[name];

  return (
    <Glyph
      aria-hidden="true"
      color={color}
      focusable="false"
      size={size}
      strokeWidth={strokeWidth}
    />
  );
};
