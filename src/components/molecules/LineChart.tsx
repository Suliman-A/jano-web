/**
 * @fileoverview The history chart on a flower card, drawn by hand with SVG.
 *
 * A reading the booth failed to take is a gap: the line breaks and no dot is
 * drawn, rather than the value being flattened to zero.
 *
 * The maths works in a fixed viewBox and the SVG scales to its container, so
 * nothing has to measure the DOM to decide where a point goes.
 */

import React from 'react';

import styles from '@/components/molecules/LineChart.module.css';

export type ChartPoint = {
  label: string;
  value: number | null;
};

type LineChartProps = {
  points: ChartPoint[];
  /** A second line, for the two numbers of a blood pressure reading. */
  secondary?: ChartPoint[];
};

const VIEW_WIDTH = 320;
const CHART_HEIGHT = 110;
const PADDING_X = 18;
const PADDING_Y = 22;
const DOT_RADIUS = 3.5;

type Coordinate = { x: number; y: number };

/**
 * Splits a line into the runs of points that actually have values, so a gap
 * stays a gap.
 * @param coordinates - Every point, with `null` where nothing was measured.
 * @returns {Coordinate[][]} - One run per unbroken stretch.
 */
const toSegments = (coordinates: (Coordinate | null)[]): Coordinate[][] =>
  coordinates.reduce<Coordinate[][]>(
    (segments, point) => {
      if (!point) {
        return [...segments, []];
      }

      const head = segments.slice(0, -1);
      const tail = segments[segments.length - 1] ?? [];

      return [...head, [...tail, point]];
    },
    [[]],
  );

/**
 * Draws a small line chart of a metric's history.
 * @param props - The points to draw, and an optional second line.
 * @returns {React.JSX.Element} - The chart.
 */
export const LineChart = ({
  points,
  secondary,
}: LineChartProps): React.JSX.Element => {
  const allValues = [...points, ...(secondary ?? [])]
    .map((point) => point.value)
    .filter((value): value is number => typeof value === 'number');

  if (allValues.length === 0) {
    return (
      <div className={styles.empty}>
        <p className="t-caption c-muted">No readings yet</p>
      </div>
    );
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const innerWidth = VIEW_WIDTH - PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - PADDING_Y * 2;

  /**
   * Places one reading on the canvas.
   * @param value - The measured value, or null.
   * @param index - Its position in the series.
   * @returns {Coordinate | null} - The coordinates, or null when unmeasured.
   */
  const toCoordinate = (
    value: number | null,
    index: number,
  ): Coordinate | null => {
    if (typeof value !== 'number') {
      return null;
    }

    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

    return {
      x: PADDING_X + index * step,
      y: PADDING_Y + innerHeight - ((value - min) / span) * innerHeight,
    };
  };

  const lines = [points, secondary ?? []].filter((line) => line.length > 0);

  return (
    <figure className={styles.root}>
      <svg
        aria-label={`History: ${points
          .map((point) => `${point.label} ${point.value ?? 'not measured'}`)
          .join(', ')}`}
        className={styles.svg}
        role="img"
        viewBox={`0 0 ${VIEW_WIDTH} ${CHART_HEIGHT}`}
      >
        {lines.map((line, lineIndex) => {
          const coordinates = line.map((point, index) =>
            toCoordinate(point.value, index),
          );
          const stroke = lineIndex === 0 ? 'var(--c-brand)' : 'var(--c-muted)';

          return (
            <React.Fragment key={`line-${lineIndex}`}>
              {toSegments(coordinates)
                .filter((segment) => segment.length > 1)
                .map((segment, segmentIndex) => (
                  <polyline
                    fill="none"
                    key={`segment-${lineIndex}-${segmentIndex}`}
                    points={segment
                      .map((point) => `${point.x},${point.y}`)
                      .join(' ')}
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                ))}
              {coordinates.map((coordinate, index) =>
                coordinate ? (
                  <React.Fragment key={`dot-${lineIndex}-${index}`}>
                    <circle
                      cx={coordinate.x}
                      cy={coordinate.y}
                      fill={stroke}
                      r={DOT_RADIUS}
                    />
                    <text
                      fill="var(--c-ink)"
                      fontSize={10}
                      textAnchor="middle"
                      x={coordinate.x}
                      y={coordinate.y - 8}
                    >
                      {String(line[index].value)}
                    </text>
                  </React.Fragment>
                ) : null,
              )}
            </React.Fragment>
          );
        })}
      </svg>

      <figcaption className={styles.labels}>
        {points.map((point) => (
          <span className={styles.label} key={point.label}>
            {point.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};
