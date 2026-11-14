/**
 * @fileoverview The shapes the whole app agrees on.
 *
 * Every instant is epoch milliseconds rather than a Date, because state is
 * persisted as JSON and a Date comes back out of JSON.parse as a string.
 */

import type { Reading } from '@/core/rangeStatus';

export type BoothFunctionKey =
  'basic' | 'maternal' | 'pediatric' | 'physical_therapy';

export type BoothStatus = 'maintenance' | 'open';

export type Booth = {
  area: string;
  functions: BoothFunctionKey[];
  /** Opening hours as `HH:mm-HH:mm` in the booth's own timezone. */
  hours: string;
  id: string;
  /** Null for a booth whose location has not been surveyed yet. */
  lat: number | null;
  lng: number | null;
  name: string;
  status: BoothStatus;
};

export type Slot = {
  boothId: string;
  endsAt: number;
  id: string;
  /** False when the booth is already busy at that time. */
  isAvailable: boolean;
  startsAt: number;
};

export type MetricKey =
  'blood_pressure' | 'body_fat' | 'pulse' | 'spo2' | 'temperature' | 'weight';

export type Metric = {
  explain: string;
  /** The flower that stands for this metric on the Farm. */
  flower: string;
  key: MetricKey;
  label: string;
  typical: import('@/core/rangeStatus').Typical;
  unit: string;
};

/** A reading taken at a booth. Shares the `Reading` shape so the Farm can
 *  merge seeded history and new readings without converting anything. */
export type VisitReading = Reading & {
  metricKey: MetricKey;
};

export type VisitStatus =
  'cancelled' | 'checked_in' | 'completed' | 'no_show' | 'scheduled';

export type VisitEventType =
  'CANCEL' | 'CHECK_IN' | 'CHECK_OUT' | 'EXPIRE' | 'RECORD_READING';

export type Visit = {
  bookingId: string;
  boothId: string;
  cancelledAt: number | null;
  checkedInAt: number | null;
  checkedOutAt: number | null;
  id: string;
  patientId: string;
  readings: VisitReading[];
  /** Copied from the slot so a visit reads without a join. */
  scheduledFor: number;
  scheduledUntil: number;
  slotId: string;
  status: VisitStatus;
};

/** The reservation. Separate from the Visit because a booking is a scheduling
 *  record while a visit is the encounter itself. */
export type Booking = {
  boothId: string;
  createdAt: number;
  id: string;
  patientId: string;
  slotId: string;
  visitId: string;
};

/** The pass as the backend holds it. The scannable string is derived from it. */
export type Pass = {
  bookingId: string;
  boothId: string;
  expiresAt: number;
  issuedAt: number;
  /** The one-time id. Marking this used is what stops a second scan. */
  jti: string;
  patientId: string;
  usedAt: number | null;
  usedByBoothId: string | null;
};

/** The part of a pass that travels inside the QR code. */
export type PassPayload = {
  bookingId: string;
  boothId: string;
  expiresAt: number;
  jti: string;
  patientId: string;
};

export type Patient = {
  id: string;
  name: string;
};
