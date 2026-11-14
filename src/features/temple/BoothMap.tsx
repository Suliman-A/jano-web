/**
 * @fileoverview The Temple map, drawn by hand.
 *
 * There is no map SDK here and no tile provider: the pins are placed by a
 * linear lat/lng → x/y projection over a plain background, which is why the
 * panel says "Illustrative map" exactly as the reference screen does. Over a
 * few kilometres of one city a linear projection is visually indistinguishable
 * from a proper one, and it needs no key, no network and no licence.
 *
 * Booths with no surveyed coordinates — the sample data has one — are simply
 * not drawn. They still appear in the list below, with a note.
 */

import { hasLocation } from '@/core/booths';
import type { Booth } from '@/core/types';
import styles from '@/features/temple/BoothMap.module.css';

type BoothMapProps = {
  booths: Booth[];
  onSelect: (boothId: string) => void;
};

/** Metro Manila, used when nothing is on the map to frame it around. */
const FALLBACK = { lat: 14.5649, lng: 121.0306 };

/** Keeps pins off the panel's edges, as a fraction of its size. */
const INSET = 0.14;

type Located = Booth & { lat: number; lng: number };

/**
 * Projects a value within a range onto 0…1, with the range padded so a pin
 * never lands on the panel's edge and a single pin lands in the middle.
 * @param value - The latitude or longitude to place.
 * @param min - The lowest value on the map.
 * @param max - The highest value on the map.
 * @returns {number} - A fraction between INSET and 1 - INSET.
 */
const project = (value: number, min: number, max: number): number => {
  const span = max - min;

  if (span === 0) {
    return 0.5;
  }

  return INSET + ((value - min) / span) * (1 - INSET * 2);
};

/**
 * Draws the booths as pins.
 * @param props - The booths to show, and what a pin does.
 * @returns {React.JSX.Element} - The map.
 */
export const BoothMap = ({
  booths,
  onSelect,
}: BoothMapProps): React.JSX.Element => {
  const located = booths.filter(hasLocation) as Located[];

  const lats = located.map((booth) => booth.lat);
  const lngs = located.map((booth) => booth.lng);

  const bounds = {
    maxLat: lats.length > 0 ? Math.max(...lats) : FALLBACK.lat,
    maxLng: lngs.length > 0 ? Math.max(...lngs) : FALLBACK.lng,
    minLat: lats.length > 0 ? Math.min(...lats) : FALLBACK.lat,
    minLng: lngs.length > 0 ? Math.min(...lngs) : FALLBACK.lng,
  };

  return (
    <div className={styles.root} data-testid="booth-map">
      <span className={styles.caption}>Illustrative map</span>

      {located.length === 0 ? (
        <p className={`t-caption c-muted ${styles.overlay}`}>
          No Temples to show here
        </p>
      ) : null}

      {located.map((booth) => (
        <button
          className={styles.pin}
          data-testid={`map-pin-${booth.id}`}
          key={booth.id}
          onClick={() => onSelect(booth.id)}
          style={{
            // Latitude grows northward and y grows downward, so it is flipped.
            left: `${project(booth.lng, bounds.minLng, bounds.maxLng) * 100}%`,
            top: `${(1 - project(booth.lat, bounds.minLat, bounds.maxLat)) * 100}%`,
          }}
          type="button"
        >
          <span className={styles.dot} />
          <span className={styles.pinLabel}>{booth.area}</span>
        </button>
      ))}
    </div>
  );
};
