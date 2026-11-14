/**
 * @fileoverview The mock backend. One handler per endpoint, all of them going
 * through the store so the booth and the patient see the same data.
 *
 * Where a pass is rejected, and why, lives in `checkIn` below — together with
 * `verifyPass` in `src/core/pass.ts`, which holds the checks a booth can make
 * without a network.
 */

import { Endpoint } from '@/api/endpoints';
import { delay, throwIfForced } from '@/api/mock/latency';
import {
  booths,
  generateSlots,
  metrics,
  patient,
  seededHistory,
} from '@/api/mock/seed';
import {
  getState,
  now,
  ready,
  type StoreState,
  transact,
} from '@/api/mock/store';
import { JanoError } from '@/api/types';
import { isBookable } from '@/core/booths';
import { JanoErrorCode } from '@/core/errors';
import { encodePass, verifyPass } from '@/core/pass';
import { buildSeries, type MetricSeries } from '@/core/readings';
import { err, ok, type Result } from '@/core/result';
import type {
  Booking,
  Booth,
  MetricKey,
  Pass,
  Slot,
  Visit,
  VisitReading,
} from '@/core/types';
import { applyVisitEvent } from '@/core/visitMachine';

/** How long before the slot ends a pass stops working. */
const PASS_VALID_UNTIL_SLOT_END = true;

let sequence = 0;

/**
 * Builds a readable, unique id.
 * @param prefix - A short kind marker, such as `bkg`.
 * @returns {string} - The id.
 */
const makeId = (prefix: string): string => {
  sequence += 1;

  return `${prefix}_${now().toString(36)}${sequence.toString(36)}`;
};

/**
 * Today's date in the form the seeded history uses.
 * @param at - Epoch milliseconds.
 * @returns {string} - An ISO date such as `2026-11-20`.
 */
const toIsoDate = (at: number): string =>
  new Date(at).toISOString().slice(0, 10);

/**
 * Unwraps a rules-layer result, turning a failure into the thrown error screens
 * catch.
 * @param result - The result to unwrap.
 * @returns {T} - The value, when there is one.
 */
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new JanoError(result.error);
  }

  return result.value;
};

/**
 * Finds a booth by id.
 * @param boothId - The booth to find.
 * @returns {Booth | undefined} - The booth, if it exists.
 */
const findBooth = (boothId: string): Booth | undefined =>
  booths.find((booth) => booth.id === boothId);

/**
 * Lists a booth's slots with bookings taken into account.
 * @param boothId - The booth to list.
 * @param state - The current store state.
 * @returns {Slot[]} - The booth's upcoming slots.
 */
const slotsForBooth = (boothId: string, state: StoreState): Slot[] => {
  const booth = findBooth(boothId);
  const boothIsOpen = Boolean(booth && isBookable(booth));

  return generateSlots(now())
    .filter((slot) => slot.boothId === boothId)
    .map((slot) => ({
      ...slot,
      isAvailable:
        boothIsOpen &&
        slot.isAvailable &&
        !state.takenSlotIds.includes(slot.id),
    }));
};

/**
 * Books a slot, creating the booking, the visit and the pass together.
 *
 * The visit exists from the moment of booking, in `scheduled`, so check-in is a
 * transition rather than a creation and there is never a "no visit yet" branch.
 *
 * @param body - Which patient is booking which slot.
 * @returns {{ booking: Booking; pass: Pass; visit: Visit }} - What was created.
 */
const book = (body: { patientId: string; slotId: string }) =>
  unwrap(
    transact<{ booking: Booking; pass: Pass; visit: Visit }>((state) => {
      const slot = generateSlots(now()).find(
        (candidate) => candidate.id === body.slotId,
      );

      if (!slot) {
        return err({
          code: JanoErrorCode.SlotUnknown,
          slotId: body.slotId,
        });
      }

      if (!slot.isAvailable || state.takenSlotIds.includes(slot.id)) {
        return err({ code: JanoErrorCode.SlotTaken, slotId: slot.id });
      }

      const booth = findBooth(slot.boothId);

      if (!booth || !isBookable(booth)) {
        return err({
          boothId: slot.boothId,
          boothStatus: booth?.status ?? 'unknown',
          code: JanoErrorCode.BoothUnavailable,
        });
      }

      const visitId = makeId('vst');
      const bookingId = makeId('bkg');

      const booking: Booking = {
        boothId: slot.boothId,
        createdAt: now(),
        id: bookingId,
        patientId: body.patientId,
        slotId: slot.id,
        visitId,
      };

      const visit: Visit = {
        bookingId,
        boothId: slot.boothId,
        checkedInAt: null,
        checkedOutAt: null,
        id: visitId,
        patientId: body.patientId,
        readings: [],
        scheduledFor: slot.startsAt,
        scheduledUntil: slot.endsAt,
        slotId: slot.id,
        status: 'scheduled',
      };

      const pass: Pass = {
        bookingId,
        boothId: slot.boothId,
        expiresAt: PASS_VALID_UNTIL_SLOT_END ? slot.endsAt : slot.startsAt,
        issuedAt: now(),
        jti: makeId('jti'),
        patientId: body.patientId,
        usedAt: null,
        usedByBoothId: null,
      };

      return ok({
        next: {
          ...state,
          bookings: { ...state.bookings, [bookingId]: booking },
          passes: { ...state.passes, [pass.jti]: pass },
          takenSlotIds: [...state.takenSlotIds, slot.id],
          visits: { ...state.visits, [visitId]: visit },
        },
        value: { booking, pass, visit },
      });
    }),
  );

/**
 * Accepts or refuses a scanned pass, and checks the patient in when it holds.
 *
 * The order of the checks is deliberate. A pass that was already used must be
 * reported as used, not as an illegal transition — both refuse the scan, but
 * only one tells the patient something true.
 *
 * @param body - The scanning booth and the scanned code.
 * @returns {{ visit: Visit }} - The checked-in visit.
 */
const checkIn = (body: { boothId: string; code: string }) =>
  unwrap(
    transact<{ visit: Visit }>((state) => {
      // 1 and 2: shape, version, expiry and the booth — all decidable from the
      // code alone, with no store and no network.
      const verified = verifyPass(body.code, {
        now: now(),
        scanningBoothId: body.boothId,
      });

      if (!verified.ok) {
        return verified;
      }

      const payload = verified.value;

      // 3: is this a pass we ever issued?
      const pass = state.passes[payload.jti];

      if (!pass) {
        return err({ code: JanoErrorCode.PassUnknown, jti: payload.jti });
      }

      // 4: has it been scanned before? This is the one check the code itself
      // cannot answer.
      if (pass.usedAt !== null) {
        return err({
          code: JanoErrorCode.PassUsed,
          jti: pass.jti,
          usedAt: pass.usedAt,
          usedByBoothId: pass.usedByBoothId ?? pass.boothId,
        });
      }

      // 5: does the code name the patient the booking was made for?
      if (pass.patientId !== payload.patientId) {
        return err({
          code: JanoErrorCode.PassWrongPatient,
          expectedPatientId: pass.patientId,
          passPatientId: payload.patientId,
        });
      }

      // 6: is the booth itself able to see anyone?
      const booth = findBooth(body.boothId);

      if (!booth || !isBookable(booth)) {
        return err({
          boothId: body.boothId,
          boothStatus: booth?.status ?? 'unknown',
          code: JanoErrorCode.BoothUnavailable,
        });
      }

      // 7: and finally, is the visit itself in a state that allows check-in?
      const booking = state.bookings[pass.bookingId];
      const visit = booking ? state.visits[booking.visitId] : undefined;

      if (!visit) {
        return err({
          code: JanoErrorCode.VisitUnknown,
          visitId: booking?.visitId ?? '-',
        });
      }

      const transitioned = applyVisitEvent(visit, {
        at: now(),
        boothId: body.boothId,
        type: 'CHECK_IN',
      });

      if (!transitioned.ok) {
        return transitioned;
      }

      // The pass is consumed and the visit advanced in the same commit, so
      // there is no moment where one happened and the other did not.
      return ok({
        next: {
          ...state,
          passes: {
            ...state.passes,
            [pass.jti]: {
              ...pass,
              usedAt: now(),
              usedByBoothId: body.boothId,
            },
          },
          visits: { ...state.visits, [visit.id]: transitioned.value },
        },
        value: { visit: transitioned.value },
      });
    }),
  );

/**
 * Records one measurement against a checked-in visit.
 * @param body - The visit, the metric and what was measured.
 * @returns {{ visit: Visit }} - The updated visit.
 */
const recordReading = (body: {
  diastolic?: number | null;
  metricKey: MetricKey;
  systolic?: number | null;
  value?: number | null;
  visitId: string;
}) =>
  unwrap(
    transact<{ visit: Visit }>((state) => {
      const visit = state.visits[body.visitId];

      if (!visit) {
        return err({
          code: JanoErrorCode.VisitUnknown,
          visitId: body.visitId,
        });
      }

      if (!metrics.some((metric) => metric.key === body.metricKey)) {
        return err({
          code: JanoErrorCode.UnknownMetric,
          metricKey: body.metricKey,
        });
      }

      const reading: VisitReading = {
        date: toIsoDate(now()),
        diastolic: body.diastolic ?? null,
        metricKey: body.metricKey,
        systolic: body.systolic ?? null,
        value: body.value ?? null,
      };

      const transitioned = applyVisitEvent(visit, {
        at: now(),
        reading,
        type: 'RECORD_READING',
      });

      if (!transitioned.ok) {
        return transitioned;
      }

      return ok({
        next: {
          ...state,
          visits: { ...state.visits, [visit.id]: transitioned.value },
        },
        value: { visit: transitioned.value },
      });
    }),
  );

/**
 * Ends a visit.
 * @param body - Which visit to close.
 * @returns {{ visit: Visit }} - The completed visit.
 */
const checkOut = (body: { visitId: string }) =>
  unwrap(
    transact<{ visit: Visit }>((state) => {
      const visit = state.visits[body.visitId];

      if (!visit) {
        return err({
          code: JanoErrorCode.VisitUnknown,
          visitId: body.visitId,
        });
      }

      const transitioned = applyVisitEvent(visit, {
        at: now(),
        type: 'CHECK_OUT',
      });

      if (!transitioned.ok) {
        return transitioned;
      }

      return ok({
        next: {
          ...state,
          visits: { ...state.visits, [visit.id]: transitioned.value },
        },
        value: { visit: transitioned.value },
      });
    }),
  );

/**
 * Every reading the patient has had taken at a booth.
 * @param patientId - Whose readings to collect.
 * @param state - The current store state.
 * @returns {VisitReading[]} - The readings, in no particular order.
 */
const readingsForPatient = (
  patientId: string,
  state: StoreState,
): VisitReading[] =>
  Object.values(state.visits)
    .filter((visit) => visit.patientId === patientId)
    .flatMap((visit) => visit.readings);

const handlers = {
  [Endpoint.Book]: book,
  [Endpoint.Booths]: () => booths,
  [Endpoint.CheckIn]: checkIn,
  [Endpoint.CheckOut]: checkOut,
  [Endpoint.Farm]: (body: { patientId: string }): MetricSeries[] => {
    const recorded = readingsForPatient(body.patientId, getState());

    return metrics.map((metric) =>
      buildSeries(metric, seededHistory[metric.key] ?? [], recorded),
    );
  },
  [Endpoint.Pass]: (body: { visitId: string }) => {
    const state = getState();
    const visit = state.visits[body.visitId];
    const pass = visit
      ? Object.values(state.passes).find(
          (candidate) => candidate.bookingId === visit.bookingId,
        )
      : undefined;

    if (!visit || !pass) {
      throw new JanoError({
        code: JanoErrorCode.VisitUnknown,
        visitId: body.visitId,
      });
    }

    return {
      code: encodePass({
        bookingId: pass.bookingId,
        boothId: pass.boothId,
        expiresAt: pass.expiresAt,
        jti: pass.jti,
        patientId: pass.patientId,
      }),
      pass,
    };
  },
  [Endpoint.RecordReading]: recordReading,
  [Endpoint.Slots]: (body: { boothId: string }) =>
    slotsForBooth(body.boothId, getState()),
  [Endpoint.Visits]: (body: { patientId: string }) =>
    Object.values(getState().visits)
      .filter((visit) => visit.patientId === body.patientId)
      .sort((a, b) => b.scheduledFor - a.scheduledFor),
} as const;

export type MockHandlers = typeof handlers;

/**
 * Calls the mock backend, with the latency and the failure switch applied.
 * @param endpoint - Which endpoint to call.
 * @param body - The request body for that endpoint.
 * @returns {Promise<unknown>} - Whatever that handler returns.
 */
export const mockRequest = async <E extends keyof MockHandlers>(
  endpoint: E,
  body: Parameters<MockHandlers[E]>[0],
): Promise<ReturnType<MockHandlers[E]>> => {
  await ready();
  await delay();
  throwIfForced(endpoint as Endpoint);

  const handler = handlers[endpoint] as (
    input: unknown,
  ) => ReturnType<MockHandlers[E]>;

  return handler(body);
};

export { patient };
