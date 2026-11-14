/**
 * @fileoverview A placeholder for the Jano assistant, which is out of scope.
 */

import { Screen } from '@/components/atoms/Screen';
import { EmptyState } from '@/components/molecules/EmptyState';

/**
 * The Jano placeholder screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const JanoScreen = (): React.JSX.Element => (
  <Screen data-testid="jano-screen">
    <h1 className="t-screen-title">Jano</h1>
    <EmptyState
      icon="💬"
      message="Asking Jano a question is outside this prototype."
      title="Coming soon"
    />
  </Screen>
);
