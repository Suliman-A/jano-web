/**
 * @fileoverview How a rules-layer failure crosses the API boundary.
 */

import { failureMessage, type JanoFailure } from '@/core/errors';

/**
 * The error every screen catches. It keeps the structured failure so the booth
 * screen can branch on a code rather than on a sentence.
 */
export class JanoError extends Error {
  readonly failure: JanoFailure;

  constructor(failure: JanoFailure) {
    super(failureMessage(failure));
    this.name = 'JanoError';
    this.failure = failure;
  }
}
