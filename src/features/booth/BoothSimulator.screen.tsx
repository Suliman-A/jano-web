/**
 * @fileoverview The Booth simulator: a stand-in for the physical booth.
 *
 * There is no real hardware to demo against, so this screen plays the booth's
 * part — it accepts or refuses a pass, records a few readings, and checks the
 * patient out. It is styled as an operator console rather than patient UI, so
 * nobody mistakes it for part of the patient app.
 */

import { useEffect, useState } from 'react';

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { booths, metrics, patient } from '@/api/mock/seed';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { Screen } from '@/components/atoms/Screen';
import type { MetricKey, Visit } from '@/core/types';
import styles from '@/features/booth/BoothSimulator.module.css';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useQueryOnce } from '@/hooks/useQueryOnce';
import { BackLink } from '@/navigation/BackLink';
import { routes } from '@/navigation/routes';

/** Plausible readings the simulated devices "take". */
const DEVICE_READINGS: {
  diastolic?: number;
  metricKey: MetricKey;
  systolic?: number;
  value?: number;
}[] = [
  { diastolic: 86, metricKey: 'blood_pressure', systolic: 134 },
  { metricKey: 'pulse', value: 77 },
  { metricKey: 'spo2', value: 98 },
  { metricKey: 'temperature', value: 36.7 },
  { metricKey: 'weight', value: 60.6 },
];

/**
 * The booth simulator screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const BoothSimulatorScreen = (): React.JSX.Element => {
  const [boothId, setBoothId] = useState(booths[0].id);
  const [code, setCode] = useState('');
  const [checkedIn, setCheckedIn] = useState<Visit | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const visitsQuery = useQueryOnce<Visit[]>(() =>
    request(Endpoint.Visits, { patientId: patient.id }),
  );

  const passQuery = useQueryOnce(() => {
    const upcoming = (visitsQuery.data ?? []).find(
      (visit) => visit.status === 'scheduled',
    );

    return upcoming
      ? request(Endpoint.Pass, { visitId: upcoming.id })
      : Promise.resolve(null);
  }, [visitsQuery.data]);

  const passBoothId = passQuery.data?.pass.boothId;
  const passBooth = booths.find((booth) => booth.id === passBoothId);

  // Follow whichever booth the waiting pass was issued for, so the happy path
  // works without matching them up by hand. Without this every scan looks
  // broken for a reason that has nothing to do with the rules.
  useEffect(() => {
    if (passBoothId) {
      setBoothId(passBoothId);
    }
  }, [passBoothId]);

  const checkIn = useAsyncAction(async (scannedCode: string) =>
    request(Endpoint.CheckIn, { boothId, code: scannedCode }),
  );

  const takeReadings = useAsyncAction(async (visitId: string) => {
    for (const reading of DEVICE_READINGS) {
      await request(Endpoint.RecordReading, { ...reading, visitId });
    }

    return true;
  });

  const checkOut = useAsyncAction(async (visitId: string) =>
    request(Endpoint.CheckOut, { visitId }),
  );

  /**
   * Clears the last result. Called whenever the operator changes what is
   * about to be scanned, so a refusal never lingers over a new attempt.
   */
  const clearResult = (): void => {
    checkIn.reset();
    setNote(null);
  };

  /**
   * Takes a new code, dropping any previous result.
   * @param next - The scanned or pasted string.
   */
  const changeCode = (next: string): void => {
    clearResult();
    setCode(next);
  };

  /**
   * Switches which booth this is pretending to be.
   * @param next - The booth id.
   */
  const changeBooth = (next: string): void => {
    clearResult();
    setBoothId(next);
  };

  /**
   * Scans whatever is in the code field.
   */
  const scan = async (): Promise<void> => {
    setNote(null);

    const result = await checkIn.run(code.trim());

    if (result) {
      setCheckedIn(result.visit);
      setNote(`Checked in at ${new Date().toLocaleTimeString()}`);
    }
  };

  /**
   * Copies the patient's current pass into the field, standing in for a scan.
   */
  const simulateScan = (): void => {
    if (passQuery.data) {
      changeCode(passQuery.data.code);
    }
  };

  /**
   * Records the device readings, then ends the visit.
   */
  const finish = async (): Promise<void> => {
    if (!checkedIn) {
      return;
    }

    const recorded = await takeReadings.run(checkedIn.id);

    // A visit that completes with missing measurements is worse than one that
    // stays open, so a failed device reading stops the check-out.
    if (!recorded) {
      return;
    }

    const result = await checkOut.run(checkedIn.id);

    if (result) {
      setCheckedIn(null);
      setCode('');
      setNote('Visit complete. The patient app has already updated.');
    }
  };

  const visitError = takeReadings.error ?? checkOut.error;

  return (
    <Screen className={styles.screen} data-testid="booth-simulator-screen">
      <BackLink fallback={routes.temple} text="Temple" />

      <div className={styles.banner}>
        <p className="t-label">BOOTH SIMULATOR</p>
        <p className="t-caption">
          Stands in for the physical Temple. Not patient UI.
        </p>
      </div>

      <h2 className="t-section-title">1. Which Temple is this?</h2>
      <div className={styles.booths}>
        {booths.map((booth) => (
          <Chip
            isSelected={booth.id === boothId}
            key={booth.id}
            onClick={() => changeBooth(booth.id)}
            text={booth.name}
          />
        ))}
      </div>

      {passBooth ? (
        <p
          className={`t-caption ${passBooth.id === boothId ? 'c-muted' : 'c-warning'}`}
        >
          {passBooth.id === boothId
            ? `The waiting pass is for ${passBooth.name}.`
            : `Heads up: the waiting pass is for ${passBooth.name}, so this booth will refuse it.`}
        </p>
      ) : null}

      <h2 className="t-section-title">2. Scan the pass</h2>
      <textarea
        aria-label="Scanned code"
        autoCapitalize="none"
        autoCorrect="off"
        className={styles.input}
        data-testid="sim-code-input"
        onChange={(event) => changeCode(event.target.value)}
        placeholder="Paste or scan a pass code"
        spellCheck={false}
        value={code}
      />

      <button
        className={styles.link}
        data-testid="sim-simulate-scan"
        disabled={!passQuery.data}
        onClick={simulateScan}
        type="button"
      >
        Simulate scanning the patient&rsquo;s QR
      </button>

      <Button
        disabled={code.trim() === ''}
        isLoading={checkIn.isLoading}
        onClick={scan}
        text="Accept pass and check in"
      />

      {checkIn.error ? (
        <Card className={styles.rejected} data-testid="sim-rejection">
          <p className="t-label c-danger">Pass refused</p>
          <p className="t-caption c-danger">{checkIn.error.message}</p>
          {checkIn.failure ? (
            <p className="t-caption c-muted" data-testid="sim-rejection-code">
              reason: {checkIn.failure.code}
            </p>
          ) : null}
        </Card>
      ) : null}

      {visitError ? (
        <Card className={styles.rejected} data-testid="sim-visit-error">
          <p className="t-label c-danger">The visit could not be completed</p>
          <p className="t-caption c-danger">{visitError.message}</p>
          <p className="t-caption c-muted">
            The patient is still checked in. Try again.
          </p>
        </Card>
      ) : null}

      {note ? (
        <Card className={styles.accepted} data-testid="sim-note">
          <p className="t-caption c-success">{note}</p>
        </Card>
      ) : null}

      {checkedIn ? (
        <>
          <h2 className="t-section-title">3. Take the measurements</h2>
          <Card className={styles.readings}>
            {DEVICE_READINGS.map((reading) => {
              const metric = metrics.find(
                (candidate) => candidate.key === reading.metricKey,
              );

              return (
                <div className={styles.readingRow} key={reading.metricKey}>
                  <span className="t-caption">
                    {metric?.label ?? reading.metricKey}
                  </span>
                  <span className="t-caption c-muted">
                    {reading.systolic
                      ? `${reading.systolic}/${reading.diastolic} ${metric?.unit ?? ''}`
                      : `${reading.value} ${metric?.unit ?? ''}`}
                  </span>
                </div>
              );
            })}
          </Card>

          <Button
            isLoading={takeReadings.isLoading || checkOut.isLoading}
            onClick={finish}
            text="Record readings and check out"
          />
        </>
      ) : null}
    </Screen>
  );
};
