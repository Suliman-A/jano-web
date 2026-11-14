# Jano — patient prototype

A working prototype of the patient side of one Jano visit: book a slot at a
medical booth (a "Temple"), carry a QR check-in pass, have the booth accept it
and take measurements, and watch the visit land in Consultation History and the
new readings appear on the Farm.

**Live:** https://suliman-a.github.io/jano-web/

## What it does

1. **Temple** — find a booth by area or by the care it offers, on a map or in
   a list, and book a 30-minute slot.
2. **Pass** — a QR check-in pass, pinned to the top of the Temple tab so it is
   reachable from the front of the app.
3. **Booth simulator** — a stand-in for the physical booth. There is no real
   hardware to demo against, so this screen plays the booth's part: it accepts
   or refuses the pass, records readings, and checks the patient out.
4. **Farm and history** — the visit appears in Consultation History and the new
   readings appear on the Farm, **with no manual refresh**.

## Running it

```bash
npm install
npm run dev
```

It is a static build with no backend, so `npm run build` produces a `dist/`
that can be dropped on any static host. Paths are relative and routing is
hash-based, so it works from a subdirectory too.

### Tests

```bash
npm test
```

Also `npm run tscheck` for types.

## Walking the demo

1. Open **Temple**, pick a booth, choose a time, and tap **Book this visit**.
   The pass appears.
2. Go back to Temple and tap **Open the Booth simulator**.
3. Tap **Simulate scanning the patient's QR**, then **Accept pass and check
   in**. The simulator has already selected the booth the pass is for.
4. Tap **Record readings and check out**.
5. Open **Farm** — the new readings are already there. Tap a flower for its
   card. Open **Me → Consultation History** — the visit is already listed.

To see a pass refused, tap **Accept pass and check in** a second time with the
same code, or switch the simulator to a different booth before scanning.

## Main decisions and assumptions

1. **`src/core` has no framework imports.** Everything more than one feature
   depends on — the pass format, the visit state machine, range status — lives
   there as plain TypeScript. That is what lets its tests run in milliseconds
   with no renderer, and it is the part that would survive a move to another
   platform untouched.
2. **Sample data only, behind one swap seam.** Every screen calls `request()`
   in [`src/api/client.ts`](src/api/client.ts). Today it routes to a mock
   backend with a ~300 ms delay; replacing it with HTTP is a one-file change.
   `httpRequest` is present as a stub that throws, so the swap point is
   obvious.
3. **One patient, no auth.** The sample data has one — `pt_demo_001`, Sophia
   Alvarez.
4. **Flowers are emoji**, which the brief explicitly allows.
5. **Booking and Visit are created together**, at booking time. That makes the
   state machine total: "check out before check in" is a plain illegal
   transition rather than a missing record to guess about.
6. **The bottom bar departs from the brief's wording in one place.** The brief
   describes Farm as "larger, raised and centred". Here all four circles are
   the same size and only the fill changes, because resizing on tap made the
   row jump under the finger. The non-standard positions the interaction is
   really about — Me bottom-left, Farm and Temple paired in the middle, Jano
   bottom-right — are unchanged.
7. **The map is drawn by hand** and says so. See "Why the map is illustrative"
   below.
8. **No signature on the QR.** See "What is inside the QR code" below.
9. **Timestamps are epoch milliseconds, never `Date` objects.** State is
   persisted as JSON, and a `Date` comes back out of `JSON.parse` as a string.
10. **Slots are generated, not stored.** Each booth's hours produce 30-minute
    slots for three days; roughly one in five is marked taken, derived from a
    hash of the slot id so it stays the same across reloads.
11. **The booth simulator is styled as an operator console**, not as patient
    UI, so a reviewer is never unsure which side they are looking at. It starts
    on the booth the waiting pass was issued for, and warns you when a booth
    you pick yourself will refuse the scan.
12. **Check-in opens two hours before the slot**, where a real booth would use
    about fifteen minutes. The prototype cannot travel in time, so a tight
    window would make the flow impossible to demonstrate without waiting. The
    rule is unchanged and still tested from both sides — see `CHECK_IN_LEAD_MS`
    in [`src/core/visitMachine.ts`](src/core/visitMachine.ts).
13. **Hash routing.** The build is static, so a hash route needs no server
    rewrite rule and reloading on `/temple` cannot 404 wherever it is hosted.

### How the patient app updates without a refresh

There is no query cache and nothing to invalidate. The store in
[`src/api/mock/store.ts`](src/api/mock/store.ts) holds one state object,
**replaces** it rather than mutating it, and notifies its subscribers. Every
screen loads through `useQueryOnce`
([`src/hooks/useQueryOnce.ts`](src/hooks/useQueryOnce.ts)), which subscribes to
the store on mount and refetches when it fires, so when the simulator checks a
patient out, every mounted screen reloads on its own.

That is the shape a real push channel has: swapping in a WebSocket replaces
`subscribe` and nothing else.

### Why the map is illustrative

The reference screen labels its own map "Illustrative map", and this one is
labelled the same because it is one: a linear lat/lng → x/y projection with
absolutely positioned pins over a plain panel
([`src/features/temple/BoothMap.tsx`](src/features/temple/BoothMap.tsx)).

Over the few kilometres of Metro Manila the sample data covers, a linear
projection is visually indistinguishable from a proper one, and it needs no
API key, no network and no map licence — none of which a prototype should
spend on a panel that is never panned. One booth in the sample data has
`lat: null`; it is not drawn, and the list says "Location coming soon" rather
than putting it at the equator.

## The two questions

### 1. Where is a pass rejected, and for which reasons?

In two places, deliberately.

**Offline, from the code alone** — `verifyPass`,
[`src/core/pass.ts:94`](src/core/pass.ts#L94), which leans on `decodePass`,
[`src/core/pass.ts:50`](src/core/pass.ts#L50). A booth on poor mobile data can
still refuse a pass without reaching a server:

| Reason                                                                       | Where                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `PASS_MALFORMED` — not a Jano pass, truncated, or an empty/non-numeric field | `decodePass`, [`:54`](src/core/pass.ts#L54), [`:61`](src/core/pass.ts#L61), [`:71`](src/core/pass.ts#L71) |
| `PASS_BAD_VERSION` — a format this booth does not understand                 | `decodePass`, [`:65`](src/core/pass.ts#L65)                                                               |
| `PASS_EXPIRED` — past the end of its slot                                    | `verifyPass`, [`:108`](src/core/pass.ts#L108)                                                             |
| `PASS_WRONG_BOOTH` — issued for a different Temple                           | `verifyPass`, [`:116`](src/core/pass.ts#L116)                                                             |

**Against the store** — `checkIn`,
[`src/api/mock/backend.ts:208`](src/api/mock/backend.ts#L208):

| Reason                                                                    | Where                                                                                                                                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PASS_UNKNOWN` — no such pass on record                                   | [`:228`](src/api/mock/backend.ts#L228)                                                                                                                            |
| `PASS_USED` — scanned once already                                        | [`:235`](src/api/mock/backend.ts#L235)                                                                                                                            |
| `PASS_WRONG_PATIENT` — the code names someone other than the booking      | [`:245`](src/api/mock/backend.ts#L245)                                                                                                                            |
| `BOOTH_UNAVAILABLE` — the booth is in maintenance                         | [`:258`](src/api/mock/backend.ts#L258)                                                                                                                            |
| `ILLEGAL_TRANSITION`, `CHECK_IN_WINDOW_CLOSED` — the visit itself refuses | `applyVisitEvent`, [`src/core/visitMachine.ts:77`](src/core/visitMachine.ts#L77) ([`:85`](src/core/visitMachine.ts#L85), [`:105`](src/core/visitMachine.ts#L105)) |

Every code is in `JanoErrorCode`,
[`src/core/errors.ts:9`](src/core/errors.ts#L9).

**The order matters, and is tested.** The booth check runs before any store
lookup, so a wrong-booth scan is refused offline. The already-used check runs
before the state machine, so a second scan reports _already used_ rather than
_illegal transition_ — both refuse the scan, but only one tells the patient
something true. See
[`src/api/__tests__/checkIn.test.ts`](src/api/__tests__/checkIn.test.ts),
"should fail as already-used rather than illegal-transition on a re-scan".

### 2. What is inside the QR code, and why?

A readable, dot-separated string. The fields are `PassPayload`,
[`src/core/types.ts:103`](src/core/types.ts#L103); the grammar is documented at
[`src/core/pass.ts:1`](src/core/pass.ts#L1) and built by `encodePass`,
[`src/core/pass.ts:30`](src/core/pass.ts#L30):

```
jano.1.bkg_7fa2.bth_ayala.pt_demo_001.jti_4d9c1e.1763131200000
```

| Field           | Why it is there                                         |
| --------------- | ------------------------------------------------------- |
| `jano`          | a scanner can tell this is a Jano pass at all           |
| `1`             | the format can change later without breaking old booths |
| booking id      | ties the scan back to the reservation                   |
| **booth id**    | lets the booth refuse a wrong scan with no network      |
| patient id      | opaque — **no name, no readings, nothing clinical**     |
| **one-time id** | this is what gets marked used on the first scan         |
| expiry          | a photographed QR dies with the slot                    |

**Why structured rather than one opaque random token.** An opaque token would
be simpler and, strictly, more private. The structured payload earns its place
because the booth is the offline party: it should be able to say "this is not
for this Temple" and "this expired" from the code alone. Single-use cannot work
that way — you cannot tell from the characters whether a code was already
scanned — so the design forces an honest split between what is decided offline
and the one thing that needs the store.

**Why no signature.** Neither graded rejection needs one: already-used is a
store lookup and wrong-booth is a field comparison. A checksum would have meant
a crypto dependency and a paragraph of caveats for no real protection, because
the key would ship in the JavaScript bundle. It is listed under "what I'd do
next" instead.

**Why no name in the payload.** A QR on a phone screen is photographable and
shoulder-surfable. The booth resolves the patient id to a name over its own
authenticated channel. There is a test for this:
[`src/core/__tests__/pass.test.ts`](src/core/__tests__/pass.test.ts), "should
successfully omit the patient name from the encoded pass".

## The bugs in `rangeStatus`

The file was committed exactly as received so the fixes are visible as a diff —
see the commit _chore: add provided sample data and rangeStatus_, then _fix:
correct seven defects in rangeStatus_. Seven behavioural defects, plus the root
cause:

1. **Empty history threw.** `history[history.length - 1]` is `undefined`, so
   reading `.systolic` is a `TypeError`. `body_fat` ships with `history: []`, so
   the Farm crashed on real data from the sample file.
2. **A metric with no typical range reported "in".** It told the patient their
   weight was inside a range that does not exist. It is `none` now — "cannot
   say", not "fine".
3. **A failed measurement reported "below".** Weight is `null` on 2026-09-17;
   `null < 60` coerces to `0 < 60`, so a measurement the booth could not take
   read as a dangerously low one.
4. **The diastolic bound was never checked.** `typical.diastolicBelow` is in the
   data and went unused, so 118/95 read as "in typical range" — the diastolic
   alone is hypertensive.
5. **The systolic bound was off by one.** `systolicBelow: 120` means _below_
   120, but `<=` counted exactly 120 as in range.
6. **`if (latest.systolic)` was a truthiness test.** A `0` or absent systolic
   fell through into the single-value branch and compared `undefined` against a
   blood-pressure range.
7. **The latest reading was taken by array position.** The function trusted
   array order instead of picking by date.
8. _(root cause)_ The `!` non-null assertions are what let 1–6 past the type
   checker. The rewrite narrows with type predicates instead and has no
   assertions left.

Fixed in [`src/core/rangeStatus.ts`](src/core/rangeStatus.ts), covered by
[`src/core/__tests__/rangeStatus.test.ts`](src/core/__tests__/rangeStatus.test.ts),
and used by the real Farm card so it is live code rather than an orphan file.
Reverting the file to the original turns 10 of its 16 tests red.

## Testing

`npm test` — 93 tests, all behavioural. They follow the unit-test protocol in
[`docs/TEST_PROTOCOL.md`](docs/TEST_PROTOCOL.md): a pseudocode plan above each
suite, `describe(unit) > describe(method) > describe(category)`, security cases
first, `should successfully` / `should fail` naming, and Arrange/Act/Assert in
every body.

They were checked by breaking the code on purpose: reverting `rangeStatus.ts`
to the original turns 10 of its 16 tests red, and disabling the wrong-booth
check in `verifyPass` turns 3 more red across the pass and check-in suites.

Three things keep them honest:

- **Assert the specific error code**, never just "it rejected". Half of these
  failures are reachable by two different code paths.
- **No `Date.now()` in `src/core/`.** The clock is injected, so window logic
  that is an hour out cannot pass at midday and fail at 23:45.
- **`resetStore()` in a global `beforeEach`.** Vitest's `restoreMocks` does not
  reach module-level state.

The end-to-end test
([`src/__tests__/visitLifecycle.e2e.test.ts`](src/__tests__/visitLifecycle.e2e.test.ts))
is the only one that proves the no-refresh behaviour: it mounts two fake patient
screens that reload _only_ when the store notifies them, drives the whole visit
through the booth, and asserts the screens updated on their own.

Every `file:line` reference in this README is checked by
[`scripts/check-doc-links.mjs`](scripts/check-doc-links.mjs), which fails if a
line has moved. Run it with `npm run check:docs`.

## What I cut

- **Camera QR scanning.** The simulator has a paste field and a "simulate
  scanning" button instead. Pointing a laptop camera at the same screen that is
  showing the QR is not a demo, and a phone browser cannot see its own display
  either.
- **A signature on the pass** — see above.
- **Prescriptions, Patient Profile, Digitize, Settings.** The Me menu lists all
  five items as the reference screens do; only Consultation History works, and
  the other four are disabled rather than looking live and doing nothing.
- **The Jano assistant**, which is a placeholder.
- **Cancelling a booking.** The rule exists and is tested in the state machine,
  but no screen calls it.
- **i18n and custom fonts**, to keep the dependency list and the build short.

## What I'd do next

- **Sign the pass server-side** and shorten its life to minutes, consume the
  one-time id under a database unique constraint, and rotate the displayed code
  every ~30 seconds so a screenshot is useless.
- **Carry only the one-time id** in the payload once there is a backend to
  resolve the rest.
- **Real slot availability** instead of a hash, and holding a slot while the
  patient is choosing.
- **A real map** once there is a reason to pan one.
- **Component tests** for the three custom interactions. The logic is covered;
  the rendering is not.
- **A booth going into maintenance mid-booking** — the rule is there and
  tested, but the patient is never told.
