/**
 * @fileoverview Checks every file and line reference in the README.
 *
 * Line references rot silently: a line is inserted three files away and a
 * table in the readme starts pointing at a blank line, with nothing to catch
 * it. This walks every `path#Lnn` link and every `` `path:nn` `` mention,
 * checks the file exists, and checks the line it names still contains what the
 * link claims it does.
 *
 * Expectations are declared below rather than inferred, so a line that moves
 * to the right place passes and a line that changes meaning does not.
 *
 * Run with `npm run check:docs`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What the line at each reference has to contain. A reference the README makes
 * that is not listed here is reported, so the two cannot drift apart.
 */
const EXPECTATIONS = {
  'src/api/mock/backend.ts': {
    207: 'const checkIn',
    227: 'PassUnknown',
    234: 'PassUsed',
    244: 'PassWrongPatient',
    257: 'BoothUnavailable',
  },
  'src/core/errors.ts': {
    9: 'enum JanoErrorCode',
  },
  'src/core/pass.ts': {
    1: '/**',
    30: 'export const encodePass',
    50: 'export const decodePass',
    54: 'PassMalformed',
    61: 'PassMalformed',
    65: 'PassBadVersion',
    71: 'PassMalformed',
    94: 'export const verifyPass',
    108: 'PassExpired',
    116: 'PassWrongBooth',
  },
  'src/core/types.ts': {
    100: 'export type PassPayload',
  },
  'src/core/visitMachine.ts': {
    50: 'export const applyVisitEvent',
    58: 'IllegalTransition',
    67: 'PassWrongBooth',
  },
};

const readme = readFileSync(join(root, 'README.md'), 'utf8');

/** Every `](path)` or `](path#Lnn)` link, and every `` `path:nn` `` mention. */
const LINK = /\]\((src\/[^)\s#]+)(?:#L(\d+))?\)/g;
const MENTION = /`(src\/[^`\s:]+):(\d+)`/g;

const problems = [];
const seen = new Set();

/**
 * Checks one reference.
 * @param file - The repo-relative path the README names.
 * @param line - The line number, if the reference gives one.
 */
const check = (file, line) => {
  let source;

  try {
    source = readFileSync(join(root, file), 'utf8');
  } catch {
    problems.push(`${file} — no such file`);

    return;
  }

  if (!line) {
    return;
  }

  seen.add(`${file}:${line}`);

  const text = source.split('\n')[line - 1];

  if (text === undefined) {
    problems.push(`${file}:${line} — past the end of the file`);

    return;
  }

  const expected = EXPECTATIONS[file]?.[line];

  if (!expected) {
    problems.push(
      `${file}:${line} — referenced by the readme but not in EXPECTATIONS`,
    );

    return;
  }

  if (!text.includes(expected)) {
    problems.push(
      `${file}:${line} — expected ${JSON.stringify(expected)}, found ${JSON.stringify(text.trim())}`,
    );
  }
};

for (const [, file, line] of readme.matchAll(LINK)) {
  check(file, line ? Number(line) : null);
}

for (const [, file, line] of readme.matchAll(MENTION)) {
  check(file, Number(line));
}

for (const [file, lines] of Object.entries(EXPECTATIONS)) {
  for (const line of Object.keys(lines)) {
    if (!seen.has(`${file}:${line}`)) {
      problems.push(
        `${file}:${line} — in EXPECTATIONS but the readme dropped it`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Stale references in README.md:\n');

  for (const problem of problems) {
    console.error(`  ${problem}`);
  }

  process.exit(1);
}

console.log(`README references check out (${seen.size} lines verified).`);
