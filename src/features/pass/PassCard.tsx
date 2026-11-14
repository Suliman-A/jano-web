/**
 * @fileoverview The check-in pass, pinned at the top of the Temple tab so it
 * is reachable from the front of the app, as the reference screens ask.
 */

import QRCode from 'react-qr-code';

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { booths, patient } from '@/api/mock/seed';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { AsyncState } from '@/components/molecules/AsyncState';
import type { Visit } from '@/core/types';
import styles from '@/features/pass/PassCard.module.css';
import { useQueryOnce } from '@/hooks/useQueryOnce';

const QR_SIZE = 108;

/**
 * Formats a slot time for display.
 * @param at - Epoch milliseconds.
 * @returns {string} - A time such as `11:30 AM`.
 */
const toTime = (at: number): string =>
  new Date(at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * Shows the QR for the next visit that has not been used yet.
 * @returns {React.JSX.Element | null} - The pass card, or nothing.
 */
export const PassCard = (): React.JSX.Element | null => {
  const visitsQuery = useQueryOnce<Visit[]>(() =>
    request(Endpoint.Visits, { patientId: patient.id }),
  );

  // A checked-in visit keeps the card, so the patient can still see where
  // they are mid-consultation rather than the app looking empty. Its code is
  // spent, so the QR is replaced by the check-in time.
  const upcoming = (visitsQuery.data ?? [])
    .filter(
      (visit) => visit.status === 'scheduled' || visit.status === 'checked_in',
    )
    .sort((a, b) => a.scheduledFor - b.scheduledFor)[0];

  const passQuery = useQueryOnce(
    () =>
      upcoming
        ? request(Endpoint.Pass, { visitId: upcoming.id })
        : Promise.resolve(null),
    [upcoming?.id],
  );

  if (visitsQuery.isLoading) {
    return <AsyncState isLoading loadingText="Checking your visits…" />;
  }

  if (!upcoming || !passQuery.data) {
    return null;
  }

  const booth = booths.find((candidate) => candidate.id === upcoming.boothId);
  const isCheckedIn = upcoming.status === 'checked_in';

  return (
    <Card className={styles.card} tinted>
      <div className={styles.header}>
        <h2 className="t-section-title">
          {isCheckedIn ? 'Your visit' : 'Check in'}
        </h2>
        <Chip
          text={isCheckedIn ? 'Checked in' : 'Demo pass'}
          tone={isCheckedIn ? 'success' : 'neutral'}
        />
      </div>

      <div className={styles.body}>
        {isCheckedIn ? (
          <div className={`${styles.qr} ${styles.qrSpent}`}>
            <span aria-hidden="true" className="t-hero">
              ✓
            </span>
            <span className="sr-only">Already checked in</span>
          </div>
        ) : (
          <div className={styles.qr} data-testid="pass-qr">
            <QRCode
              size={QR_SIZE}
              style={{ height: QR_SIZE, width: QR_SIZE }}
              title="Your check-in code"
              value={passQuery.data.code}
            />
          </div>
        )}

        <div className={styles.details}>
          <p className="t-title">{patient.name}</p>
          <p className="t-label">{booth?.name ?? 'Temple'}</p>
          <p className="t-caption c-muted">{booth?.area}</p>
          <div className={styles.time}>
            <Chip
              text={toTime(
                isCheckedIn && upcoming.checkedInAt
                  ? upcoming.checkedInAt
                  : upcoming.scheduledFor,
              )}
              tone="brand"
            />
            <span className="t-caption c-muted">
              {isCheckedIn ? 'Visit in progress' : 'Scan at the booth'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
