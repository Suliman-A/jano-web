/**
 * @fileoverview The card that opens when a flower is tapped, laid out like the
 * reference screen: the flower's name, the measurement, the latest value with
 * its range pill and visit date, a one-line explanation, then the history
 * chart in its own white panel.
 */

import { Chip } from '@/components/atoms/Chip';
import { type ChartPoint, LineChart } from '@/components/molecules/LineChart';
import type { Status } from '@/core/rangeStatus';
import type { MetricSeries } from '@/core/readings';
import styles from '@/features/farm/FlowerCard.module.css';

type FlowerCardProps = {
  series: MetricSeries;
};

const STATUS_TEXT: Record<Status, string> = {
  above: 'Above typical range',
  below: 'Below typical range',
  in: 'In typical range',
  none: 'No typical range',
};

const STATUS_TONE: Record<Status, 'neutral' | 'success' | 'warning'> = {
  above: 'warning',
  below: 'warning',
  in: 'success',
  none: 'neutral',
};

/**
 * Formats a date like `2026-10-29` as `Oct 29`.
 * @param date - An ISO date.
 * @returns {string} - A short label.
 */
const toShortDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });

/**
 * Reads the headline number out of the latest reading.
 * @param series - The metric's series.
 * @returns {string} - The value to display, or a dash.
 */
const headlineValue = (series: MetricSeries): string => {
  const latest = series.latest;

  if (!latest) {
    return '—';
  }

  if (typeof latest.systolic === 'number') {
    return `${latest.systolic}/${latest.diastolic}`;
  }

  return String(latest.value);
};

/**
 * The expanded measurement card.
 * @param props - The metric's assembled series.
 * @returns {React.JSX.Element} - The card.
 */
export const FlowerCard = ({ series }: FlowerCardProps): React.JSX.Element => {
  const isBloodPressure = series.metric.key === 'blood_pressure';

  const points: ChartPoint[] = series.history.map((reading) => ({
    label: toShortDate(reading.date),
    value: isBloodPressure
      ? (reading.systolic ?? null)
      : (reading.value ?? null),
  }));

  const secondary: ChartPoint[] | undefined = isBloodPressure
    ? series.history.map((reading) => ({
        label: toShortDate(reading.date),
        value: reading.diastolic ?? null,
      }))
    : undefined;

  const year = series.latest
    ? new Date(`${series.latest.date}T00:00:00`).getFullYear()
    : undefined;

  return (
    <section
      className={styles.card}
      data-testid={`flower-card-${series.metric.key}`}
    >
      <div className={styles.header}>
        <p className="t-label c-brand">{series.metric.flower}</p>
        <Chip text="Sample data" tone="neutral" />
      </div>

      <h2 className="t-title">{series.metric.label}</h2>

      <div className={styles.headline}>
        <span className={`t-hero ${styles.value}`}>
          {headlineValue(series)}
        </span>
        <span className={`t-body c-muted ${styles.unit}`}>
          {series.metric.unit}
        </span>
        <Chip
          hasDot
          text={STATUS_TEXT[series.status]}
          tone={STATUS_TONE[series.status]}
        />
        {series.latest ? (
          <span className="t-caption c-muted">
            {toShortDate(series.latest.date)} visit
          </span>
        ) : null}
      </div>

      <p className="t-caption c-muted">{series.metric.explain}</p>

      <div className={styles.chartHeader}>
        <h3 className="t-label">Consultation history</h3>
        {year ? <span className="t-caption c-muted">{year}</span> : null}
      </div>

      <LineChart points={points} secondary={secondary} />
    </section>
  );
};
