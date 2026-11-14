# How AI was used

## Tools

**Claude Code** (Opus), for the whole build: planning, code, tests and docs.
No other AI tooling.

## Roughly how much of the code it wrote

Most of the typing — call it 85–90% of the lines. Close to none of the
decisions. The plan was argued out before any code existed, and the shape of
the thing (what goes in `src/core/`, the order of the pass checks, no state
library, what the QR carries) came out of that argument rather than out of the
model's first suggestion.

Doing it this way is faster at producing plausible code and _slower_ at
producing correct code, because the plausible version arrives first and has to
be read properly before it is kept.

## Where I corrected or rejected what it gave me

### 1. A test that passed for the wrong reason

It wrote a check-in test called "should fail when the booth is closed for
maintenance" whose assertion was `PASS_UNKNOWN` — because a booth in
maintenance cannot be booked, so no pass for it ever exists, so the call failed
earlier for a completely different reason. The test was green and the name was
a lie.

Rejected and rewritten: the test now writes a booking, visit and unused pass
into the store through its normal commit path, so the maintenance rule is the
only thing that can refuse the scan. See
`src/api/__tests__/checkIn.test.ts`, "should fail when the booth went into
maintenance after the booking".

This is the failure mode worth watching with generated tests — they are written
to pass, not to discriminate.

### 2. Reaching for libraries the job did not need

The first plan had TanStack Query for data and a component kit for the UI.
Neither earned its place: the data is local, so the store already _is_ the
cache, and the "no manual refresh" requirement turned into
emitter-to-`invalidateQueries` plumbing that a plain store subscription does
for free. The kit would have had to be fought anyway, because all three custom
interactions are specified down to which circle is filled.

The same went for a QR signature — it was in the design until it became clear
nothing in the brief needed one, and that the key would have shipped in the
bundle anyway.

### 3. `rangeStatus` fixes that papered over the type errors

Asked to fix the provided file, the first attempt kept the `!` non-null
assertions and added `?? 0` in a couple of places. That silences the type
checker and preserves the bug: a `null` weight becomes `0`, which is still
"below range" — exactly the defect being fixed.

Rewritten to narrow properly, to pick the latest reading by _date_ rather than
array position, and to return `none` — "I cannot say" — instead of guessing.
Reverting the file to the original now turns 10 of its 16 tests red, which is
the actual check that the fixes mean something.

Even the rewrite needed a second pass. It filtered for readings that carry a
usable number, but the filter's guard returned a plain boolean, so the result
came back as the wide type and two `!` assertions crept back in to read the
number that had just been filtered for. The guard is a type predicate now and
the file has none left — which matters, because those assertions are the thing
that let the original seven defects past the compiler in the first place.

### 4. A hook that returned a cleanup function from the wrong place

A generated `useQueryOnce` returned its cancellation cleanup out of a
`useCallback` and cast the result to make TypeScript stop complaining. It
typechecked and would have leaked a stale `setState` on every unmount.
Replaced with a plain effect keyed on a counter.

### 5. Documentation that was true when it was written

The README answers two questions with line references, and line references rot
the moment anything above them moves — silently, because nothing compiles a
README. An early draft of this one pointed at a hook that no screen imported
and credited it with the no-refresh behaviour that a different file actually
provides.

The fix was not to re-read the prose more carefully. `scripts/check-doc-links.mjs`
now walks every reference in the README, checks the line still says what the
link claims, and fails `npm test` if it does not. The orphan hook was deleted
rather than described.

## What AI was genuinely good at

Mechanical breadth: writing six screens' worth of CSS modules from a described
layout, filling out a test suite once the first few cases set the pattern, and
keeping JSDoc consistent across forty files. That is the work that would
otherwise have eaten the time budget, and it is also the work where a mistake
is cheap and visible.
