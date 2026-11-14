/**
 * @fileoverview The Farm: one flower per health measurement.
 *
 * A plain two-column grid, three rows of two. Tapping a flower opens its card
 * full width directly beneath that row, the way the reference screen shows it,
 * rather than pushing a route or opening a sheet.
 */

import { useState } from 'react';

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { patient } from '@/api/mock/seed';
import { Screen } from '@/components/atoms/Screen';
import { AsyncState } from '@/components/molecules/AsyncState';
import type { MetricSeries } from '@/core/readings';
import type { MetricKey } from '@/core/types';
import styles from '@/features/farm/Farm.module.css';
import { FlowerCard } from '@/features/farm/FlowerCard';
import { useQueryOnce } from '@/hooks/useQueryOnce';

const COLUMNS = 2;

/** The brief allows emoji for the flowers. */
const FLOWER_EMOJI: Record<MetricKey, string> = {
  blood_pressure: '🌺',
  body_fat: '💜',
  pulse: '🌷',
  spo2: '💠',
  temperature: '🌼',
  weight: '🌻',
};

/**
 * Splits the metrics into rows of two, so the grid stays square however many
 * metrics the backend returns.
 * @param series - Every metric series.
 * @returns {MetricSeries[][]} - The rows.
 */
const toRows = (series: MetricSeries[]): MetricSeries[][] =>
  series.reduce<MetricSeries[][]>((rows, item, index) => {
    if (index % COLUMNS === 0) {
      return [...rows, [item]];
    }

    return [...rows.slice(0, -1), [...rows[rows.length - 1], item]];
  }, []);

/**
 * The Farm screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const FarmScreen = (): React.JSX.Element => {
  const [openKey, setOpenKey] = useState<MetricKey | null>(null);

  const { data, error, isLoading, refetch } = useQueryOnce<MetricSeries[]>(() =>
    request(Endpoint.Farm, { patientId: patient.id }),
  );

  const series = data ?? [];
  const rows = toRows(series);

  return (
    <Screen data-testid="farm-screen">
      <h1 className="t-screen-title">Your Farm</h1>
      <p className="t-caption c-muted">
        {patient.name} · each flower is one measurement
      </p>

      <AsyncState
        emptyMessage="Your measurements will appear here after your first visit."
        emptyTitle="No flowers yet"
        error={error}
        isEmpty={series.length === 0}
        isLoading={isLoading}
        loadingText="Growing your farm…"
        onRetry={refetch}
      />

      {rows.map((row) => {
        const openInRow = row.find((item) => item.metric.key === openKey);

        return (
          <div className={styles.rowGroup} key={row[0].metric.key}>
            <div className={styles.row}>
              {row.map((item) => {
                const isOpen = item.metric.key === openKey;

                return (
                  <button
                    aria-expanded={isOpen}
                    className={`${styles.tile} ${isOpen ? styles.tileOpen : ''}`}
                    data-testid={`flower-${item.metric.key}`}
                    key={item.metric.key}
                    onClick={() => setOpenKey(isOpen ? null : item.metric.key)}
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.emoji}>
                      {FLOWER_EMOJI[item.metric.key]}
                    </span>
                    <span className="t-section-title">
                      {item.metric.flower}
                    </span>
                    <span className="t-caption c-muted">
                      {item.metric.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {openInRow ? <FlowerCard series={openInRow} /> : null}
          </div>
        );
      })}
    </Screen>
  );
};
