/**
 * @fileoverview Every visit the patient has completed, with what was measured.
 */

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { booths, metrics, patient } from '@/api/mock/seed';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { Screen } from '@/components/atoms/Screen';
import { AsyncState } from '@/components/molecules/AsyncState';
import type { Visit, VisitReading } from '@/core/types';
import styles from '@/features/me/ConsultationHistory.module.css';
import { useQueryOnce } from '@/hooks/useQueryOnce';
import { BackLink } from '@/navigation/BackLink';
import { routes } from '@/navigation/routes';

const STATUS_TONE = {
  cancelled: 'neutral',
  checked_in: 'brand',
  completed: 'success',
  no_show: 'warning',
  scheduled: 'brand',
} as const;

const STATUS_TEXT = {
  cancelled: 'Cancelled',
  checked_in: 'In progress',
  completed: 'Completed',
  no_show: 'Missed',
  scheduled: 'Upcoming',
} as const;

/**
 * Renders one measurement line.
 * @param props - The reading to show.
 * @returns {React.JSX.Element} - The row.
 */
const ReadingRow = ({
  reading,
}: {
  reading: VisitReading;
}): React.JSX.Element => {
  const metric = metrics.find(
    (candidate) => candidate.key === reading.metricKey,
  );
  const value =
    typeof reading.systolic === 'number'
      ? `${reading.systolic}/${reading.diastolic}`
      : String(reading.value ?? '—');

  return (
    <div className={styles.readingRow}>
      <span className="t-caption c-muted">
        {metric?.label ?? reading.metricKey}
      </span>
      <span className="t-caption">
        {value} {metric?.unit ?? ''}
      </span>
    </div>
  );
};

/**
 * The consultation history screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const ConsultationHistoryScreen = (): React.JSX.Element => {
  const { data, error, isLoading, refetch } = useQueryOnce<Visit[]>(() =>
    request(Endpoint.Visits, { patientId: patient.id }),
  );

  const visits = data ?? [];

  return (
    <Screen data-testid="consultation-history-screen">
      <BackLink fallback={routes.farm} text="Back" />
      <h1 className="t-screen-title">Consultation History</h1>

      <AsyncState
        emptyMessage="Book a visit at a Temple and it will appear here."
        emptyTitle="No consultations yet"
        error={error}
        isEmpty={visits.length === 0}
        isLoading={isLoading}
        loadingText="Loading your visits…"
        onRetry={refetch}
      />

      {visits.map((visit) => {
        const booth = booths.find(
          (candidate) => candidate.id === visit.boothId,
        );

        return (
          <Card className={styles.card} key={visit.id}>
            <div className={styles.header}>
              <div className={styles.headerText}>
                <p className="t-label">{booth?.name ?? 'Temple'}</p>
                <p className="t-caption c-muted">
                  {new Date(visit.scheduledFor).toLocaleString('en-US', {
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    month: 'short',
                  })}
                </p>
              </div>
              <Chip
                text={STATUS_TEXT[visit.status]}
                tone={STATUS_TONE[visit.status]}
              />
            </div>

            {visit.readings.length > 0 ? (
              <div className={styles.readings}>
                {visit.readings.map((reading, index) => (
                  <ReadingRow
                    key={`${reading.metricKey}-${index}`}
                    reading={reading}
                  />
                ))}
              </div>
            ) : (
              <p className="t-caption c-muted">No measurements recorded.</p>
            )}
          </Card>
        );
      })}

      <p className="t-caption c-muted">{patient.name}</p>
    </Screen>
  );
};
