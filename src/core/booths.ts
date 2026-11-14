/**
 * @fileoverview Small helpers for working with booths, including the ones
 * whose location has not been surveyed.
 */

import type { Booth, BoothFunctionKey } from '@/core/types';

export type Coordinates = {
  lat: number;
  lng: number;
};

/**
 * Tells whether a booth can be placed on the map.
 * @param booth - The booth to inspect.
 * @returns {boolean} - True when both coordinates are known.
 */
export const hasLocation = (
  booth: Booth,
): booth is Booth & Coordinates & { lat: number; lng: number } =>
  typeof booth.lat === 'number' && typeof booth.lng === 'number';

/**
 * Tells whether a booth is open for bookings.
 * @param booth - The booth to inspect.
 * @returns {boolean} - True when the booth is not in maintenance.
 */
export const isBookable = (booth: Booth): boolean => booth.status === 'open';

/**
 * Straight-line distance, good enough for ordering a short list.
 *
 * A booth with no coordinates gets `Infinity` rather than `NaN`, so it sorts
 * last instead of landing in an arbitrary position.
 *
 * @param booth - The booth to measure.
 * @param origin - Where the patient is.
 * @returns {number} - A comparable distance, or `Infinity` when unknown.
 */
export const distanceFrom = (booth: Booth, origin: Coordinates): number => {
  if (!hasLocation(booth)) {
    return Infinity;
  }

  const dLat = booth.lat - origin.lat;
  const dLng = booth.lng - origin.lng;

  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Orders booths by how close they are, unlocated ones last.
 * @param booths - The booths to order.
 * @param origin - Where the patient is.
 * @returns {Booth[]} - A new, sorted array.
 */
export const sortByDistance = (booths: Booth[], origin: Coordinates): Booth[] =>
  [...booths].sort((a, b) => distanceFrom(a, origin) - distanceFrom(b, origin));

/**
 * Filters booths by area text and by the care they offer.
 * @param booths - Every booth.
 * @param query - Free text matched against the booth name and area.
 * @param functions - The selected booth functions; empty means no filter.
 * @returns {Booth[]} - The booths that match.
 */
export const filterBooths = (
  booths: Booth[],
  query: string,
  functions: BoothFunctionKey[],
): Booth[] => {
  const needle = query.trim().toLowerCase();

  return booths.filter((booth) => {
    const matchesText =
      needle === '' ||
      booth.area.toLowerCase().includes(needle) ||
      booth.name.toLowerCase().includes(needle);

    const matchesFunction =
      functions.length === 0 ||
      functions.some((fn) => booth.functions.includes(fn));

    return matchesText && matchesFunction;
  });
};
