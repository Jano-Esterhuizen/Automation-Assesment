import { expect, test } from '../fixtures/pages';
import { formatPrice } from '../fixtures/money';
import { PRODUCT_COUNT, USERS } from '../fixtures/users';
import { SORT_LABELS } from '../pages/InventoryPage';

/**
 * Product sorting tests - see TEST-CASES.md, "Product sorting".
 *
 * Pattern throughout: read the rendered values, sort a copy in the test, then
 * assert the page matches with a retrying assertion. That avoids hardcoding
 * the catalogue, and the retry absorbs React's re-render after the dropdown
 * changes - so no wait is needed.
 *
 * Not circular: the ordering rule is applied by independent code here, so a
 * wrong order on the page fails the assertion.
 */
test.describe('Product sorting', () => {
  test.beforeEach(async ({ loginPage, inventoryPage }) => {
    await loginPage.signIn(USERS.standard);
    // The read helpers below are one-shot and do not auto-wait, so gate them
    // behind a retrying assertion that the list has finished rendering.
    await expect(inventoryPage.products).toHaveCount(PRODUCT_COUNT);
  });

  test('TC-SORT-01 | default sort is Name (A to Z)', async ({ inventoryPage }) => {
    // Nothing is changed: this verifies the default state.
    await expect(inventoryPage.activeSortLabel).toHaveText(SORT_LABELS.az);

    const names = await inventoryPage.getProductNames();
    const ascending = [...names].sort((a, b) => a.localeCompare(b));

    await expect(inventoryPage.productNames).toHaveText(ascending);
  });

  // TC-SORT-02 lives in the paired block at the foot of this file, where it
  // runs against standard_user and problem_user from one shared body.

  test('TC-SORT-03 | Price (low to high) orders by numeric value', async ({ inventoryPage }) => {
    const prices = await inventoryPage.getProductPrices();
    const ascending = [...prices].sort((a, b) => a - b).map(formatPrice);

    await inventoryPage.sortBy('lohi');

    await expect(inventoryPage.activeSortLabel).toHaveText(SORT_LABELS.lohi);

    // Prices are asserted, never a derived product order: two products cost
    // exactly $15.99, so their order relative to each other is not defined by
    // price and asserting it would be non-deterministic.
    await expect(inventoryPage.productPrices).toHaveText(ascending);

    // Stated explicitly because it is the bug this case exists to catch: a
    // string sort would place "$9.99" after "$49.99".
    await expect(inventoryPage.productPrices.first()).toHaveText(
      formatPrice(Math.min(...prices)),
    );
  });

  test('TC-SORT-04 | Price (high to low) orders by numeric value', async ({ inventoryPage }) => {
    const prices = await inventoryPage.getProductPrices();
    const descending = [...prices].sort((a, b) => b - a).map(formatPrice);

    await inventoryPage.sortBy('hilo');

    await expect(inventoryPage.activeSortLabel).toHaveText(SORT_LABELS.hilo);
    await expect(inventoryPage.productPrices).toHaveText(descending);
    await expect(inventoryPage.productPrices.first()).toHaveText(
      formatPrice(Math.max(...prices)),
    );
  });
});

/**
 * TC-SORT-02 / TC-BUG-01 - the same test run against a working build and a
 * deliberately broken one.
 *
 * `problem_user` is not a bug report: Sauce Labs ships it broken on purpose and
 * will never fix it, which makes it a known-broken build to measure against.
 * One body, one set of assertions, the account is the only difference:
 *
 *   - standard_user must PASS -> the assertions work on a correct build.
 *   - problem_user must FAIL  -> the assertions actually detect the fault.
 *
 * Weaken them enough to pass against the broken build and test.fail() inverts
 * that run, turning the suite RED. The expected failure is the evidence that
 * the passing test is not vacuous.
 */
const NAME_SORT_ACCOUNTS = [
  { id: 'TC-SORT-02', label: 'standard_user', username: USERS.standard, faultInjected: false },
  { id: 'TC-BUG-01', label: 'problem_user', username: USERS.problem, faultInjected: true },
] as const;

test.describe('Product sorting - Name (Z to A): working build vs broken build', () => {
  for (const account of NAME_SORT_ACCOUNTS) {
    // Marker early in the title, not at the end: only the terminal marks an
    // expected failure distinctly, and other views truncate from the right.
    const inverted = account.faultInjected ? 'expected fail: ' : '';

    test(`${account.id} | ${inverted}Name (Z to A) reorders the list - ${account.label}`, async ({
      loginPage,
      inventoryPage,
    }) => {
      if (account.faultInjected) {
        // Inverts the pass condition - see the block comment above.
        test.fail();
        test.info().annotations.push({
          type: 'injected fault',
          description:
            'problem_user: the sort <select> value changes but the list never reorders and ' +
            'the displayed label stays on "Name (A to Z)". Silent failure - no error is shown.',
        });
      }

      await loginPage.signIn(account.username);
      // The read helper below is one-shot and does not auto-wait, so gate it
      // behind a retrying assertion that the list has finished rendering.
      await expect(inventoryPage.products).toHaveCount(PRODUCT_COUNT);

      const names = await inventoryPage.getProductNames();
      const descending = [...names].sort((a, b) => b.localeCompare(a));

      await inventoryPage.sortBy('za');

      await expect(inventoryPage.activeSortLabel).toHaveText(SORT_LABELS.za);
      await expect(inventoryPage.productNames).toHaveText(descending);
      // Sorting must reorder the catalogue, not lose or duplicate any of it.
      await expect(inventoryPage.products).toHaveCount(PRODUCT_COUNT);
    });
  }
});
