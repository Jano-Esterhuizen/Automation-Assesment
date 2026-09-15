import { expect, test } from '../fixtures/pages';
import { USERS } from '../fixtures/users';

/**
 * Known defects - see TEST-CASES.md, "Injected faults & defects".
 *
 * Defects in the application itself, as opposed to the injected faults carried
 * by `problem_user` (covered by the paired blocks in sorting.spec.ts and
 * checkout.spec.ts). An injected fault is deliberate and will never be fixed,
 * so its inverted test is a check on this suite; a defect is a real gap
 * reproducible on standard_user, so its inverted test is a bug ticket.
 *
 * test.fail() inverts the pass condition: the test asserts CORRECT behaviour,
 * fails while the defect exists, and the run stays green. Rewriting it to
 * assert the broken behaviour would cement the defect as expected.
 */
test.describe('Known defects', () => {
  test.fail(
    'TC-BUG-03 | expected fail: an order can be completed with an empty cart',
    async ({ loginPage, cartPage }) => {
      test.info().annotations.push({
        type: 'defect',
        description:
          'No business rule prevents a zero-item order: checkout proceeds from an empty cart ' +
          'all the way to "Thank you for your order!". Affects standard_user, not just the ' +
          'special accounts.',
      });

      await loginPage.signIn(USERS.standard);
      await cartPage.goto();
      await expect(cartPage.cartItems).toHaveCount(0);

      // Expected: an empty cart must not be able to start checkout.
      //
      // Asserted at the gate rather than by walking the flow and checking the
      // confirmation never appears. toBeHidden() is also satisfied by an
      // ABSENT element, so mid-navigation it passes against a half-built page
      // and the test succeeds for the wrong reason - retrying assertions retry
      // until they PASS, not until the page is stable.
      //
      // Waiting for the confirmation URL would fix that race but hide a future
      // fix: the app would then not navigate, the wait would time out, and
      // test.fail() would report that as GREEN. A disabled button on an
      // already-rendered page has neither problem.
      await expect(cartPage.checkoutButton).toBeDisabled();
    },
  );
});
