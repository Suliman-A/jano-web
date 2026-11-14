/**
 * @fileoverview Shared test fixtures and factories for the rules layer.
 * One module per project, per the test protocol.
 */

import type { Reading, Typical } from '@/core/rangeStatus';
import type { StoragePort } from '@/api/mock/store';
import type { Pass, PassPayload, Visit, VisitReading } from '@/core/types';

export const DATE_AUGUST = '2026-08-06';
export const DATE_SEPTEMBER = '2026-09-17';
export const DATE_OCTOBER = '2026-10-29';

export const PULSE_MIN = 60;
export const PULSE_MAX = 100;
export const SYSTOLIC_BELOW = 120;
export const DIASTOLIC_BELOW = 80;

/** Pulse: a two-sided range. */
export const RANGED_TYPICAL: Typical = {
  max: PULSE_MAX,
  min: PULSE_MIN,
};

/** Blood pressure: two one-sided upper bounds. */
export const BLOOD_PRESSURE_TYPICAL: Typical = {
  diastolicBelow: DIASTOLIC_BELOW,
  systolicBelow: SYSTOLIC_BELOW,
};

/**
 * Builds a single-value reading, such as pulse or weight.
 * @param date - The ISO date of the reading.
 * @param value - The measured value, or `null` when the booth could not read it.
 * @returns {Reading} - The reading.
 */
export const makeReading = (date: string, value: number | null): Reading => ({
  date,
  value,
});

/**
 * Builds a blood pressure reading.
 * @param date - The ISO date of the reading.
 * @param systolic - The top number, or `null` when unmeasured.
 * @param diastolic - The bottom number, or `null` when unmeasured.
 * @returns {Reading} - The reading.
 */
export const makeBloodPressureReading = (
  date: string,
  systolic: number | null,
  diastolic: number | null,
): Reading => ({
  date,
  diastolic,
  systolic,
});

// --- Visits and passes -----------------------------------------------------

export const PATIENT_ID = 'pt_demo_001';
export const OTHER_PATIENT_ID = 'pt_demo_002';
export const BOOTH_AYALA_ID = 'bth_ayala';
export const BOOTH_POBLACION_ID = 'bth_poblacion';
export const BOOKING_ID = 'bkg_test_001';
export const VISIT_ID = 'vst_test_001';
export const SLOT_ID = 'slt_test_001';
export const JTI = 'jti_test_001';

export const SLOT_LENGTH_MS = 30 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

/** A fixed slot start, so no test ever reads the real clock. */
export const SLOT_STARTS_AT = Date.parse('2026-11-20T11:30:00+08:00');
export const SLOT_ENDS_AT = SLOT_STARTS_AT + SLOT_LENGTH_MS;

/** A moment inside the check-in window. */
export const DURING_SLOT = SLOT_STARTS_AT + MINUTE_MS;

/**
 * Builds a visit sitting at its slot, scheduled and untouched.
 * @param overrides - Fields to change for the case under test.
 * @returns {Visit} - The visit.
 */
export const makeVisit = (overrides: Partial<Visit> = {}): Visit => ({
  bookingId: BOOKING_ID,
  boothId: BOOTH_AYALA_ID,
  cancelledAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  id: VISIT_ID,
  patientId: PATIENT_ID,
  readings: [],
  scheduledFor: SLOT_STARTS_AT,
  scheduledUntil: SLOT_ENDS_AT,
  slotId: SLOT_ID,
  status: 'scheduled',
  ...overrides,
});

/**
 * Builds an unused pass for the visit built by {@link makeVisit}.
 * @param overrides - Fields to change for the case under test.
 * @returns {Pass} - The pass.
 */
export const makePass = (overrides: Partial<Pass> = {}): Pass => ({
  bookingId: BOOKING_ID,
  boothId: BOOTH_AYALA_ID,
  expiresAt: SLOT_ENDS_AT,
  issuedAt: SLOT_STARTS_AT - 60 * MINUTE_MS,
  jti: JTI,
  patientId: PATIENT_ID,
  usedAt: null,
  usedByBoothId: null,
  ...overrides,
});

/**
 * Builds the fields that travel inside a QR code.
 * @param overrides - Fields to change for the case under test.
 * @returns {PassPayload} - The payload.
 */
export const makePassPayload = (
  overrides: Partial<PassPayload> = {},
): PassPayload => ({
  bookingId: BOOKING_ID,
  boothId: BOOTH_AYALA_ID,
  expiresAt: SLOT_ENDS_AT,
  jti: JTI,
  patientId: PATIENT_ID,
  ...overrides,
});

/**
 * Builds a reading the booth could record during a visit.
 * @param overrides - Fields to change for the case under test.
 * @returns {VisitReading} - The reading.
 */
export const makeVisitReading = (
  overrides: Partial<VisitReading> = {},
): VisitReading => ({
  date: '2026-11-20',
  metricKey: 'pulse',
  value: 74,
  ...overrides,
});

// --- Backend test helpers --------------------------------------------------

/**
 * A storage port backed by a plain object, so persistence tests exercise the
 * real serialise and parse round-trip rather than a mock that always agrees.
 * @returns {StoragePort & { entries: Record<string, string> }} - The port.
 */
export const createMemoryStorage = (): StoragePort & {
  entries: Record<string, string>;
} => {
  const entries: Record<string, string> = {};

  return {
    entries,
    getItem: (key) => Promise.resolve(entries[key] ?? null),
    setItem: (key, value) => {
      entries[key] = value;

      return Promise.resolve();
    },
  };
};

/**
 * A clock the test moves by hand, so nothing ever reads real time.
 * @param start - The moment the clock starts at.
 * @returns {{ now: () => number; set: (at: number) => void }} - The clock.
 */
export const createTestClock = (
  start: number,
): { now: () => number; set: (at: number) => void } => {
  let current = start;

  return {
    now: () => current,
    set: (at: number) => {
      current = at;
    },
  };
};

/** A fixed "today" for backend tests: morning, so slots lie ahead. */
export const FIXED_NOW = Date.parse('2026-11-20T09:00:00+08:00');
