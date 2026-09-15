import { expect, test } from '../fixtures/pages';
import { formatPrice } from '../fixtures/money';
import { CHECKOUT_DETAILS, PRODUCTS, TAX_RATE, USERS } from '../fixtures/users';

/** Checkout tests - see TEST-CASES.md, "Checkout". */
test.describe('Checkout', () => {
  test.beforeEach(async ({ loginPage, inventoryPage }) => {
    await loginPage.signIn(USERS.standard);
    await expect(inventoryPage.pageHeading).toHaveText('Products');
  });

  test('TC-CHK-01 | happy path: complete an order end to end', async ({
    page,
    inventoryPage,
    cartPage,
    checkoutInfoPage,
    checkoutOverviewPage,
    checkoutCompletePage,
  }) => {
    const ordered = [PRODUCTS.backpack, PRODUCTS.fleeceJacket];

    await inventoryPage.addAllToCart(ordered);
    await inventoryPage.openCart();
    await cartPage.checkout();

    await expect(page).toHaveURL(/checkout-step-one\.html/);
    await checkoutInfoPage.fillDetails(CHECKOUT_DETAILS);
    await checkoutInfoPage.continue();

    // The order must still contain what the customer chose - this is the step
    // where a cart-to-order mapping bug would show up.
    await expect(page).toHaveURL(/checkout-step-two\.html/);
    await expect(checkoutOverviewPage.lineItems).toHaveCount(ordered.length);
    for (const product of ordered) {
      await expect(checkoutOverviewPage.itemNames.filter({ hasText: product })).toBeVisible();
    }

    await checkoutOverviewPage.finish();

    await expect(page).toHaveURL(/checkout-complete\.html/);
    await expect(checkoutCompletePage.confirmationHeader).toHaveText('Thank you for your order!');
    await expect(checkoutCompletePage.confirmationText).toHaveText(
      'Your order has been dispatched, and will arrive just as fast as the pony can get there!',
    );
    // The basket is emptied once the order is placed.
    await expect(checkoutCompletePage.cartBadge).toHaveCount(0);
  });

  test('TC-CHK-02 | order summary arithmetic is correct', async ({
    inventoryPage,
    cartPage,
    checkoutInfoPage,
    checkoutOverviewPage,
  }) => {
    const ordered = [PRODUCTS.backpack, PRODUCTS.bikeLight];

    await inventoryPage.addAllToCart(ordered);
    await inventoryPage.openCart();
    await cartPage.checkout();
    await checkoutInfoPage.fillDetails(CHECKOUT_DETAILS);
    await checkoutInfoPage.continue();

    // Gate the one-shot reads below behind a retrying assertion, so nothing is
    // read before the summary has rendered.
    await expect(checkoutOverviewPage.lineItems).toHaveCount(ordered.length);

    const lineItemTotal = await checkoutOverviewPage.getLineItemTotal();

    // Web-first: the displayed subtotal must equal the sum of the line items.
    await expect(checkoutOverviewPage.subtotalLabel).toHaveText(
      `Item total: ${formatPrice(lineItemTotal)}`,
    );

    const subtotal = await checkoutOverviewPage.getSubtotal();
    const tax = await checkoutOverviewPage.getTax();
    const total = await checkoutOverviewPage.getTotal();

    // Asserted as relationships between the displayed values rather than
    // against hardcoded amounts, so the case stays valid if prices change.
    // toBeCloseTo, not toBe: the app rounds tax to 2 decimals, and comparing
    // raw floating-point currency with === is a classic false failure.
    expect(subtotal).toBeCloseTo(lineItemTotal, 2);
    expect(tax).toBeCloseTo(subtotal * TAX_RATE, 2);
    expect(total).toBeCloseTo(subtotal + tax, 2);

    // And the grand total as the user actually sees it.
    await expect(checkoutOverviewPage.totalLabel).toHaveText(
      `Total: ${formatPrice(subtotal + tax)}`,
    );
  });

  test('TC-CHK-06 | Cancel returns to the cart with items intact', async ({
    page,
    inventoryPage,
    cartPage,
    checkoutInfoPage,
  }) => {
    await inventoryPage.addAllToCart([PRODUCTS.backpack, PRODUCTS.bikeLight]);
    await inventoryPage.openCart();
    await cartPage.checkout();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    await checkoutInfoPage.cancel();

    // Abandoning checkout must not silently empty the basket.
    await expect(page).toHaveURL(/cart\.html/);
    await expect(cartPage.cartItems).toHaveCount(2);
    await expect(cartPage.cartBadge).toHaveText('2');
  });

  /**
   * The three required-field cases share a precondition, so it lives in a
   * nested describe. `fillDetails` only fills the fields it is given, which is
   * what lets each case omit exactly one field.
   */
  test.describe('customer details validation', () => {
    test.beforeEach(async ({ page, inventoryPage, cartPage }) => {
      await inventoryPage.addToCart(PRODUCTS.backpack);
      await inventoryPage.openCart();
      await cartPage.checkout();
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });

    test('TC-CHK-03 | missing first name blocks progress', async ({
      page,
      checkoutInfoPage,
    }) => {
      await checkoutInfoPage.fillDetails({
        lastName: CHECKOUT_DETAILS.lastName,
        postalCode: CHECKOUT_DETAILS.postalCode,
      });
      await checkoutInfoPage.continue();

      await expect(checkoutInfoPage.errorMessage).toHaveText('Error: First Name is required');
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });

    test('TC-CHK-04 | missing last name blocks progress', async ({
      page,
      checkoutInfoPage,
    }) => {
      await checkoutInfoPage.fillDetails({
        firstName: CHECKOUT_DETAILS.firstName,
        postalCode: CHECKOUT_DETAILS.postalCode,
      });
      await checkoutInfoPage.continue();

      await expect(checkoutInfoPage.errorMessage).toHaveText('Error: Last Name is required');
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });

    test('TC-CHK-05 | missing postal code blocks progress', async ({
      page,
      checkoutInfoPage,
    }) => {
      await checkoutInfoPage.fillDetails({
        firstName: CHECKOUT_DETAILS.firstName,
        lastName: CHECKOUT_DETAILS.lastName,
      });
      await checkoutInfoPage.continue();

      await expect(checkoutInfoPage.errorMessage).toHaveText('Error: Postal Code is required');
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });
  });
});

/**
 * TC-CHK-07 / TC-BUG-02 - the same test run against a working build and a
 * deliberately broken one. Same structure, and same reasoning, as the paired
 * sorting block in sorting.spec.ts.
 *
 * `problem_user` wires the Last Name input into the First Name field. That is
 * injected on purpose, not a defect anyone will fix, so the inverted result is
 * a check on this suite rather than a bug ticket: if the problem_user run ever
 * goes green, these assertions have stopped detecting the fault.
 */
const NAME_FIELD_ACCOUNTS = [
  { id: 'TC-CHK-07', label: 'standard_user', username: USERS.standard, faultInjected: false },
  { id: 'TC-BUG-02', label: 'problem_user', username: USERS.problem, faultInjected: true },
] as const;

test.describe('Checkout details - typed values land in the right field', () => {
  for (const account of NAME_FIELD_ACCOUNTS) {
    // Marker first - see the note in sorting.spec.ts.
    const inverted = account.faultInjected ? 'expected fail: ' : '';

    test(`${account.id} | ${inverted}Last Name is written to Last Name - ${account.label}`, async ({
      loginPage,
      inventoryPage,
      cartPage,
      checkoutInfoPage,
    }) => {
      if (account.faultInjected) {
        test.fail();
        test.info().annotations.push({
          type: 'injected fault',
          description:
            'problem_user: text typed into Last Name is written into First Name and Last Name ' +
            'stays empty, so checkout cannot be completed with this account at all.',
        });
      }

      await loginPage.signIn(account.username);
      await inventoryPage.addToCart(PRODUCTS.backpack);
      await inventoryPage.openCart();
      await cartPage.checkout();

      await checkoutInfoPage.lastNameInput.fill(CHECKOUT_DETAILS.lastName);

      // Expected: the value lands in the field it was typed into, and the
      // other field is left alone.
      await expect(checkoutInfoPage.lastNameInput).toHaveValue(CHECKOUT_DETAILS.lastName);
      await expect(checkoutInfoPage.firstNameInput).toHaveValue('');
    });
  }
});
