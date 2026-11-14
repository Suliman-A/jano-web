/**
 * @fileoverview Routes, and the two providers everything below them needs.
 *
 * HashRouter rather than BrowserRouter because the build is deployed as
 * static files: a hash route needs no server rewrite rule, so a reload on
 * /temple cannot 404 wherever it is hosted.
 */

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { BoothSimulatorScreen } from '@/features/booth/BoothSimulator.screen';
import { FarmScreen } from '@/features/farm/Farm.screen';
import { JanoScreen } from '@/features/jano/Jano.screen';
import { ConsultationHistoryScreen } from '@/features/me/ConsultationHistory.screen';
import { PassScreen } from '@/features/pass/Pass.screen';
import { BoothDetailScreen } from '@/features/temple/BoothDetail.screen';
import { TempleScreen } from '@/features/temple/Temple.screen';
import { AppShell } from '@/navigation/AppShell';
import { MeMenuProvider } from '@/navigation/MeMenuContext';
import { StoreProvider } from '@/providers/StoreProvider';

/**
 * The app.
 * @returns {React.JSX.Element} - The routed tree.
 */
export const App = (): React.JSX.Element => (
  <StoreProvider>
    <HashRouter>
      <MeMenuProvider>
        <Routes>
          <Route element={<AppShell />} path="/">
            <Route element={<Navigate replace to="/farm" />} index />
            <Route element={<FarmScreen />} path="farm" />
            <Route element={<TempleScreen />} path="temple" />
            <Route element={<BoothDetailScreen />} path="temple/:boothId" />
            <Route element={<PassScreen />} path="pass" />
            <Route element={<BoothSimulatorScreen />} path="booth-simulator" />
            <Route element={<JanoScreen />} path="jano" />
            <Route
              element={<ConsultationHistoryScreen />}
              path="me/consultation-history"
            />
            <Route element={<Navigate replace to="/farm" />} path="*" />
          </Route>
        </Routes>
      </MeMenuProvider>
    </HashRouter>
  </StoreProvider>
);
