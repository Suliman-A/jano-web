/**
 * @fileoverview The pass on its own screen, for holding up at the booth.
 */

import { Screen } from '@/components/atoms/Screen';
import { PassCard } from '@/features/pass/PassCard';
import { BackLink } from '@/navigation/BackLink';
import { routes } from '@/navigation/routes';

/**
 * The full-screen pass.
 * @returns {React.JSX.Element} - The screen.
 */
export const PassScreen = (): React.JSX.Element => (
  <Screen data-testid="pass-screen">
    <BackLink fallback={routes.temple} text="Temple" />
    <h1 className="t-screen-title">You&rsquo;re booked</h1>
    <p className="t-caption c-muted">
      Show this at the Temple to check in. It works once.
    </p>
    <PassCard />
  </Screen>
);
