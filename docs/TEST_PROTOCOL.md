# Unit Test Protocol

This document defines how unit tests are written across all our projects.
It applies to every codebase and team regardless of stack. Code examples
are illustrative — adapt the syntax, never the rules.

---

## 1. Test Case Categories

Every unit under test is covered by the following categories, in this order.
Each category is a nested `describe` block.

### 1.1 Security Cases

Test scenarios that demonstrate potential vulnerabilities or security
breaches. Scenarios include, but are not limited to: access rights (auth),
injection, and leaking secrets into responses, logs, or URLs.

### 1.2 Success Cases

Test scenarios that validate the correctness of the function's behavior in
typical scenarios.

> The test statement **must start with** `should successfully`.

### 1.3 Failure and Edge Cases

Test scenarios that identify potential errors or edge cases that may
arise. Scenarios include, but are not limited to: invalid/empty/boundary
input, dependency failures and timeouts, not-found and conflict paths, and
partial failure (rollback, no orphaned side effects).

> For failure cases, the test statement **must start with** `should fail`.

### 1.4 Performance Cases (if needed)

Only when the unit has a real performance contract. Scenarios include, but
are not limited to: rate limiting, query performance (no N+1), pagination
caps, caching, and timeouts.

---

## 2. Characteristics of a Good Unit Test

- **Fast:** runs in milliseconds.
- **Isolated:** standalone, with no dependency on infrastructure (file
  system, database, network) — those belong to integration tests.
- **Repeatable:** always returns the same result if nothing changed.
- **Self-checking:** detects pass/fail on its own, no human inspection.
- **Timely:** not disproportionately long to write compared to the code
  being tested — if it is, reconsider the design of the code.

> High code coverage does not imply high code quality — it only measures
> what is executed. Never chase a percentage.

---

## 3. Required Practices

### 3.1 Draft complete pseudocode before writing

Before writing any test code, draft the full list of test cases as a
pseudocode plan and keep it as a docblock above the `describe` block. The
plan is the checklist; the tests below implement it 1:1.

```text
/**
 * @see {@link login}
 *
 * security cases:
 * - should fail when the caller does not own the requested account
 *
 * success cases:
 * - should successfully return a session for valid credentials
 *
 * failure cases:
 * - should fail when the password is empty
 */
```

### 3.2 Structure tests with the AAA pattern

Every test body is organized as Arrange, Act, Assert — with the comments
written out:

```text
// Arrange: prepare inputs and mock the dependencies
// Act: call the unit under test
// Assert: verify the output and the dependency interactions
```

`// Act & Assert` may be combined only when asserting a thrown error.

### 3.3 Assert the expected result AND the dependency mock calls

Each test asserts both:

1. the **output** (return value, thrown error, rendered state), and
2. the **interaction** with mocked dependencies (`toHaveBeenCalledWith`,
   `not.toHaveBeenCalled`), when the interaction is part of the behavior.

### 3.4 Use types, enums, and named constants in tests

Test data uses the same types, enums, and constants as production code. No
magic strings — assign hard-coded values to named constants that express
intent. Use the simplest input that proves the behavior (minimally passing
tests). Shared fixtures live in one module per project.

### 3.5 Follow test naming standards (BDD style)

The name of a test consists of three parts: the method being tested, the
scenario under which it is tested, and the expected behavior when the
scenario is invoked. The method comes from the enclosing `describe`; the
test statement itself carries the scenario and expectation:

- Start test names with `should` — `it('should ...')`.
- State context and expectations together: combine the action, condition,
  and expected result, e.g.
  `it('should fail when the password is empty')`.

Names matter because tests are documentation: reading the suite should
reveal the behavior of the code without reading the code itself, and a
failing test should say exactly which scenario broke.

### 3.6 Group logically

Use nested `describe` blocks to organize by method names or distinct
operational contexts:

```
describe(unit)
  describe(method / context)
    describe('security cases')
    describe('success cases')
    describe('failure cases')
```

### 3.7 One Act per test, no logic in tests

Each test performs a single Act. No `if`, loops, or string building inside
tests — split into separate tests or use parameterized tests instead. With
one Act you always know which case failed and why; with several, the first
failed assert stops the test and hides whether the rest actually work.

### 3.8 Prefer helper methods over Setup/Teardown

Prefer helper/factory methods over shared Setup/Teardown state: everything
a test needs is visible inside it, and nothing is over-prepared or shared
between tests.

---

## 4. Focus on Behavior, Not Implementation

- **Test what your code does** (inputs and outputs), not how it completes
  the task.
- **Avoid private methods:** do not explicitly target private functions or
  internal states — validate them through the public method that uses them.
- **Keep refactoring safe:** if you rewrite the internal logic of a function
  but the output remains identical, your unit tests must still pass without
  changes.
- **Omit internal logic from tests:** do not copy business calculations or
  complex conditionals into your assertions. Use fixed, hardcoded
  expectations:

  ```ts
  // ❌ re-implements production logic
  expect(result.total).toBe(price * quantity * (1 + VAT_RATE));

  // ✅ fixed expectation
  expect(result.total).toBe(121);
  ```

- **Control non-determinism:** the test must have full control of the unit.
  Wrap static references such as the current time or randomness behind an
  injectable dependency (a seam) so tests can stub them.
- **Independence:** each test is independent and does not rely on the
  results or ordering of other tests. Reset all mocks and state between
  tests, and never share mutable state across tests.

---

## 5. Example Test File (Jest)

```ts
/**
 * @fileoverview Tests for AuthService.login
 * @see {@link ./authService.ts}
 */

import { login } from './authService';
import { apiClient } from './apiClient';
import { Endpoint } from './endpoints';
import { sessionStorage } from './sessionStorage';
import type { Session } from './authService';

jest.mock('./apiClient', () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock('./sessionStorage', () => ({
  sessionStorage: { save: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;
const mockSave = sessionStorage.save as jest.Mock;

const VALID_EMAIL = 'user@example.com';
const VALID_PASSWORD = 'correct-horse-battery';
const mockSession: Session = { token: 'session-token-abc', userId: 42 };

/**
 * @see {@link login}
 *
 * security cases:
 * - should not persist a session when authentication fails
 *
 * success cases:
 * - should successfully return a session for valid credentials
 *
 * failure cases:
 * - should fail when the password is empty
 */
describe('AuthService', () => {
  describe('login', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('security cases', () => {
      it('should not persist a session when authentication fails', async () => {
        // Arrange
        mockPost.mockRejectedValue(new Error('Unauthorized'));

        // Act
        await expect(login(VALID_EMAIL, VALID_PASSWORD)).rejects.toThrow();

        // Assert
        expect(mockSave).not.toHaveBeenCalled();
      });
    });

    describe('success cases', () => {
      it('should successfully return a session for valid credentials', async () => {
        // Arrange
        mockPost.mockResolvedValue(mockSession);

        // Act
        const session = await login(VALID_EMAIL, VALID_PASSWORD);

        // Assert — output AND dependency interaction
        expect(session).toEqual(mockSession);
        expect(mockPost).toHaveBeenCalledWith(Endpoint.Login, {
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
        });
      });
    });

    describe('failure cases', () => {
      it('should fail when the password is empty', async () => {
        // Act & Assert
        await expect(login(VALID_EMAIL, '')).rejects.toThrow(
          'Password is required',
        );

        expect(mockPost).not.toHaveBeenCalled();
      });
    });
  });
});
```

For UI components the same protocol applies; only the Act step changes —
render the component through the project's test helpers and interact the
way a user would. Assert what is rendered/visible after the interaction,
not which internal functions were called.

---

## References

- [Best practices for writing unit tests — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
